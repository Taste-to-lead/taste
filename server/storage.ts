import { properties, leads, notifications, agents, organizations, syncRequests, swipes, stagingResults, importJobs, buyers, swipeEvents, type Property, type InsertProperty, type Lead, type InsertLead, type Notification, type InsertNotification, type Agent, type InsertAgent, type Organization, type InsertOrganization, type SyncRequest, type InsertSyncRequest, type Swipe, type InsertSwipe, type StagingResult, type InsertStagingResult, type ImportJob, type InsertImportJob, type Buyer, type InsertBuyer, type SwipeEvent, type InsertSwipeEvent } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, ilike, desc, sql, inArray } from "drizzle-orm";

export interface IStorage {
  getProperties(filters?: {
    location?: string;
    state?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    vibe?: string;
    status?: string;
    organizationId?: number;
  }): Promise<Property[]>;
  getProperty(id: number): Promise<Property | undefined>;
  createProperty(data: InsertProperty): Promise<Property>;
  updateProperty(id: number, data: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: number): Promise<boolean>;
  createLead(data: InsertLead): Promise<Lead>;
  getLeads(organizationId?: number): Promise<Lead[]>;
  getNotifications(recipientId: string): Promise<Notification[]>;
  getUnreadNotificationCount(recipientId: string): Promise<number>;
  createNotification(data: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number): Promise<void>;
  markAllNotificationsRead(recipientId: string): Promise<void>;
  getAgentByEmail(email: string): Promise<Agent | undefined>;
  createAgent(data: InsertAgent): Promise<Agent>;
  getAgent(id: number): Promise<Agent | undefined>;
  updateAgentByEmail(email: string, data: Partial<InsertAgent>): Promise<Agent | undefined>;
  createOrganization(data: InsertOrganization): Promise<Organization>;
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationByInviteCode(code: string): Promise<Organization | undefined>;
  getAllOrganizations(): Promise<Organization[]>;
  createSyncRequest(data: InsertSyncRequest): Promise<SyncRequest>;
  updateSyncRequest(id: number, data: Partial<InsertSyncRequest>): Promise<SyncRequest | undefined>;
  getSyncRequests(userId: number): Promise<SyncRequest[]>;
  getAllAgents(): Promise<Agent[]>;
  getAllProperties(): Promise<Property[]>;
  updateAgent(id: number, data: Partial<InsertAgent>): Promise<Agent | undefined>;
  createSwipe(data: InsertSwipe): Promise<Swipe>;
  getSwipesBySession(sessionId: string): Promise<Swipe[]>;
  getRightSwipesBySession(sessionId: string): Promise<Swipe[]>;
  getSwipedPropertyIdsBySession(sessionId: string): Promise<number[]>;
  createStagingResult(data: InsertStagingResult): Promise<StagingResult>;
  getStagingResult(id: number): Promise<StagingResult | undefined>;
  updateStagingResult(id: number, data: Partial<InsertStagingResult>): Promise<StagingResult | undefined>;
  createImportJob(data: InsertImportJob): Promise<ImportJob>;
  getImportJob(id: string): Promise<ImportJob | undefined>;
  updateImportJob(id: string, data: Partial<InsertImportJob>): Promise<ImportJob | undefined>;
  getPropertiesByAgent(agentId: string): Promise<Property[]>;
  getPropertyByAgentAndSourceUrl(agentId: string, sourceUrl: string): Promise<Property | undefined>;
  getPropertyByAgentAndLocation(agentId: string, location: string): Promise<Property | undefined>;
  createBuyer(data: InsertBuyer): Promise<Buyer>;
  getBuyer(id: string): Promise<Buyer | undefined>;
  createSwipeEvent(data: InsertSwipeEvent): Promise<SwipeEvent>;
  getSwipeEventsByBuyer(buyerId: string): Promise<SwipeEvent[]>;
  getPropertiesByIds(ids: number[]): Promise<Property[]>;
  getLeadByBuyerAndProperty(buyerId: string, propertyId: number): Promise<Lead | undefined>;
  getAgentLeads(agentId: string): Promise<Lead[]>;
}

