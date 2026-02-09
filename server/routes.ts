import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPropertySchema, insertLeadSchema, swipeSchema, loginSchema } from "@shared/schema";
import { sendEmail, buildMatchEmailHtml } from "./notificationService";
import bcrypt from "bcryptjs";

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
      res.json({ id: agent.id, email: agent.email, name: agent.name });
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

  app.get("/api/auth/me", (req, res) => {
    if (!req.session?.agentId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json({
      id: req.session.agentId,
      email: req.session.agentEmail,
      name: req.session.agentName,
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

      const properties = await storage.getProperties(
        Object.keys(filters).length > 0 ? filters : undefined
      );
      res.json(properties);
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
      const property = await storage.updateProperty(id, req.body);
      res.json(property);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/properties/:id", requireAgent, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
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
      const leads = await storage.getLeads();
      res.json(leads);
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

  return httpServer;
}
