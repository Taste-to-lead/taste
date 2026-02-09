import { properties, leads, type Property, type InsertProperty, type Lead, type InsertLead } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, ilike, sql } from "drizzle-orm";

export interface IStorage {
  getProperties(filters?: {
    location?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    vibe?: string;
    status?: string;
  }): Promise<Property[]>;
  getProperty(id: number): Promise<Property | undefined>;
  createProperty(data: InsertProperty): Promise<Property>;
  updateProperty(id: number, data: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: number): Promise<boolean>;
  createLead(data: InsertLead): Promise<Lead>;
  getLeads(): Promise<Lead[]>;
}

export class DatabaseStorage implements IStorage {
  async getProperties(filters?: {
    location?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    vibe?: string;
    status?: string;
  }): Promise<Property[]> {
    const conditions = [];

    if (filters?.location) {
      conditions.push(ilike(properties.location, `%${filters.location}%`));
    }
    if (filters?.minPrice) {
      conditions.push(gte(properties.price, filters.minPrice));
    }
    if (filters?.maxPrice) {
      conditions.push(lte(properties.price, filters.maxPrice));
    }
    if (filters?.bedrooms) {
      conditions.push(gte(properties.bedrooms, filters.bedrooms));
    }
    if (filters?.vibe) {
      conditions.push(eq(properties.vibe, filters.vibe));
    }
    if (filters?.status) {
      conditions.push(eq(properties.status, filters.status));
    }

    if (conditions.length > 0) {
      return db.select().from(properties).where(and(...conditions));
    }
    return db.select().from(properties);
  }

  async getProperty(id: number): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property;
  }

  async createProperty(data: InsertProperty): Promise<Property> {
    const [property] = await db.insert(properties).values(data).returning();
    return property;
  }

  async updateProperty(id: number, data: Partial<InsertProperty>): Promise<Property | undefined> {
    const [property] = await db.update(properties).set(data).where(eq(properties.id, id)).returning();
    return property;
  }

  async deleteProperty(id: number): Promise<boolean> {
    const result = await db.delete(properties).where(eq(properties.id, id)).returning();
    return result.length > 0;
  }

  async createLead(data: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(data).returning();
    return lead;
  }

  async getLeads(): Promise<Lead[]> {
    return db.select().from(leads);
  }
}

export const storage = new DatabaseStorage();
