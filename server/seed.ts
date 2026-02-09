import { db } from "./db";
import { properties, agents, organizations } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function seedDatabase() {
  const existingOrgs = await db.select({ count: sql<number>`count(*)` }).from(organizations);
  let freelanceOrgId: number;
  let premiumOrgId: number;

  if (Number(existingOrgs[0].count) === 0) {
    const [freelanceOrg] = await db.insert(organizations).values({
      name: "Public / Freelance",
      subscriptionTier: "free",
      inviteCode: null,
    }).returning();

    const [premiumOrg] = await db.insert(organizations).values({
      name: "Taste Realty Group",
      subscriptionTier: "pro",
      inviteCode: "TASTE-PRO-2025",
    }).returning();

    freelanceOrgId = freelanceOrg.id;
    premiumOrgId = premiumOrg.id;
    console.log("Organizations seeded: Public/Freelance + Taste Realty Group (invite: TASTE-PRO-2025)");
  } else {
    const allOrgs = await db.select().from(organizations);
    const fl = allOrgs.find(o => o.name === "Public / Freelance");
    const pr = allOrgs.find(o => o.name === "Taste Realty Group");
    freelanceOrgId = fl?.id ?? 1;
    premiumOrgId = pr?.id ?? 2;
  }

  const existingAgents = await db.select({ count: sql<number>`count(*)` }).from(agents);
  if (Number(existingAgents[0].count) === 0) {
    const hash = await bcrypt.hash("agent123", 10);
    await db.insert(agents).values({
      email: "agent@taste.com",
      passwordHash: hash,
      name: "Premium Agent",
      role: "agent",
      organizationId: premiumOrgId,
    });
    console.log("Default agent created: agent@taste.com / agent123 (Taste Realty Group)");

    const superHash = await bcrypt.hash("admin123", 10);
    await db.insert(agents).values({
      email: "vinnysladeb@gmail.com",
      passwordHash: superHash,
      name: "Vincent",
      role: "super_admin",
      organizationId: null,
    });
    console.log("Super Admin created: vinnysladeb@gmail.com / admin123");
  } else {
    const superAdmin = await db.select().from(agents).where(eq(agents.email, "vinnysladeb@gmail.com"));
    if (superAdmin.length === 0) {
      const superHash = await bcrypt.hash("admin123", 10);
      await db.insert(agents).values({
        email: "vinnysladeb@gmail.com",
        passwordHash: superHash,
        name: "Vincent",
        role: "super_admin",
        organizationId: null,
      });
      console.log("Super Admin created: vinnysladeb@gmail.com / admin123");
    }

    const existingAgent = await db.select().from(agents).where(eq(agents.email, "agent@taste.com"));
    if (existingAgent.length > 0 && !existingAgent[0].organizationId) {
      await db.update(agents).set({ organizationId: premiumOrgId }).where(eq(agents.email, "agent@taste.com"));
      console.log("Assigned existing agent to Taste Realty Group");
    }
  }

  const existing = await db.select({ count: sql<number>`count(*)` }).from(properties);
  if (Number(existing[0].count) > 0) {
    const unassigned = await db.select().from(properties).where(sql`${properties.organizationId} IS NULL`);
    if (unassigned.length > 0) {
      await db.update(properties).set({ organizationId: premiumOrgId }).where(sql`${properties.organizationId} IS NULL`);
      console.log(`Assigned ${unassigned.length} existing properties to Taste Realty Group`);
    }
    return;
  }

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
      tags: ["Natural Light", "Smart Home", "Remote Ready"],
      organizationId: premiumOrgId,
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
      tags: ["Fenced Yard", "Chef Kitchen", "Quiet Street"],
      organizationId: premiumOrgId,
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
      tags: ["Natural Light", "Remote Ready", "HOA Free"],
      organizationId: premiumOrgId,
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
      tags: ["Smart Home", "Natural Light", "Quiet Street"],
      organizationId: premiumOrgId,
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
      tags: ["Chef Kitchen", "Quiet Street", "HOA Free"],
      organizationId: premiumOrgId,
    },
  ];

  await db.insert(properties).values(seedProperties);
  console.log("Database seeded with 5 properties (Taste Realty Group)");
}
