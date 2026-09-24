import type { Response } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db } from "../db/connection.js";
import { requests, request_items } from "../db/schema/indexSchema.js";
import { products } from "../db/schema/references.js";
import type { CreateRequestInput, RejectRequestInput } from "../validators/requestSchema.js";
import { requestIdParamSchema } from "../validators/requestSchema.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";



export async function createRequest(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId;
    const { items }: CreateRequestInput = req.body;

    if (!userId) {
        return res.status(401).json({ error: "No autenticado" });
    }

    try {
        const result = await db.transaction(async (tx) => {
            let totalAmount = 0;
            const itemsToInsert: {
                productId: string;
                quantity: number;
                price: string;
            }[] = [];

            // 1. Validar stock y reservar, uno por uno
            for (const item of items) {
                const [product] = await tx
                    .select()
                    .from(products)
                    .where(eq(products.id, item.productId))
                    .for("update"); // bloquea la fila hasta que la transacción termine

                if (!product) {
                    throw new Error(`Producto ${item.productId} no encontrado`);
                }

                const available = (product.stock ?? 0) - (product.reservedStock ?? 0);

                if (available < item.quantity) {
                    throw new Error(
                        `Stock insuficiente para "${product.name}". Disponible: ${available}`
                    );
                }

                // Reservar: sube reserved_stock, NO toca stock todavía
                await tx
                    .update(products)
                    .set({
                        reservedStock: sql`${products.reservedStock} + ${item.quantity}`,
                    })
                    .where(eq(products.id, item.productId));

                const price = Number(product.price ?? 0);
                totalAmount += price * item.quantity;

                itemsToInsert.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: price.toFixed(2),
                });
            }

            // 2. Crear la solicitud
            const [newRequest] = await tx
                .insert(requests)
                .values({
                    userId,
                    totalAmount: totalAmount.toFixed(2),
                })
                .returning();

            // 3. Insertar los items de la solicitud
            await tx.insert(request_items).values(
                itemsToInsert.map((item) => ({
                    requestId: newRequest.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price
                }))
            );

            return newRequest;
        });

        return res.status(201).json({
            success: true,
            message: "Pedido solicitado con éxito. Pendiente de aprobación.",
            data: result,
        });
    } catch (err) {
        console.error("Error:", err);
        if (err instanceof Error && err.cause) {
            console.error("Causa:", err.cause);
        }
        const message = err instanceof Error ? err.message : "Error al crear el pedido";
        return res.status(400).json({ success: false, error: message });
    }
}

export async function acceptRequest(req: AuthenticatedRequest, res: Response) {
    const parsedParams = requestIdParamSchema.safeParse(req.params);

    if (!parsedParams.success) {
        return res.status(400).json({ error: "ID de solicitud inválido" });
    }

    const { id } = parsedParams.data;
    const {adminMessage} = req.body;

    try {
        const result = await db.transaction(async (tx) => {
            // 1. Traer la solicitud y bloquearla
            const [request] = await tx
                .select()
                .from(requests)
                .where(eq(requests.id, id))
                .for("update");

            if (!request) {
                throw new Error("Solicitud no encontrada");
            }

            if (request.status !== "pending") {
                throw new Error(
                    `Esta solicitud ya fue procesada (estado actual: ${request.status})`
                );
            }

            // 2. Traer los items de esa solicitud
            const items = await tx
                .select()
                .from(request_items)
                .where(eq(request_items.requestId, id));

            // 3. Por cada producto: confirmar stock real y descontarlo definitivamente
            for (const item of items) {
                const [product] = await tx
                    .select()
                    .from(products)
                    .where(eq(products.id, item.productId))
                    .for("update");

                if (!product) {
                    throw new Error(`Producto ${item.productId} ya no existe`);
                }

                if ((product.stock ?? 0) < item.quantity) {
                    throw new Error(
                        `Stock insuficiente para "${product.name}" al momento de aceptar`
                    );
                }

                // Descuenta stock real y libera la reserva
                await tx
                    .update(products)
                    .set({
                        stock: sql`${products.stock} - ${item.quantity}`,
                        reservedStock: sql`${products.reservedStock} - ${item.quantity}`,
                    })
                    .where(eq(products.id, item.productId));
            }

            // 4. Actualizar el estado de la solicitud
            const [updated] = await tx
                .update(requests)
                .set({
                    status: "accepted",
                    adminMessage: adminMessage,
                    updatedAt: new Date(),
                })
                .where(eq(requests.id, id))
                .returning();

            return updated;
        });

        return res.status(200).json({
            success: true,
            message: "Pedido aceptado exitosamente.",
            data: result,
        });
    } catch (err) {
        console.error("Error:", err);
        if (err instanceof Error && err.cause) {
            console.error("Causa:", err.cause);
        }
        const message = err instanceof Error ? err.message : "Error al aceptar el pedido";
        return res.status(400).json({ success: false, error: message });
    }
}

