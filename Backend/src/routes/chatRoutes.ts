import { Router, Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { env } from "../env.js";
import { db } from "../db/connection.js";
import { profiles, plants } from "../db/schema/references.js"; 
import { eq } from "drizzle-orm";

const router = Router();
const ai = new GoogleGenAI({ apiKey: String(env.GEMINI_API_KEY) });

router.post("/", async (req: Request, res: Response) => {
  try {
    const { message, userId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "El mensaje es requerido." });
    }

    // 1. Consultar el perfil del usuario (nombre) con Drizzle
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

    // 2. Consultar las plantas del usuario en Supabase con Drizzle
    let plantsText = "El usuario no tiene plantas registradas actualmente.";
    if (userId) {
      try {
        const userPlants = await db
          .select()
          .from(plants)
          .where(eq(plants.userId, userId));

        if (userPlants && userPlants.length > 0) {
          plantsText = userPlants
            .map(
              (p) =>
                `- ${p.name} (Nombre científico: ${p.scientificName || "No especificado"})`
            )
            .join("\n");
        }
      } catch (err) {
        console.error("Error consultando las plantas:", err);
      }
    }

    // 3. Crear el contexto para Rut
    const systemInstruction = `
      Eres Rut, la asistente virtual botánica de la aplicación "Raíces".
      Tu objetivo es orientar al usuario sobre el cuidado de sus plantas, riegos, plagas y dudas de jardinería.
      Mantén un tono amable, claro y cercano , Responde la duda del usuario de forma directa y concisa en un solo párrafo corto (máximo 2 a 3 oraciones con consejos prácticos), a menos que el usuario pida una guía detallada.

      INFORMACIÓN DEL USUARIO:
      - Nombre del usuario: ${userName}

      PLANTAS REGISTRADAS EN SU CUENTA:
      ${plantsText}

      Si el usuario te pregunta por su nombre o sobre sus plantas registradas, usa esta información para responderle con total precisión.
    `;

    // 4. Generar respuesta con Gemini 3.8 Flash
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction: systemInstruction,
         
        temperature: 0.3,
      },
    });

    return res.json({ reply: response.text });
  } catch (error) {
    console.error("Error en el servidor de Gemini:", error);
    return res.status(500).json({ error: "Ocurrió un error al procesar tu solicitud con la IA." });
  }
});

export default router;