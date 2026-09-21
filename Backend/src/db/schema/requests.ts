// imports
import { pgTable, uuid, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// importar tablas
import { request_items } from "./request_items.js";
import { profiles } from "./references.js";


export const requests = pgTable("requests", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    status: text("status").notNull().default("pending"),
    adminMessage: text("admin_message"),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Definir relaciones
export const requestsRelations = relations(requests, ({ one, many }) => ({
    profile: one(profiles, {
        fields: [requests.userId],
        references: [profiles.id],
    }),

    requestItems: many(request_items)
}));

// Inferir tipos
export type Request = typeof requests.$inferSelect;
export type NewRequest = typeof requests.$inferInsert;

// Crear los esquemas Zod para validaciones
export const insertRequestSchema = createInsertSchema(requests);
export const selectRequestSchema = createSelectSchema(requests);