import { Router, Request, Response } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../env.js";
import { db } from "../db/connection.js";
import { profiles, plants, plantTasks , roles , products, categories} from "../db/schema/references.js"; 
import { eq, and } from "drizzle-orm";


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

    // 3. Declaración de herramientas para Gemini
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

    const addProductInventoryTool = {
  functionDeclarations: [
    {
      name: "addProductInventory",
      description: "Agrega un nuevo producto al inventario. Solo permitido para administradores.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Nombre del producto." },
          quantity: { type: Type.NUMBER, description: "Cantidad inicial en stock." },
          price: { type: Type.NUMBER, description: "Precio del producto (opcional)." },
        },
        required: ["name", "quantity"],
      },
    },
  ],
};

   const registerPlantTool = {
      functionDeclarations: [
        {
          name: "registerPlant",
          description: "Registra una nueva planta en la base de datos para el usuario actual especificando nombre, icono y frecuencias de cuidado.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Nombre o apodo principal de la planta." },
              scientificName: { type: Type.STRING, description: "Nombre científico de la planta (opcional)." },
              icon: { type: Type.STRING, description: "Identificador numérico o clave del icono de la planta." },
              wateringInterval: { type: Type.NUMBER, description: "Cada cuántos días se debe regar (ej: 3 para cada 3 días)." },
              // NUEVO: Agregar intervalos para poda o abono si el usuario los menciona
              pruningInterval: { type: Type.NUMBER, description: "Cada cuántos días se debe podar (opcional)." },
              fertilizerInterval: { type: Type.NUMBER, description: "Cada cuántos días se debe abonar (opcional)." }
            },
            required: ["name"],
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

      - Si el usuario indica que ya realizó una tarea de cuidado sobre alguna de sus plantas (por ejemplo: "Ya regué mi Monstera", "Marqué el riego de la orquídea"), invoca inmediatamente la función "markTaskCompleted".
      - Si el usuario indica que quiere agregar, crear o registrar una nueva planta, invoca inmediatamente la función "registerPlant".
      - Si el usuario indica que quiere agregar un producto al inventario, invoca inmediatamente la función "addProductInventory".
    
    `;

    // 4. Primera interacción con Gemini
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: message,
      config: {
        systemInstruction,
        tools: [markTaskTool , registerPlantTool, addProductInventoryTool],
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

      if (call.name === "registerPlant") {
        const { name, scientificName, icon, wateringInterval, pruningInterval , fertilizerInterval } = call.args as {
          name: string;
          scientificName?: string;
          icon?: string;
          wateringInterval?: number;
          pruningInterval?: number;      
          fertilizerInterval?: number;
          
        };

        const newPlant = await db.insert(plants).values({
          id: crypto.randomUUID(),
          userId: userId,
          name: name,
          scientificName: scientificName || "EMPTY",
          icon: icon ? String(icon) : "0",
          wateringEnabled: wateringInterval !== undefined,
          wateringInterval: wateringInterval ?? 7,
          pruningEnabled: pruningInterval !== undefined,
          pruningInterval: pruningInterval ?? 30,
          fertilizerEnabled: fertilizerInterval !== undefined,
          fertilizerInterval: fertilizerInterval ?? 15,
        }).returning();

        if (newPlant.length > 0) {
          return res.json({
            reply: `¡Listo, ${userName}! He registrado tu nueva planta **${name}** en tu colección de Raíces. 🌱✨`,
            actionExecuted: {
              type: "PLANT_REGISTERED",
              plantId: newPlant[0].id,
            },
          });
        }
      }
 if (call.name === "addProductInventory") {
        // 1. Verificamos si el usuario es administrador
        try {
          const [adminCheck] = await db
            .select({ roleName: roles.name })
            .from(profiles)
            .innerJoin(roles, eq(profiles.roleId, roles.id))
            .where(eq(profiles.id, userId));

          if (!adminCheck || adminCheck.roleName !== "admin") {
            return res.json({
              reply: `Lo siento ${userName}, esta es una función exclusiva para administradores y no tienes permisos para modificar el inventario. 🔒`,
            });
          }
        } catch (err) {
          console.error("Error verificando rol de admin para inventario:", err);
          return res.json({
            reply: `Ocurrió un error al verificar tus permisos de administrador.`,
          });
        }

        // 2. Extraemos los argumentos de Gemini
        const { name, sku, description, quantity, price } = call.args as {
          name: string;
          sku?: string;
          description?: string;
          quantity: number;
          price?: number;
        };

        // 3. Buscamos inteligentemente una categoría (ej. si el nombre contiene "planta" o "rosa", asignamos "Planta", o cogemos la primera por defecto)
        let targetCategoryId = null;
        try {
          const allCategories = await db.select().from(categories);
          
          // Buscamos si alguna categoría hace match con el nombre del producto, o usamos "Planta" por defecto
          const matchedCategory = allCategories.find(c => 
            c.name && name.toLowerCase().includes(c.name.toLowerCase())
          ) || allCategories.find(c => c.name === "Planta") || allCategories[0];

          if (matchedCategory) {
            targetCategoryId = matchedCategory.id;
          }
        } catch (e) {
          console.error("Error obteniendo categoría:", e);
        }

        // 4. Insertamos el producto en la base de datos cubriendo todos los campos requeridos
        await db.insert(products).values({
          id: crypto.randomUUID(),
          name: name, 
          price: price ? String(price) : "0",
          stock: quantity,
          reservedStock: 0,
          isActive: true,
        });

        return res.json({
          reply: `¡Listo, ${userName}! Has agregado exitosamente **${quantity}x ${name}** al inventario como administrador. 📦✨`,
          actionExecuted: {
            type: "PRODUCT_ADDED",
          },
        });
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