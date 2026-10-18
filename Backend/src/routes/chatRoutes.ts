import { Router, Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { env } from "../env.js";


const router = Router();
const ai = new GoogleGenAI({ apiKey: String(env.GEMINI_API_KEY) });

router.post("/", async (req: Request, res: Response) => {
  try {
    const { message, history, userId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "El mensaje es requerido." });
    }

    let userPlantsContext = "El usuario no tiene plantas registradas actualmente.";


    const systemInstruction = `
      Eres Rut, la asistente virtual botánica de la aplicación "Raíces".
      Tu objetivo es orientar al usuario sobre el cuidado de sus plantas, riegos, plagas y dudas de jardinería.
      Mantén un tono amable, claro y cercano.

      INFORMACIÓN DE LAS PLANTAS DEL USUARIO:
      ${userPlantsContext}

      Si el usuario te pregunta por alguna de sus plantas registradas, utilízala para personalizar tu respuesta. Si pregunta por cosas ajenas a la botánica o la app, recuérdale amablemente que tu enfoque son las plantas.
    `;

    const formattedHistory = (history || []).map((msg: { sender: string; text: string }) => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    // Cambio al 3.8
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        ...formattedHistory,
        { role: "user", parts: [{ text: message }] },
      ],
      config: {
        systemInstruction,
      },
    });

    return res.json({ reply: response.text });

  } catch (error) {
    console.error("Error en el chatbot:", error);
    return res.status(500).json({ error: "Ocurrió un error al procesar tu solicitud con la IA." });
  }
});

export default router;