import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createPlant, listMyPlants, updatePlant, deletePlant } from '../controllers/plantController.js';

const router = Router();

// Rutas protegidas por autenticación
router.post('/', requireAuth, createPlant);
router.get('/', requireAuth, listMyPlants);
router.put('/:id', requireAuth, updatePlant);
router.delete('/:id', requireAuth, deletePlant);

export default router;