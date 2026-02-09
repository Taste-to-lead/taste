# Taste - Real Estate Discovery & Agent Console (Multi-Tenant SaaS)

## Overview
A full-stack multi-tenant real estate SaaS platform with two distinct experiences:
1. **Agent Console** (Command Center) - Property CRUD, stats, lead management, real-time notification feed
2. **Consumer App** (Taste) - Tinder-style property swipe discovery with onboarding wizard

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, Framer Motion, shadcn/ui, wouter routing
- **Backend**: Express.js, PostgreSQL, Drizzle ORM, Nodemailer
- **Auth**: Session-based (express-session + bcryptjs)
- **Theme**: "Midnight Luxury" dark mode with gold/amber accents

## Project Architecture

### Multi-Tenancy (Organization Silos)
- **organizations** table: id, name, subscriptionTier, logoUrl, inviteCode
- All agents belong to an organization (via organizationId)
- All properties belong to an organization (via organizationId)
- GET /api/properties filters by logged-in agent's organizationId (silo)
- POST /api/properties auto-tags with agent's organizationId
- PATCH/DELETE /api/properties checks org ownership (403 if cross-org)
- Leads filtered by org via property join
- **Super Admin** (vinnysladeb@gmail.com): bypasses all org filters, sees all data
- **Signup flow**: New agents default to "Public / Freelance" org; invite code joins specific org
- **Seeded orgs**: "Public / Freelance" (free), "Taste Realty Group" (pro, invite: TASTE-PRO-2025)

### Routes (Frontend)
- `/` - Consumer swipe app (public, no login needed)
- `/login` - Agent login/signup page (tabbed)
- `/agent` - Agent Dashboard (protected, requires login)
- `/agent/listings` - Property CRUD grid (protected)
- `/agent/settings` - Agent preferences (protected)
- `/discover` - Redirects to `/`
- `/dashboard` - Redirects to `/agent`

### RBAC Security
- **Public routes**: GET `/api/properties`, GET `/api/properties/:id`, POST `/api/leads`, POST `/api/swipe`
- **Protected routes**: All POST/PATCH/DELETE on properties, GET leads, all notification endpoints
- **Auth endpoints**: POST `/api/auth/login`, POST `/api/auth/signup`, POST `/api/auth/logout`, GET `/api/auth/me`
- **Super Admin endpoint**: GET `/api/organizations` (super admin only)
- **Default agent**: agent@taste.com / agent123 (Taste Realty Group)
- **Super admin**: vinnysladeb@gmail.com / admin123

### API Endpoints
- `GET /api/properties` - List with filters + org silo (public shows all, agent sees own org)
- `GET /api/properties/:id` - Single property (public)
- `POST /api/properties` - Create property, auto-tags with org + AI vibeTag via Gemini (agent only)
- `PATCH /api/properties/:id` - Update property, org ownership check (agent only)
- `DELETE /api/properties/:id` - Delete property, org ownership check (agent only)
- `POST /api/properties/:id/retag` - Re-run Gemini AI classification on existing property (agent only)
- `POST /api/leads` - Create lead (public, validates propertyId)
- `GET /api/leads` - List leads filtered by org (agent only)
- `POST /api/swipe` - Record swipe (public), trigger notifications for high matches (>85%), build taste profile
- `GET /api/taste-profile` - Get consumer's taste profile from session (public)
- `GET /api/notifications` - List notifications (agent only)
- `GET /api/notifications/count` - Unread count (agent only)
- `PATCH /api/notifications/:id/read` - Mark read (agent only)
- `PATCH /api/notifications/read-all` - Mark all read (agent only)
- `GET /api/organizations` - List all orgs (super admin only)
- `POST /api/auth/signup` - Register new agent with optional invite code

### Database Schema
- **organizations**: id, name, subscriptionTier, logoUrl, inviteCode, createdAt
- **agents**: id, email, passwordHash, name, role (agent|super_admin), organizationId
- **properties**: id, title, description, price, bedrooms, bathrooms, sqft, location, images (JSON), agentId, status, vibe, vibeTag, tags (JSON), organizationId
- **leads**: id, propertyId, name, phone, createdAt
- **notifications**: id, recipientId, type, content (JSON), priority, readStatus, createdAt

### Key Files
- `shared/schema.ts` - Drizzle schema + Zod validation (organizations, agents, properties, leads, notifications, loginSchema, signupSchema, swipeSchema)
- `server/storage.ts` - Database storage interface with org-aware CRUD
- `server/routes.ts` - API routes with requireAgent middleware + org silo logic + super admin bypass
- `server/notificationService.ts` - Email dispatch via Nodemailer (Ethereal for dev)
- `server/geminiTagger.ts` - Gemini Vision auto-tagging service (8 archetypes + Unclassified fallback)
- `server/seed.ts` - Seed data (2 orgs, super admin, default agent, 5 properties with vibeTags)
- `client/src/hooks/use-auth.ts` - Auth hook with org/role/superAdmin info
- `client/src/pages/login.tsx` - Tabbed login/signup form with invite code
- `client/src/pages/consumer.tsx` - Consumer swipe app with Framer Motion
- `client/src/pages/dashboard.tsx` - Agent dashboard
- `client/src/pages/listings.tsx` - Property CRUD grid with lifestyle tag selector
- `client/src/components/app-sidebar.tsx` - Agent navigation sidebar with org name + logout
- `client/src/components/notification-bell.tsx` - Notification bell with dropdown feed

