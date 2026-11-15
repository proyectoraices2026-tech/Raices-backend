// imports
import { pgTable, uuid, numeric, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// importar tablas
import { requests } from "../schema/requests.js";
import { products } from "./references.js";

// definir tablas
export const request_items = pgTable("request_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull().references(() => requests.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id),
    quantity: integer("quantity").notNull().default(0),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

// Definir relaciones
export const requestItemsRelations = relations(request_items, ({ one }) => ({
    request: one(requests, {
        fields: [request_items.requestId],
        references: [requests.id],
    }),

    product: one(products, {
        fields: [request_items.productId],
        references: [products.id],
    }),
}));

// Inferir tipos
export type RequestItems = typeof requests.$inferSelect;
export type NewRequestItems = typeof requests.$inferInsert;

// Crear los esquemas Zod para validaciones
export const insertRequestItemsSchema = createInsertSchema(request_items);
export const selectRequestItemsSchema = createSelectSchema(request_items);