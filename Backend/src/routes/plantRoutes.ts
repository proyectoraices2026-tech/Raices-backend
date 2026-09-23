import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createPlant, listMyPlants } from '../controllers/plantController.js';

const router = Router();

// Rutas protegidas por autenticación
router.post('/', requireAuth, createPlant);
router.get('/', requireAuth, listMyPlants);

export default router;