export class DatabaseStorage implements IStorage {
  async getProperties(filters?: {
    location?: string;
    state?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    vibe?: string;
    status?: string;
    organizationId?: number;
  }): Promise<Property[]> {
    const conditions = [];

    if (filters?.location) {
      conditions.push(ilike(properties.location, `%${filters.location}%`));
    }
    if (filters?.state) {
      conditions.push(ilike(properties.location, `%${filters.state}%`));
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
    if (filters?.organizationId) {
      conditions.push(eq(properties.organizationId, filters.organizationId));
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

  async getLeads(organizationId?: number): Promise<Lead[]> {
    if (organizationId) {
      return db.select().from(leads).where(
        sql`exists (select 1 from ${properties} p where p.id = ${leads.propertyId} and p.organization_id = ${organizationId})`
      );
    }
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

  async updateAgentByEmail(email: string, data: Partial<InsertAgent>): Promise<Agent | undefined> {
    const [agent] = await db.update(agents).set(data).where(eq(agents.email, email)).returning();
    return agent;
  }

  async createOrganization(data: InsertOrganization): Promise<Organization> {
    const [org] = await db.insert(organizations).values(data).returning();
    return org;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getOrganizationByInviteCode(code: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.inviteCode, code));
    return org;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return db.select().from(organizations);
  }

  async createSyncRequest(data: InsertSyncRequest): Promise<SyncRequest> {
    const [request] = await db.insert(syncRequests).values(data).returning();
    return request;
  }

  async updateSyncRequest(id: number, data: Partial<InsertSyncRequest>): Promise<SyncRequest | undefined> {
    const [updated] = await db.update(syncRequests).set(data).where(eq(syncRequests.id, id)).returning();
    return updated;
  }

  async getSyncRequests(userId: number): Promise<SyncRequest[]> {
    return db.select().from(syncRequests)
      .where(eq(syncRequests.userId, userId))
      .orderBy(desc(syncRequests.createdAt));
  }

  async getAllAgents(): Promise<Agent[]> {
    return db.select().from(agents);
  }

  async getAllProperties(): Promise<Property[]> {
    return db.select().from(properties);
  }

  async updateAgent(id: number, data: Partial<InsertAgent>): Promise<Agent | undefined> {
    const [agent] = await db.update(agents).set(data).where(eq(agents.id, id)).returning();
    return agent;
  }

  async createSwipe(data: InsertSwipe): Promise<Swipe> {
    const [swipe] = await db.insert(swipes).values(data).returning();
    return swipe;
  }

  async getSwipesBySession(sessionId: string): Promise<Swipe[]> {
    return db.select().from(swipes)
      .where(eq(swipes.sessionId, sessionId))
      .orderBy(desc(swipes.createdAt));
  }

  async getRightSwipesBySession(sessionId: string): Promise<Swipe[]> {
    return db.select().from(swipes)
      .where(and(eq(swipes.sessionId, sessionId), eq(swipes.direction, "right")))
      .orderBy(desc(swipes.createdAt));
  }

  async getSwipedPropertyIdsBySession(sessionId: string): Promise<number[]> {
    const rows = await db.select({ propertyId: swipes.propertyId })
      .from(swipes)
      .where(eq(swipes.sessionId, sessionId));
    return rows.map(r => r.propertyId);
  }

  async createStagingResult(data: InsertStagingResult): Promise<StagingResult> {
    const [result] = await db.insert(stagingResults).values(data).returning();
    return result;
  }

  async getStagingResult(id: number): Promise<StagingResult | undefined> {
    const [result] = await db.select().from(stagingResults).where(eq(stagingResults.id, id));
    return result;
  }

  async updateStagingResult(id: number, data: Partial<InsertStagingResult>): Promise<StagingResult | undefined> {
    const [updated] = await db.update(stagingResults).set(data).where(eq(stagingResults.id, id)).returning();
    return updated;
  }

  async createImportJob(data: InsertImportJob): Promise<ImportJob> {
    const [job] = await db.insert(importJobs).values(data).returning();
    return job;
  }

  async getImportJob(id: string): Promise<ImportJob | undefined> {
    const [job] = await db.select().from(importJobs).where(eq(importJobs.id, id));
    return job;
  }

  async updateImportJob(id: string, data: Partial<InsertImportJob>): Promise<ImportJob | undefined> {
    const [updated] = await db
      .update(importJobs)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(importJobs.id, id))
      .returning();
    return updated;
  }

  async getPropertiesByAgent(agentId: string): Promise<Property[]> {
    return db.select().from(properties).where(eq(properties.agentId, agentId)).orderBy(desc(properties.id));
  }

  async getPropertyByAgentAndSourceUrl(agentId: string, sourceUrl: string): Promise<Property | undefined> {
    const [property] = await db
      .select()
      .from(properties)
      .where(and(eq(properties.agentId, agentId), eq(properties.sourceUrl, sourceUrl)));
    return property;
  }

  async getPropertyByAgentAndLocation(agentId: string, location: string): Promise<Property | undefined> {
    const [property] = await db
      .select()
      .from(properties)
      .where(and(eq(properties.agentId, agentId), eq(properties.location, location)));
    return property;
  }

  async createBuyer(data: InsertBuyer): Promise<Buyer> {
    const [buyer] = await db.insert(buyers).values(data).returning();
    return buyer;
  }

  async getBuyer(id: string): Promise<Buyer | undefined> {
    const [buyer] = await db.select().from(buyers).where(eq(buyers.id, id));
    return buyer;
  }

  async createSwipeEvent(data: InsertSwipeEvent): Promise<SwipeEvent> {
    const [event] = await db.insert(swipeEvents).values(data).returning();
    return event;
  }

  async getSwipeEventsByBuyer(buyerId: string): Promise<SwipeEvent[]> {
    return db
      .select()
      .from(swipeEvents)
      .where(eq(swipeEvents.buyerId, buyerId))
      .orderBy(desc(swipeEvents.createdAt));
  }

  async getPropertiesByIds(ids: number[]): Promise<Property[]> {
    if (ids.length === 0) return [];
    return db.select().from(properties).where(inArray(properties.id, ids));
  }

  async getLeadByBuyerAndProperty(buyerId: string, propertyId: number): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.buyerId, buyerId), eq(leads.propertyId, propertyId)));
    return lead;
  }

  async getAgentLeads(agentId: string): Promise<Lead[]> {
    return db
      .select()
      .from(leads)
      .where(eq(leads.agentId, agentId))
      .orderBy(desc(leads.matchScore), desc(leads.createdAt));
  }
}

export const storage = new DatabaseStorage();
