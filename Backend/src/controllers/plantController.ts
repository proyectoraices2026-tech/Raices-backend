import type { Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { plants } from "../db/schema/indexSchema.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

// Crear/Registrar una nueva planta
export const createPlant = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, scientificName, wateringFrequency, pruningFrequency, fertilizerFrequency, icon } = req.body;
    const userId = req.userId; // ¡Directo desde AuthenticatedRequest!

    if (!name) {
      return res.status(400).json({ error: 'El nombre de la planta es obligatorio.' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    const [newPlant] = await db.insert(plants).values({
      userId,
      name,
      scientificName,
      wateringFrequency,
      pruningFrequency,
      fertilizerFrequency,
      icon,
    }).returning();

    return res.status(201).json(newPlant);
  } catch (error) {
    console.error('Error al registrar la planta:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// Listar las plantas del usuario autenticado
export const listMyPlants = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId; // ¡Directo desde AuthenticatedRequest!

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    const myPlants = await db.select().from(plants).where(eq(plants.userId, userId));
    return res.status(200).json(myPlants);
  } catch (error) {
    console.error('Error al obtener plantas:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};