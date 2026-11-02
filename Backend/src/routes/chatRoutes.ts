import { Router, Request, Response } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../env.js";
import { db } from "../db/connection.js";
import { profiles, plants, plantTasks } from "../db/schema/references.js"; 
import { eq, and, ilike } from "drizzle-orm";

const router = Router();
const ai = new GoogleGenAI({ apiKey: String(env.GEMINI_API_KEY) });

router.post("/", async (req: Request, res: Response) => {
  try {
    const { message, userId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "El mensaje es requerido." });
    }

    // 1. Consultar el perfil del usuario
    let userName = "Usuario";
    if (userId) {
      try {
        const userProfile = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, userId))
          .limit(1);

        if (userProfile && userProfile.length > 0) {
          userName = userProfile[0].name || "Usuario";
        }
      } catch (err) {
        console.error("Error consultando el perfil:", err);
      }
    }

    // 2. Consultar las plantas del usuario
    let userPlantsList: any[] = [];
    let plantsText = "El usuario no tiene plantas registradas actualmente.";
    if (userId) {
      try {
        userPlantsList = await db
          .select()
          .from(plants)
          .where(eq(plants.userId, userId));

        if (userPlantsList.length > 0) {
          plantsText = userPlantsList
            .map(
              (p) =>
                `- ID: ${p.id} | Nombre: ${p.name} (Nombre científico: ${p.scientificName || "No especificado"})`
            )
            .join("\n");
        }
      } catch (err) {
        console.error("Error consultando las plantas:", err);
      }
    }

    // 3. Declaración de la herramienta/función para Gemini
    const markTaskTool = {
      functionDeclarations: [
        {
          name: "markTaskCompleted",
          description: "Marca como completada una tarea de cuidado (riego, abono, podado, etc.) para una planta del usuario.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              plantName: {
                type: Type.STRING,
                description: "Nombre de la planta que recibió la atención (ej: 'Monstera', 'Cactus', 'Orquídea').",
              },
              taskType: {
                type: Type.STRING,
                description: "Tipo de tarea realizada (ej: 'water' para riego, 'fertilize' para abono, 'prune' para poda). Si se menciona riego, enviar 'water'.",
              },
            },
            required: ["plantName"],
          },
        },
      ],
    };

    const systemInstruction = `
      Eres Rut, la asistente virtual botánica de la aplicación "Raíces".
      Tu objetivo es orientar al usuario sobre el cuidado de sus plantas y gestionar sus tareas de riego/cuidado.
      Mantén un tono amable, claro y cercano. Responde la duda del usuario de forma directa en 2 o 3 oraciones.

      INFORMACIÓN DEL USUARIO:
      - Nombre del usuario: ${userName}

      PLANTAS REGISTRADAS EN SU CUENTA:
      ${plantsText}

      Si el usuario indica que ya realizó una tarea de cuidado sobre alguna de sus plantas (por ejemplo: "Ya regué mi Monstera", "Marqué el riego de la orquídea"), invoca inmediatamente la función "markTaskCompleted".
    `;

    // 4. Primera interacción con Gemini
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: message,
      config: {
        systemInstruction,
        tools: [markTaskTool],
        temperature: 0.3,
      },
    });

    const functionCalls = response.functionCalls;

    // 5. Si Gemini decide llamar a la herramienta:
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];

      if (call.name === "markTaskCompleted") {
        const { plantName, taskType } = call.args as { plantName: string; taskType?: string };
        const targetType = taskType || "water";

        // Buscar la planta coincidente por nombre
        const targetPlant = userPlantsList.find((p) =>
          p.name.toLowerCase().includes(plantName.toLowerCase())
        );

        if (!targetPlant) {
          return res.json({
            reply: `No encontré ninguna planta llamada "${plantName}" en tu lista registrada.`,
          });
        }

        // Buscar y actualizar la tarea en plant_tasks
        const updatedTasks = await db
          .update(plantTasks)
          .set({
            completed: true,
            completedAt: new Date(),
          })
          .where(
            and(
              eq(plantTasks.plantId, targetPlant.id),
              eq(plantTasks.userId, userId),
              eq(plantTasks.completed, false)
            )
          )
          .returning();

        if (updatedTasks.length > 0) {
          return res.json({
            reply: `¡Listo, ${userName}! He marcado como completado el registro de ${targetType === "water" ? "riego" : "cuidado"} para tu ${targetPlant.name}. 🌱✨`,
            actionExecuted: {
              type: "TASK_COMPLETED",
              plantId: targetPlant.id,
              taskId: updatedTasks[0].id,
            },
          });
        } else {
          return res.json({
            reply: `Tu ${targetPlant.name} no tenía ninguna tarea pendiente por marcar en el calendario. ¡Todo al día! 🌿`,
          });
        }
      }
    }

    // Respuesta normal si no requirió ejecución de herramientas
    return res.json({ reply: response.text });
  } catch (error) {
    console.error("Error en el servidor de Gemini:", error);
    return res.status(500).json({
      error: "Ocurrió un error al procesar tu solicitud con la IA.",
    });
  }
});

export default router;