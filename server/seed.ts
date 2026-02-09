import { db } from "./db";
import { properties } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existing = await db.select({ count: sql<number>`count(*)` }).from(properties);
  if (existing[0].count > 0) return;

  const seedProperties = [
    {
      title: "Skyline Penthouse Suite",
      description: "Breathtaking penthouse with panoramic city views from floor-to-ceiling windows. Features marble floors, designer kitchen, and a private terrace perfect for entertaining. Located in the heart of Manhattan's most exclusive neighborhood.",
      price: 4500000,
      bedrooms: 3,
      bathrooms: 3,
      sqft: 3200,
      location: "Manhattan, NY",
      images: ["/images/property-1.png", "/images/property-1b.png", "/images/property-1c.png"],
      agentId: "agent-1",
      status: "active",
      vibe: "modern",
    },
    {
      title: "Mediterranean Villa Estate",
      description: "Stunning Mediterranean-inspired villa with a resort-style pool, lush gardens, and terracotta accents. This timeless estate offers the perfect blend of luxury and comfort with hand-crafted details throughout.",
      price: 3200000,
      bedrooms: 5,
      bathrooms: 4,
      sqft: 4800,
      location: "Beverly Hills, CA",
      images: ["/images/property-2.png", "/images/property-2b.png", "/images/property-2c.png"],
      agentId: "agent-1",
      status: "active",
      vibe: "classic",
    },
    {
      title: "Urban Industrial Loft",
      description: "Converted warehouse loft featuring exposed brick walls, soaring ceilings, and oversized windows flooding the space with natural light. Open floor plan with a chef's kitchen and custom built-ins.",
      price: 1850000,
      bedrooms: 2,
      bathrooms: 2,
      sqft: 2100,
      location: "Brooklyn, NY",
      images: ["/images/property-3.png", "/images/property-3b.png", "/images/property-3c.png"],
      agentId: "agent-1",
      status: "active",
      vibe: "industrial",
    },
    {
      title: "Oceanfront Paradise",
      description: "Wake up to endless ocean views in this architectural masterpiece. Features an infinity pool that merges with the horizon, open-air living spaces, and a private beach access path.",
      price: 6800000,
      bedrooms: 4,
      bathrooms: 5,
      sqft: 5200,
      location: "Miami Beach, FL",
      images: ["/images/property-4.png", "/images/property-4b.png", "/images/property-4c.png"],
      agentId: "agent-1",
      status: "active",
      vibe: "modern",
    },
    {
      title: "Historic Brownstone Gem",
      description: "Beautifully renovated brownstone blending original architectural details with modern amenities. Original hardwood floors, ornate fireplaces, and a chef's kitchen with premium appliances.",
      price: 2400000,
      bedrooms: 4,
      bathrooms: 3,
      sqft: 3600,
      location: "Manhattan, NY",
      images: ["/images/property-5.png", "/images/property-5b.png", "/images/property-5c.png"],
      agentId: "agent-1",
      status: "active",
      vibe: "classic",
    },
  ];

  await db.insert(properties).values(seedProperties);
  console.log("Database seeded with 5 properties");
}