export async function rejectRequest(req: AuthenticatedRequest, res: Response) {
    const parsedParams = requestIdParamSchema.safeParse(req.params);

    if (!parsedParams.success) {
        return res.status(400).json({ error: "ID de solicitud inválido" });
    }

    const { id } = parsedParams.data;
    const { reason }: RejectRequestInput = req.body;

    try {
        const result = await db.transaction(async (tx) => {
            const [request] = await tx
                .select()
                .from(requests)
                .where(eq(requests.id, id))
                .for("update");

            if (!request) {
                throw new Error("Solicitud no encontrada");
            }

            if (request.status !== "pending") {
                throw new Error(
                    `Esta solicitud ya fue procesada (estado actual: ${request.status})`
                );
            }

            const items = await tx
                .select()
                .from(request_items)
                .where(eq(request_items.requestId, id));

            // Libera la reserva de cada producto — NO toca stock real
            for (const item of items) {
                await tx
                    .update(products)
                    .set({
                        reservedStock: sql`${products.reservedStock} - ${item.quantity}`,
                    })
                    .where(eq(products.id, item.productId));
            }

            const [updated] = await tx
                .update(requests)
                .set({
                    status: "rejected",
                    adminMessage: reason,
                    updatedAt: new Date(),
                })
                .where(eq(requests.id, id))
                .returning();

            return updated;
        });

        return res.status(200).json({
            success: true,
            message: "Pedido rechazado y stock devuelto.",
            data: result,
        });
    } catch (err) {
        console.error("Error:", err);
        if (err instanceof Error && err.cause) {
            console.error("Causa real:", err.cause);
        }
        const message = err instanceof Error ? err.message : "Error al rechazar el pedido";
        return res.status(400).json({ success: false, error: message });
    }
}

// Admin: todas las solicitudes pendientes
export async function listPendingRequests(_req: AuthenticatedRequest, res: Response) {
    const pending = await db.query.requests.findMany({
        where: eq(requests.status, "pending"),
        with: {
            requestItems: true, // ajusta al nombre real que dejaste en requestsRelations
        },
        orderBy: (requests, { asc }) => [asc(requests.createdAt)],
    });

    return res.status(200).json({ success: true, data: pending });
}

// archivar una solicitud
export async function archiveRequest(req: AuthenticatedRequest, res: Response) {
    const parsedParams = requestIdParamSchema.safeParse(req.params);

    if (!parsedParams.success) {
        return res.status(400).json({ error: "ID de solicitud inválido" });
    }

    const { id } = parsedParams.data;
    const userId = req.userId;

    if (!userId) {
        return res.status(401).json({ error: "No autenticado" });
    }

    const [request] = await db.select().from(requests).where(eq(requests.id, id));

    if (!request) {
        return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    // Solo el dueño del pedido puede archivarlo — evita que un usuario borre pedidos ajenos
    if (request.userId !== userId) {
        return res.status(403).json({ error: "No puedes modificar este pedido" });
    }

    // No tiene sentido ocultar un pedido que aún está en proceso
    if (request.status === "pending") {
        return res.status(400).json({ error: "No puedes eliminar un pedido pendiente" });
    }

    const [updated] = await db
        .update(requests)
        .set({ archivedByUser: true })
        .where(eq(requests.id, id))
        .returning();

    return res.status(200).json({ success: true, data: updated });
}

// Usuario: sus propias solicitudes, cualquier estado
export async function listMyRequests(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId;

    if (!userId) {
        return res.status(401).json({ error: "No autenticado" });
    }

    const myRequests = await db.query.requests.findMany({
        where: and(eq(requests.userId, userId), eq(requests.archivedByUser, false)),
        with: {
            requestItems: true,
        },
        orderBy: (requests, { desc }) => [desc(requests.createdAt)],
    });

    return res.status(200).json({ success: true, data: myRequests });
}