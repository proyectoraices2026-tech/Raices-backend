import type { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../env.js";

const JWKS = createRemoteJWKSet(
    new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

export interface AuthenticatedRequest extends Request {
    userId?: string;
}

export async function requireAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token no proporcionado" });
    }

    const token = authHeader.slice("Bearer ".length);

    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: `${env.SUPABASE_URL}/auth/v1`,
        });

        req.userId = payload.sub;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Token inválido o expirado" });
    }
}