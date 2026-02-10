import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import { insertPropertySchema, insertLeadSchema, swipeSchema, loginSchema, signupSchema } from "@shared/schema";
import { sendEmail, buildMatchEmailHtml } from "./notificationService";
import { classifyPropertyImage } from "./geminiTagger";
import bcrypt from "bcryptjs";

const SUPER_ADMIN_EMAIL = "vinnysladeb@gmail.com";

function isSuperAdmin(req: Request): boolean {
  return req.session?.agentEmail === SUPER_ADMIN_EMAIL;
}

function requireAgent(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.agentId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use((req, res, next) => {
    const hostname = req.hostname || req.headers.host || "";
    if (hostname.includes("replit.app") || hostname.includes("replit.dev")) {
      const redirectUrl = `https://tastetolead.com${req.originalUrl}`;
      return res.redirect(301, redirectUrl);
    }
    next();
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const agent = await storage.getAgentByEmail(parsed.email);
      if (!agent) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(parsed.password, agent.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      req.session.agentId = agent.id;
      req.session.agentEmail = agent.email;
      req.session.agentName = agent.name;
      req.session.organizationId = agent.organizationId;
      req.session.role = agent.role;

      let orgName: string | undefined;
      if (agent.organizationId) {
        const org = await storage.getOrganization(agent.organizationId);
        orgName = org?.name;
      }

      res.json({
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        subscriptionTier: agent.subscriptionTier,
        organizationId: agent.organizationId,
        organizationName: orgName,
        isSuperAdmin: agent.email === SUPER_ADMIN_EMAIL,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const parsed = signupSchema.parse(req.body);

      const existing = await storage.getAgentByEmail(parsed.email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      let organizationId: number | null = null;

      if (parsed.inviteCode && parsed.inviteCode.trim() !== "") {
        const org = await storage.getOrganizationByInviteCode(parsed.inviteCode.trim());
        if (!org) {
          return res.status(400).json({ message: "Invalid invite code" });
        }
        organizationId = org.id;
      } else {
        const allOrgs = await storage.getAllOrganizations();
        const freelanceOrg = allOrgs.find(o => o.name === "Public / Freelance");
        if (freelanceOrg) {
          organizationId = freelanceOrg.id;
        }
      }

      const passwordHash = await bcrypt.hash(parsed.password, 10);
      const role = parsed.email === SUPER_ADMIN_EMAIL ? "super_admin" : "agent";

      const agent = await storage.createAgent({
        email: parsed.email,
        passwordHash,
        name: parsed.name,
        role,
        organizationId,
      });

      req.session.agentId = agent.id;
      req.session.agentEmail = agent.email;
      req.session.agentName = agent.name;
      req.session.organizationId = agent.organizationId;
      req.session.role = agent.role;

      let orgName: string | undefined;
      if (agent.organizationId) {
        const org = await storage.getOrganization(agent.organizationId);
        orgName = org?.name;
      }

      res.status(201).json({
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        subscriptionTier: agent.subscriptionTier,
        organizationId: agent.organizationId,
        organizationName: orgName,
        isSuperAdmin: agent.email === SUPER_ADMIN_EMAIL,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.agentId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    let orgName: string | undefined;
    if (req.session.organizationId) {
      const org = await storage.getOrganization(req.session.organizationId);
      orgName = org?.name;
    }

    const currentAgent = await storage.getAgent(req.session.agentId);

    res.json({
      id: req.session.agentId,
      email: req.session.agentEmail,
      name: req.session.agentName,
      role: req.session.role,
      subscriptionTier: currentAgent?.subscriptionTier ?? "free",
      organizationId: req.session.organizationId,
      organizationName: orgName,
      isSuperAdmin: req.session.agentEmail === SUPER_ADMIN_EMAIL,
    });
  });

  app.get("/api/properties", async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.location) filters.location = req.query.location as string;
      if (req.query.minPrice) filters.minPrice = parseFloat(req.query.minPrice as string);
      if (req.query.maxPrice) filters.maxPrice = parseFloat(req.query.maxPrice as string);
      if (req.query.bedrooms) filters.bedrooms = parseInt(req.query.bedrooms as string);
      if (req.query.vibe) filters.vibe = req.query.vibe as string;
      if (req.query.status) filters.status = req.query.status as string;

      if (req.session?.agentId && !isSuperAdmin(req)) {
        if (req.session.organizationId) {
          filters.organizationId = req.session.organizationId;
        }
      }

      let results = await storage.getProperties(
        Object.keys(filters).length > 0 ? filters as any : undefined
      );

      const tasteProfile = req.session?.tasteProfile;
      if (tasteProfile && Object.keys(tasteProfile).length > 0 && !req.session?.agentId) {
        const totalSwipes = Object.values(tasteProfile).reduce((a, b) => a + b, 0);
        results = results.map((p) => {
          const tag = p.vibeTag || "Unclassified";
          const score = tag !== "Unclassified" && tasteProfile[tag]
            ? (tasteProfile[tag] / totalSwipes) * 100
            : 0;
          return { ...p, tasteScore: Math.round(score) };
        }).sort((a, b) => (b as any).tasteScore - (a as any).tasteScore);
      }

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(parseInt(req.params.id));
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/properties", requireAgent, async (req, res) => {
    try {
      const parsed = insertPropertySchema.parse(req.body);
      parsed.organizationId = req.session.organizationId ?? null;

      const imageUrl = parsed.images && parsed.images.length > 0 ? parsed.images[0] : null;
      const tagSource = imageUrl || parsed.vibe || "modern";
      const vibeTag = await classifyPropertyImage(tagSource);
      parsed.vibeTag = vibeTag;

      const property = await storage.createProperty(parsed);
      res.status(201).json(property);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/properties/:id", requireAgent, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProperty(id);
      if (!existing) {
        return res.status(404).json({ message: "Property not found" });
      }
      if (!isSuperAdmin(req) && existing.organizationId !== req.session.organizationId) {
        return res.status(403).json({ message: "Forbidden: property belongs to another organization" });
      }
      const property = await storage.updateProperty(id, req.body);
      res.json(property);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/properties/:id", requireAgent, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProperty(id);
      if (!existing) {
        return res.status(404).json({ message: "Property not found" });
      }
      if (!isSuperAdmin(req) && existing.organizationId !== req.session.organizationId) {
        return res.status(403).json({ message: "Forbidden: property belongs to another organization" });
      }
      const deleted = await storage.deleteProperty(id);
      if (!deleted) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const parsed = insertLeadSchema.parse(req.body);
      const property = await storage.getProperty(parsed.propertyId as number);
      if (!property) {
        return res.status(400).json({ message: "Invalid property ID" });
      }
      const lead = await storage.createLead(parsed);
      res.status(201).json(lead);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/leads", requireAgent, async (req, res) => {
    try {
      const orgId = isSuperAdmin(req) ? undefined : req.session.organizationId ?? undefined;
      const leads = await storage.getLeads(orgId);
      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/taste-profile", (req, res) => {
    const profile = req.session.tasteProfile || {};
    res.json({ tasteProfile: profile });
  });

  app.post("/api/swipe", async (req, res) => {
    try {
      const parsed = swipeSchema.parse(req.body);
      const property = await storage.getProperty(parsed.propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      if (parsed.direction === "right" && property.vibeTag && property.vibeTag !== "Unclassified") {
        if (!req.session.tasteProfile) {
          req.session.tasteProfile = {};
        }
        const tag = property.vibeTag;
        req.session.tasteProfile[tag] = (req.session.tasteProfile[tag] || 0) + 1;
      }

      let notification = null;

      if (parsed.direction === "right" && parsed.matchScore > 85) {
        const isCritical = parsed.matchScore > 95;
        const priority = isCritical ? "critical" : "high";
        const userName = parsed.userName || "A potential buyer";
        const matchedTags = parsed.matchedTags || [];

        const tagText = matchedTags.length > 0
          ? ` | Matched on: ${matchedTags.join(", ")}`
          : "";

        notification = await storage.createNotification({
          recipientId: property.agentId,
          type: "match",
          content: JSON.stringify({
            userName,
            propertyId: property.id,
            propertyTitle: property.title,
            propertyLocation: property.location,
            propertyPrice: property.price,
            matchScore: parsed.matchScore,
            matchedTags,
            message: `${userName} swiped right on "${property.title}" (${parsed.matchScore}% match)${tagText}`,
          }),
          priority,
          readStatus: false,
        });

        if (isCritical) {
          const emailHtml = buildMatchEmailHtml({
            userName,
            propertyTitle: property.title,
            propertyLocation: property.location,
            matchScore: parsed.matchScore,
            matchedTags,
            price: property.price,
          });
          sendEmail(
            "agent@taste.com",
            `Taste | Hot Lead Alert: ${userName} matched ${property.title}`,
            emailHtml
          );
        }
      }

      res.json({ success: true, notification });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/notifications", requireAgent, async (req, res) => {
    try {
      const recipientId = (req.query.recipientId as string) || "agent-1";
      const notifications = await storage.getNotifications(recipientId);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/notifications/count", requireAgent, async (req, res) => {
    try {
      const recipientId = (req.query.recipientId as string) || "agent-1";
      const count = await storage.getUnreadNotificationCount(recipientId);
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/notifications/:id/read", requireAgent, async (req, res) => {
    try {
      await storage.markNotificationRead(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/notifications/read-all", requireAgent, async (req, res) => {
    try {
      const recipientId = (req.body.recipientId as string) || "agent-1";
      await storage.markAllNotificationsRead(recipientId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/properties/:id/retag", requireAgent, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProperty(id);
      if (!existing) {
        return res.status(404).json({ message: "Property not found" });
      }
      if (!isSuperAdmin(req) && existing.organizationId !== req.session.organizationId) {
        return res.status(403).json({ message: "Forbidden: property belongs to another organization" });
      }
      const imageUrl = existing.images && existing.images.length > 0 ? existing.images[0] : null;
      const tagSource = imageUrl || existing.vibe || "modern";
      const vibeTag = await classifyPropertyImage(tagSource);
      const updated = await storage.updateProperty(id, { vibeTag });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sync-requests", requireAgent, async (req, res) => {
    try {
      const agent = await storage.getAgent(req.session.agentId);
      if (!agent || (agent.subscriptionTier !== "premium" && agent.email !== SUPER_ADMIN_EMAIL)) {
        return res.status(403).json({ message: "Premium subscription required" });
      }

      const { websiteUrl } = req.body;
      if (!websiteUrl || typeof websiteUrl !== "string" || !websiteUrl.startsWith("http")) {
        return res.status(400).json({ message: "A valid website URL is required" });
      }

      const syncRequest = await storage.createSyncRequest({
        userId: req.session.agentId,
        websiteUrl,
        status: "pending",
      });
      res.status(201).json(syncRequest);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/sync-requests", requireAgent, async (req, res) => {
    try {
      const requests = await storage.getSyncRequests(req.session.agentId);
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/organizations", requireAgent, async (req, res) => {
    try {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: "Super Admin access required" });
      }
      const orgs = await storage.getAllOrganizations();
      res.json(orgs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/webhooks/lemon-squeezy", async (req, res) => {
    try {
      const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
      if (!secret) {
        console.error("[LemonSqueezy] LEMONSQUEEZY_WEBHOOK_SECRET not set");
        return res.status(500).json({ message: "Webhook secret not configured" });
      }

      const signature = req.headers["x-signature"] as string;
      if (!signature) {
        return res.status(401).json({ message: "Missing signature" });
      }

      const rawBody = req.rawBody;
      if (!rawBody) {
        return res.status(400).json({ message: "Missing request body" });
      }

      const hmac = crypto.createHmac("sha256", secret);
      const digest = hmac.update(rawBody as Buffer).digest("hex");

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        console.warn("[LemonSqueezy] Invalid webhook signature");
        return res.status(401).json({ message: "Invalid signature" });
      }

      const event = req.body;
      const eventName = event?.meta?.event_name;

      console.log(`[LemonSqueezy] Received event: ${eventName}`);

      if (eventName === "order_created") {
        const userEmail = event?.data?.attributes?.user_email
          || event?.meta?.custom_data?.user_email;

        if (!userEmail) {
          console.warn("[LemonSqueezy] No user_email in order_created payload");
          return res.status(200).json({ message: "No user email found, skipping" });
        }

        console.log(`[LemonSqueezy] Processing upgrade for: ${userEmail}`);

        const agent = await storage.getAgentByEmail(userEmail);
        if (!agent) {
          console.warn(`[LemonSqueezy] No agent found for email: ${userEmail}`);
          return res.status(200).json({ message: "Agent not found, skipping" });
        }

        const premiumOrg = await storage.getOrganizationByInviteCode("TASTE-PRO-2025");
        const updateData: any = { subscriptionTier: "premium" };
        if (premiumOrg) {
          updateData.organizationId = premiumOrg.id;
        }

        await storage.updateAgentByEmail(userEmail, updateData);
        console.log(`[LemonSqueezy] Upgraded ${userEmail} to premium`);

        return res.status(200).json({ message: "Upgrade processed" });
      }

      res.status(200).json({ message: "Event received" });
    } catch (error: any) {
      console.error(`[LemonSqueezy] Webhook error: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
