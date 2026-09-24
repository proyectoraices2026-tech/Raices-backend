import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { createRequest, listMyRequests, listPendingRequests, acceptRequest, rejectRequest, archiveRequest } from "../controllers/requestController.js";
import { validateBody } from "../middleware/validations.js";
import { rejectRequestSchema, createRequestSchema } from "../validators/requestSchema.js";

const router = Router();

// Usuario autenticado
router.post("/request", requireAuth, validateBody(createRequestSchema), createRequest);
router.get("/my-requests", requireAuth, listMyRequests);
router.patch("/:id/archive", requireAuth, archiveRequest);

// Solo admin
router.get("/pending", requireAuth, requireAdmin, listPendingRequests);
router.post("/:id/accept", requireAuth, requireAdmin, acceptRequest);
router.post("/:id/reject", requireAuth, requireAdmin, validateBody(rejectRequestSchema), rejectRequest);

export default router;