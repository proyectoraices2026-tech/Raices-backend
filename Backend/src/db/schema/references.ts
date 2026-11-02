//imports
import { pgTable, uuid, text, numeric, integer, boolean , date , timestamp} from "drizzle-orm/pg-core";

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


// Representación de la tabla plants que vive en Supabase
export const plants = pgTable("plants", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id"),
  name: text("name"),
  scientificName: text("scientific_name"),
  icon: text("icon"),
});


export const plantTasks = pgTable("plant_tasks", {
  id: uuid("id").primaryKey(),
  plantId: uuid("plant_id"),
  userId: uuid("user_id"),
  taskType: text("task_type"),
  isAutomatic: boolean("is_automatic"),
  label: text("label"),
  dueDate: date("due_date"),
  completed: boolean("completed"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at"),
  nextGenerated: boolean("next_generated"),
});