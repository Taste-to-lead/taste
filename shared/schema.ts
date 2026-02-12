import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, json, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const organizations = pgTable("organizations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  logoUrl: text("logo_url"),
  inviteCode: text("invite_code").unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  createdAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export const agents = pgTable("agents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull().default("Premium Agent"),
  role: text("role").notNull().default("agent"),
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  organizationId: integer("organization_id"),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const insertAgentSchema = createInsertSchema(agents);

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

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
  vibe: text("vibe").notNull().default("Purist"),
  vibeTag: text("vibe_tag").notNull().default("Unclassified"),
  sourceUrl: text("source_url"),
  vibeVector: json("vibe_vector"),
  vibeTop: json("vibe_top"),
  vibeRationale: json("vibe_rationale"),
  vibeVersion: text("vibe_version"),
  tags: json("tags").$type<string[]>().notNull().default([]),
  organizationId: integer("organization_id"),
});

export const importJobs = pgTable("import_jobs", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  sourceType: text("source_type").notNull(),
  source: text("source").notNull(),
  status: text("status").notNull().default("queued"),
  total: integer("total").notNull().default(0),
  processed: integer("processed").notNull().default(0),
  succeeded: integer("succeeded").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leads = pgTable("leads", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  propertyId: integer("property_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  agentId: text("agent_id"),
  buyerId: text("buyer_id"),
  buyerVector: json("buyer_vector"),
  listingVector: json("listing_vector"),
  topBuyerVibes: json("top_buyer_vibes"),
  topListingVibes: json("top_listing_vibes"),
  matchScore: integer("match_score").notNull().default(0),
  talkTrack: text("talk_track"),
  avoidList: json("avoid_list"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPropertySchema = createInsertSchema(properties, {
  images: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  createdAt: true,
});

export const insertImportJobSchema = createInsertSchema(importJobs).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;
export type ImportJob = typeof importJobs.$inferSelect;

export const notifications = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  recipientId: text("recipient_id").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  priority: text("priority").notNull(),
  readStatus: boolean("read_status").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const syncRequests = pgTable("sync_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  websiteUrl: text("website_url").notNull(),
  status: text("status").notNull().default("pending"),
  importedCount: integer("imported_count").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSyncRequestSchema = createInsertSchema(syncRequests).omit({
  createdAt: true,
});

export type InsertSyncRequest = z.infer<typeof insertSyncRequestSchema>;
export type SyncRequest = typeof syncRequests.$inferSelect;

export const swipes = pgTable("swipes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text("session_id").notNull(),
  propertyId: integer("property_id").notNull(),
  direction: text("direction").notNull(),
  matchScore: integer("match_score").notNull().default(0),
  dwellMs: integer("dwell_ms").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const buyers = pgTable("buyers", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const swipeEvents = pgTable("swipe_events", {
  id: text("id").primaryKey(),
  buyerId: text("buyer_id").notNull(),
  listingId: integer("listing_id").notNull(),
  action: text("action").notNull(),
  dwellMs: integer("dwell_ms").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSwipeSchema = createInsertSchema(swipes).omit({
  createdAt: true,
});
export const insertBuyerSchema = createInsertSchema(buyers).omit({
  createdAt: true,
});
export const insertSwipeEventSchema = createInsertSchema(swipeEvents).omit({
  createdAt: true,
});

export type InsertSwipe = z.infer<typeof insertSwipeSchema>;
export type Swipe = typeof swipes.$inferSelect;
export type InsertBuyer = z.infer<typeof insertBuyerSchema>;
export type Buyer = typeof buyers.$inferSelect;
export type InsertSwipeEvent = z.infer<typeof insertSwipeEventSchema>;
export type SwipeEvent = typeof swipeEvents.$inferSelect;

export const verificationCodes = pgTable("verification_codes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stagingResults = pgTable("staging_results", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  propertyId: integer("property_id").notNull(),
  vibe: text("vibe").notNull(),
  status: text("status").notNull().default("pending"),
  progressStep: text("progress_step").notNull().default("Analyzing Room"),
  imageUrl: text("image_url"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const stagingJobs = pgTable("staging_jobs", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").notNull(),
  agentId: text("agent_id"),
  buyerId: text("buyer_id"),
  listingId: integer("listing_id"),
  vibeId: text("vibe_id").notNull(),
  roomType: text("room_type").notNull(),
  inputImageUrl: text("input_image_url").notNull(),
  status: text("status").notNull().default("queued"),
  outputImageUrl: text("output_image_url"),
  promptUsed: text("prompt_used").notNull(),
  negativePromptUsed: text("negative_prompt_used").notNull(),
  qualityFlags: json("quality_flags"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const stagingAssets = pgTable("staging_assets", {
  id: text("id").primaryKey(),
  stagingJobId: text("staging_job_id").notNull(),
  vibeId: text("vibe_id").notNull(),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStagingResultSchema = createInsertSchema(stagingResults).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertStagingJobSchema = createInsertSchema(stagingJobs).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertStagingAssetSchema = createInsertSchema(stagingAssets).omit({
  createdAt: true,
});

export type InsertStagingResult = z.infer<typeof insertStagingResultSchema>;
export type StagingResult = typeof stagingResults.$inferSelect;
export type InsertStagingJob = z.infer<typeof insertStagingJobSchema>;
export type StagingJob = typeof stagingJobs.$inferSelect;
export type InsertStagingAsset = z.infer<typeof insertStagingAssetSchema>;
export type StagingAsset = typeof stagingAssets.$inferSelect;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  inviteCode: z.string().optional(),
});

export const sendVerificationSchema = z.object({
  email: z.string().email(),
});

export const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const swipeSchema = z.object({
  propertyId: z.number(),
  direction: z.enum(["left", "right"]),
  userName: z.string().optional(),
  matchScore: z.number().min(0).max(100),
  matchedTags: z.array(z.string()).optional(),
});
