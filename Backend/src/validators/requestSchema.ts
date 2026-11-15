import { z } from "zod";

export const createRequestSchema = z.object({
    items: z
        .array(
            z.object({
                productId: z.string().uuid(),
                quantity: z.number().int().positive(),
            })
        )
        .min(1, "Debe incluir al menos un producto")
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const rejectRequestSchema = z.object({
    reason: z.string().min(1, "Debes indicar un motivo de rechazo"),
});

export type RejectRequestInput = z.infer<typeof rejectRequestSchema>;

export const requestIdParamSchema = z.object({
    id: z.string().uuid("ID de solicitud inválido"),
});