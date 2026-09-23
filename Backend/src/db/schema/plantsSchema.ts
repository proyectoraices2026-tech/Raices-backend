import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const plants = pgTable('plants', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(), // Para saber a qué usuario pertenece la planta
  name: text('name').notNull(),
  scientificName: text('scientific_name'),
  wateringFrequency: text('watering_frequency'),
  pruningFrequency: text('pruning_frequency'),
  fertilizerFrequency: text('fertilizer_frequency'),
  icon: text('icon'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});