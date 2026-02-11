import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import path from "path";
import crypto from "crypto";
import { storage } from "./storage";
import { db } from "./db";
import { insertPropertySchema, insertLeadSchema, swipeSchema, loginSchema, signupSchema, sendVerificationSchema, verifyCodeSchema, verificationCodes } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import { sendEmail, buildMatchEmailHtml } from "./notificationService";
import { classifyPropertyImage } from "./geminiTagger";
import { importFromUrl } from "./webScraper";
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

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.agentId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!req.session?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {


  app.get("/about", (_req, res) => {
    res.sendFile(path.resolve("client/public/about.html"));
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.parse(req.body);
      let agent = await storage.getAgentByEmail(parsed.email);
      if (!agent) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(parsed.password, agent.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (agent.email === SUPER_ADMIN_EMAIL && !agent.isAdmin) {
        const updated = await storage.updateAgent(agent.id, { isAdmin: true } as any);
        if (updated) agent = updated;
      }

      req.session.agentId = agent.id;
      req.session.agentEmail = agent.email;
      req.session.agentName = agent.name;
      req.session.organizationId = agent.organizationId;
      req.session.role = agent.role;
      req.session.isAdmin = agent.isAdmin;

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
        isAdmin: agent.isAdmin,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/send-verification", async (req, res) => {
    try {
      const parsed = sendVerificationSchema.parse(req.body);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.insert(verificationCodes).values({
        email: parsed.email,
        code,
        expiresAt,
      });

      await sendEmail(
        parsed.email,
        "Your Taste Verification Code",
        `<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #b8860b;">Taste</h2>
          <p>Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 16px 0;">${code}</div>
          <p style="color: #666; font-size: 13px;">This code expires in 10 minutes.</p>
        </div>`
      );

      console.log(`[Auth] Verification code sent to ${parsed.email}: ${code}`);
      res.json({ success: true, message: "Verification code sent" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/verify-code", async (req, res) => {
    try {
      const parsed = verifyCodeSchema.parse(req.body);

      const records = await db.select().from(verificationCodes).where(
        and(
          eq(verificationCodes.email, parsed.email),
          eq(verificationCodes.code, parsed.code),
          eq(verificationCodes.used, false),
          gt(verificationCodes.expiresAt, new Date())
        )
      );

      if (records.length === 0) {
        return res.status(400).json({ message: "Invalid or expired verification code" });
      }

      await db.update(verificationCodes)
        .set({ used: true })
        .where(eq(verificationCodes.id, records[0].id));

      req.session.emailVerified = parsed.email;
      res.json({ success: true, verified: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const parsed = signupSchema.parse(req.body);

      if (req.session.emailVerified !== parsed.email) {
        return res.status(403).json({ message: "Please verify your email before signing up" });
      }

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
      isAdmin: currentAgent?.isAdmin ?? false,
    });
  });

  app.get("/api/properties", async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.location) filters.location = req.query.location as string;
      if (req.query.state && req.query.state !== "Anywhere") filters.state = req.query.state as string;
      if (req.query.minPrice) filters.minPrice = parseFloat(req.query.minPrice as string);
      if (req.query.maxPrice) filters.maxPrice = parseFloat(req.query.maxPrice as string);
      if (req.query.bedrooms) filters.bedrooms = parseInt(req.query.bedrooms as string);
      if (req.query.vibe && req.query.vibe !== "all") filters.vibe = req.query.vibe as string;
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

  app.post("/api/consumer/contact", (req, res) => {
    const { contact } = req.body;
    if (!contact || typeof contact !== "string" || contact.trim().length < 3) {
      return res.status(400).json({ message: "Please provide a valid email or phone number" });
    }
    req.session.consumerContact = contact.trim();
    res.json({ success: true });
  });

  app.get("/api/consumer/contact", (req, res) => {
    res.json({ contact: req.session.consumerContact || null });
  });

  app.get("/api/user/stats", async (req, res) => {
    try {
      const sessionId = req.sessionID || "anonymous";
      const rightSwipes = await storage.getRightSwipesBySession(sessionId);
      const swipedPropertyIds = rightSwipes.map(s => s.propertyId);

      const vibeCounts: Record<string, number> = {};
      let totalTagged = 0;

      for (const swipe of rightSwipes) {
        const property = await storage.getProperty(swipe.propertyId);
        if (property?.vibeTag && property.vibeTag !== "Unclassified") {
          vibeCounts[property.vibeTag] = (vibeCounts[property.vibeTag] || 0) + 1;
          totalTagged++;
        }
      }

      const vibePercentages = Object.entries(vibeCounts)
        .map(([vibe, count]) => ({
          vibe,
          count,
          percentage: totalTagged > 0 ? Math.round((count / totalTagged) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count);

      const topVibe = vibePercentages[0]?.vibe || null;

      let topPicks: any[] = [];
      if (topVibe) {
        const allProperties = await storage.getProperties({ status: "active" });
        topPicks = allProperties
          .filter(p => p.vibeTag === topVibe && !swipedPropertyIds.includes(p.id))
          .slice(0, 6);
      }

      const savedHomes: any[] = [];
      for (const id of swipedPropertyIds) {
        const property = await storage.getProperty(id);
        if (property) savedHomes.push(property);
      }

      res.json({
        vibePercentages,
        topVibe,
        topPicks,
        savedHomes,
        totalSwipes: rightSwipes.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/swipe", async (req, res) => {
    try {
      const parsed = swipeSchema.parse(req.body);
      const property = await storage.getProperty(parsed.propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      const sessionId = req.sessionID || "anonymous";
      await storage.createSwipe({
        sessionId,
        propertyId: parsed.propertyId,
        direction: parsed.direction,
        matchScore: parsed.matchScore,
      });

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
        importedCount: 0,
      });

      res.status(201).json(syncRequest);

      const agentIdStr = String(agent.id);
      const orgId = agent.organizationId ?? null;
      importFromUrl(syncRequest.id, websiteUrl, agentIdStr, orgId).catch((err) => {
        console.error("[SyncRequest] Background import failed:", err.message);
      });
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

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allAgents = await storage.getAllAgents();
      const users = allAgents.map((a) => ({
        id: a.id,
        email: a.email,
        name: a.name,
        role: a.role,
        subscriptionTier: a.subscriptionTier,
        isAdmin: a.isAdmin,
        organizationId: a.organizationId,
      }));
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/listings", requireAdmin, async (req, res) => {
    try {
      const allProps = await storage.getAllProperties();
      res.json(allProps);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/listing/:id/delete", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProperty(id);
      if (!deleted) {
        return res.status(404).json({ message: "Listing not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/staging-hooks", requireAdmin, async (req, res) => {
    try {
      const { roomDescription } = req.body;
      const archetypes = [
        { name: "Monarch", keywords: "Penthouse, Gold, Marble, Velvet, Crystal, Grand, Opulent", psychology: "Status, Power, Dominance" },
        { name: "Industrialist", keywords: "Loft, Warehouse, Exposed Brick, Concrete, Steel Beams, Raw", psychology: "Authenticity, Strength" },
        { name: "Purist", keywords: "Minimalist, White, Clean Lines, Seamless, Hidden Storage, Zero Clutter", psychology: "Discipline, Clarity, Focus" },
        { name: "Naturalist", keywords: "Sanctuary, Biophilic, Plants, Green, Indoor-Outdoor, Retreat, Wood", psychology: "Grounding, Peace, Wellness" },
        { name: "Futurist", keywords: "Smart Home, Tech, Neon, LED, Glass, Chrome, Sleek, Automated", psychology: "Innovation, Speed, Efficiency" },
        { name: "Curator", keywords: "Art, Gallery, Eclectic, Bold, Color, Statement, Unique, Mural", psychology: "Expression, Storytelling, Uniqueness" },
        { name: "Nomad", keywords: "Boho, Eclectic, Travel, Collected, Rugs, Texture, Earth Tones, Global", psychology: "Freedom, Warmth, Experience" },
        { name: "Classicist", keywords: "Historic, Traditional, Estate, Molding, Library, Wood Paneling, Timeless", psychology: "Legacy, History, Respect" },
      ];

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        const fallbackHooks = archetypes.map(a => ({
          archetype: a.name,
          hook: `Experience this space reimagined through the ${a.name} lens — where ${a.psychology.toLowerCase()} meets inspired design.`,
        }));
        return res.json({ hooks: fallbackHooks });
      }

      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `You are a luxury real estate copywriter. Generate a short, compelling "Selling Hook" (1-2 sentences max) for each of these 8 interior design archetypes applied to a room.${roomDescription ? ` The room is described as: "${roomDescription}".` : ""} 

For each archetype, write a hook that would make a buyer emotionally connect with the staged version.

Return ONLY a valid JSON array with exactly 8 objects, each with "archetype" and "hook" keys. No markdown, no code fences.

The 8 archetypes:
${archetypes.map(a => `- ${a.name}: ${a.keywords}. Psychology: ${a.psychology}`).join("\n")}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const hooks = JSON.parse(jsonMatch[0]);
          if (Array.isArray(hooks) && hooks.length > 0 && hooks[0].archetype && hooks[0].hook) {
            return res.json({ hooks });
          }
        } catch {
          console.warn("[StagingHooks] Failed to parse Gemini JSON, using fallbacks");
        }
      }

      const fallbackHooks = archetypes.map(a => ({
        archetype: a.name,
        hook: `Experience this space reimagined through the ${a.name} lens — where ${a.psychology.toLowerCase()} meets inspired design.`,
      }));
      res.json({ hooks: fallbackHooks });
    } catch (error: any) {
      console.error("[StagingHooks] Error:", error.message);
      res.status(500).json({ message: "Failed to generate selling hooks" });
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
