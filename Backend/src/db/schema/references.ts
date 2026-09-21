//imports
import { pgTable, uuid, text, numeric, integer, boolean} from "drizzle-orm/pg-core";

// Representación de la tabla profiles que vive en Supabase
export const profiles = pgTable("profiles", {
    id: uuid("id").primaryKey(),
    roleId: uuid("role_id"),
    name: text("name"),
    phone: text("phone"),
});

// Representación de la tabla products que vive en Supabase
export const products = pgTable("products", {
    id: uuid("id").primaryKey(),
    name: text("name"),
    price: numeric("price", { precision: 10, scale: 2 }),
    stock: integer("stock"),
    reservedStock: integer("reserved_stock"),
    isActive: boolean("is_active")
});

// Representación de la tabla roles que vive en Supabase
export const roles = pgTable("roles", {
    id: uuid("id").primaryKey(),
    name: text("name"),
    description: text("description"),
});

