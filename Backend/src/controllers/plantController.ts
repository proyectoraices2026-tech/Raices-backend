import type { Response } from "express";
import { eq, and } from "drizzle-orm";
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
    const userId = req.userId;

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

// Actualizar una planta del usuario
export const updatePlant = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    // Aseguramos que id sea un string único
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, scientificName, wateringFrequency, pruningFrequency, fertilizerFrequency, icon } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    if (!id) {
      return res.status(400).json({ error: 'El ID de la planta es requerido.' });
    }

    const [updatedPlant] = await db
      .update(plants)
      .set({
        ...(name && { name }),
        ...(scientificName !== undefined && { scientificName }),
        ...(wateringFrequency !== undefined && { wateringFrequency }),
        ...(pruningFrequency !== undefined && { pruningFrequency }),
        ...(fertilizerFrequency !== undefined && { fertilizerFrequency }),
        ...(icon !== undefined && { icon }),
      })
      .where(and(eq(plants.id, id), eq(plants.userId, userId)))
      .returning();

    if (!updatedPlant) {
      return res.status(404).json({ error: 'Planta no encontrada o no tienes permiso para modificarla.' });
    }

    return res.status(200).json(updatedPlant);
  } catch (error) {
    console.error('Error al actualizar la planta:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// Eliminar una planta del usuario
export const deletePlant = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    // Aseguramos que id sea un string único
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    if (!id) {
      return res.status(400).json({ error: 'El ID de la planta es requerido.' });
    }

    const [deletedPlant] = await db
      .delete(plants)
      .where(and(eq(plants.id, id), eq(plants.userId, userId)))
      .returning();

    if (!deletedPlant) {
      return res.status(404).json({ error: 'Planta no encontrada o no tienes permiso para eliminarla.' });
    }

    return res.status(200).json({ message: 'Planta eliminada con éxito.', deletedPlant });
  } catch (error) {
    console.error('Error al eliminar la planta:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};