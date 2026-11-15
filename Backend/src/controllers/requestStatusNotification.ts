import { eq, sql } from "drizzle-orm";
import { db } from "../db/connection.js";                              
import { requests, request_items} from "../db/schema/indexSchema.js"; 
import { products } from "../db/schema/references.js";
import { sendOrderEmail } from "./emailNotificationController.js";

/*
    Envía al dueño del pedido el correo de aceptado/rechazado.
    Nunca lanza: si algo falla solo se registra, para no afectar la operación del admin.
*/
export async function sendRequestStatusEmail(requestId: string) {
    try {
        const [request] = await db.select().from(requests).where(eq(requests.id, requestId));
        if (!request) return;

        if (request.status !== "accepted" && request.status !== "rejected") return;

        const items = await db
            .select({
                name: products.name,
                quantity: request_items.quantity,
                price: request_items.price,
            })
            .from(request_items)
            .innerJoin(products, eq(request_items.productId, products.id))
            .where(eq(request_items.requestId, requestId));

        // El email vive en auth.users (Supabase), no en profiles
        const result: any = await db.execute(
            sql`select email from auth.users where id = ${request.userId}`
        );
        const userRows = Array.isArray(result) ? result : result.rows;
        const email: string | undefined = userRows?.[0]?.email;
        if (!email) {
            console.error("Correo de estado: el usuario no tiene email", request.userId);
            return;
        }

        await sendOrderEmail(request.status, {
            to: email,
            requestId: request.id,
            createdAt: request.createdAt ?? new Date(),
            totalAmount: Number(request.totalAmount),
            adminMessage: request.adminMessage,
            items: items.map((i) => ({
                name: i.name ?? "Producto sin nombre",
                quantity: i.quantity,
                price: Number(i.price),
            })),
        });
    } catch (err) {
        console.error("Error enviando correo de estado del pedido:", err);
    }
}