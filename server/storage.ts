import { properties, leads, notifications, agents, type Property, type InsertProperty, type Lead, type InsertLead, type Notification, type InsertNotification, type Agent, type InsertAgent } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, ilike, desc, sql } from "drizzle-orm";

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
  getNotifications(recipientId: string): Promise<Notification[]>;
  getUnreadNotificationCount(recipientId: string): Promise<number>;
  createNotification(data: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number): Promise<void>;
  markAllNotificationsRead(recipientId: string): Promise<void>;
  getAgentByEmail(email: string): Promise<Agent | undefined>;
  createAgent(data: InsertAgent): Promise<Agent>;
  getAgent(id: number): Promise<Agent | undefined>;
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

  async getNotifications(recipientId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.recipientId, recipientId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationCount(recipientId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.readStatus, false)
      ));
    return result[0]?.count ?? 0;
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(data).returning();
    return notification;
  }

  async markNotificationRead(id: number): Promise<void> {
    await db.update(notifications).set({ readStatus: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(recipientId: string): Promise<void> {
    await db.update(notifications)
      .set({ readStatus: true })
      .where(eq(notifications.recipientId, recipientId));
  }

  async getAgentByEmail(email: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.email, email));
    return agent;
  }

  async createAgent(data: InsertAgent): Promise<Agent> {
    const [agent] = await db.insert(agents).values(data).returning();
    return agent;
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }
}

export const storage = new DatabaseStorage();
