import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const properties = pgTable("properties", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: real("price").notNull(),
  bedrooms: integer("bedrooms").notNull(),
  bathrooms: integer("bathrooms").notNull(),
  sqft: integer("sqft").notNull(),
  location: text("location").notNull(),
  images: json("images").$type<string[]>().notNull().default([]),
  agentId: text("agent_id").notNull().default("agent-1"),
  status: text("status").notNull().default("active"),
  vibe: text("vibe").notNull().default("modern"),
});

export const leads = pgTable("leads", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  propertyId: integer("property_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
