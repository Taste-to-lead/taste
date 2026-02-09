import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPropertySchema, insertLeadSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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

  app.post("/api/properties", async (req, res) => {
    try {
      const parsed = insertPropertySchema.parse(req.body);
      const property = await storage.createProperty(parsed);
      res.status(201).json(property);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/properties/:id", async (req, res) => {
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

  app.delete("/api/properties/:id", async (req, res) => {
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
      const property = await storage.getProperty(parsed.propertyId);
      if (!property) {
        return res.status(400).json({ message: "Invalid property ID" });
      }
      const lead = await storage.createLead(parsed);
      res.status(201).json(lead);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/leads", async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
