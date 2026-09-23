import type { Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { profiles, roles } from "../db/schema/references.js";
import type { AuthenticatedRequest } from "./auth.js";

export async function requireAdmin(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    const userId = req.userId;

    if (!userId) {
        return res.status(401).json({ error: "No autenticado" });
    }

    const [result] = await db
        .select({ roleName: roles.name })
        .from(profiles)
        .innerJoin(roles, eq(profiles.roleId, roles.id))
        .where(eq(profiles.id, userId));

    if (!result || result.roleName !== "admin") {
        return res.status(403).json({ error: "Acceso solo para administradores" });
    }

    next();
}