### Consumer Card Features (Phase 3)
- **Insta-Style Galleries**: Each property card supports multiple images (3 per seeded property). Invisible tap zones (left 30%, right 30%) cycle photos. Instagram-story progress bars at top show active photo. Tap vs drag gesture separation via timing threshold (250ms) and movement (10px).
- **Vibe Match Algorithm**: Client-side `computeMatchScore()` compares user onboarding filters against property data. `MatchBadge` renders color-coded badge: green pulse 90%+ ("Dream Home"), amber 70-89% ("Great Match"), grey <70% ("Explore"). Score boosted for under-budget pricing and exact bedroom match.
- **Glassmorphism Specs**: Bottom card overlay uses `backdrop-blur-md bg-white/10 border-white/10` for frosted glass look. Property details readable over any photo.
- **Haptics**: `navigator.vibrate` triggered on right swipe and photo tap (if device supports).

### Lifestyle Tags (Phase 4)
- 7 tags: Natural Light, Remote Ready, Chef Kitchen, Fenced Yard, HOA Free, Smart Home, Quiet Street
- Onboarding wizard includes "Must-Haves & Deal-Breakers" step
- Deal-breakers filter out properties entirely; must-haves boost match score by 10 points each
- Golden Hour toggle cycles morning/golden/night image filters

### Smart Notification Engine (Phase 5)
- Swipe right with >85% match → HIGH priority notification to agent
- Swipe right with >95% match → CRITICAL priority + immediate email dispatch
- Email template includes matched lifestyle tags for agent call prep
- Notification bell in dashboard header with unread count badge
- Dropdown feed with priority-coded borders (red=critical, gold=high)
- Mark read/mark all read functionality with 10s polling refresh

### AI Vision Auto-Tagging (Phase 7)
- **Gemini Integration**: Uses @google/generative-ai with GEMINI_API_KEY secret
- **8 Archetypes**: Purist, Industrialist, Monarch, Futurist, Naturalist, Curator, Classicist, Nomad
- **Auto-tag on upload**: POST /api/properties sends first image URL (or vibe text) to Gemini for classification
- **Fallback**: Defaults to "Unclassified" if API fails or key missing — uploads never break
- **Re-tag endpoint**: POST /api/properties/:id/retag re-runs classification on existing listings
- **vibeTag column**: Stored in properties table as text, default "Unclassified"

### Consumer Taste Memory (Phase 7)
- **Session-based profiles**: tasteProfile stored in express-session (no user accounts needed)
- **Swipe learning**: Right swipe increments archetype score in taste profile (e.g. {Futurist: 3, Classicist: 1})
- **Smart feed**: GET /api/properties sorts consumer results by taste profile match percentage
- **Taste profile endpoint**: GET /api/taste-profile returns current session's accumulated preferences

### Lemon Squeezy Payments (Phase 8)
- **Webhook**: POST /api/webhooks/lemon-squeezy with HMAC SHA256 signature verification
- **Secret**: LEMONSQUEEZY_WEBHOOK_SECRET used for signature validation
- **order_created event**: Extracts user_email, finds agent, upgrades subscriptionTier to "premium" + assigns premium org
- **Frontend**: "Upgrade to Premium" button on dashboard opens https://esotarot.lemonsqueezy.com/checkout
- **Premium badge**: Shows gold "Premium" or "Super Admin" badge when upgraded
- **Agent schema**: subscriptionTier column added (default: "free")
- **Live Webhook URL**: https://[app-url]/api/webhooks/lemon-squeezy

### Production Deployment (Phase 6)
- **PWA**: manifest.json with "Taste: Curated Real Estate" name, custom icons (192/512), standalone display, portrait orientation
- **Service Worker**: Caches images (cache-first), Google Fonts (cache-first), pages (network-first); skips /api/ requests
- **Security**: Helmet middleware for headers (HSTS, X-Content-Type-Options, X-Frame-Options, etc.); CSP disabled for Vite compatibility
- **Database**: PostgreSQL via Replit's built-in Neon-backed DB (persistent by default, no SQLite)
- **Port**: Uses process.env.PORT with fallback to 5000

## User Preferences
- Dark mode by default
- Gold/amber primary accent color
- Clean, sans-serif typography
- "Taste" brand: Playfair Display serif, italic styling
