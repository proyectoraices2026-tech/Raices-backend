import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { createRequest, listMyRequests, listPendingRequests, acceptRequest, rejectRequest, archiveRequest, archiveAllRequests, listArchiveRequests, unArchiveRequest } from "../controllers/requestController.js";
import { validateBody } from "../middleware/validations.js";
import { rejectRequestSchema, createRequestSchema } from "../validators/requestSchema.js";

const router = Router();

// Usuario autenticado
router.post("/request", requireAuth, validateBody(createRequestSchema), createRequest);
router.get("/my-requests", requireAuth, listMyRequests);
router.patch("/archive-all", requireAuth, archiveAllRequests);
router.patch("/:id/archive", requireAuth, archiveRequest);

// Usuario autenticado, rutas papelera de pedidos
router.get("/archive-requests", requireAuth, listArchiveRequests);
router.patch("/:id/unarchive", requireAuth, unArchiveRequest);


// Solo admin
router.get("/pending", requireAuth, requireAdmin, listPendingRequests);
router.post("/:id/accept", requireAuth, requireAdmin, acceptRequest);
router.post("/:id/reject", requireAuth, requireAdmin, validateBody(rejectRequestSchema), rejectRequest);

export default router;