# Taste - Real Estate Discovery & Agent Console

## Overview
A full-stack real estate application with two distinct experiences:
1. **Agent Console** (Command Center) - Property CRUD, stats, lead management, real-time notification feed
2. **Consumer App** (Taste) - Tinder-style property swipe discovery with onboarding wizard

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, Framer Motion, shadcn/ui, wouter routing
- **Backend**: Express.js, PostgreSQL, Drizzle ORM, Nodemailer
- **Auth**: Session-based (express-session + bcryptjs)
- **Theme**: "Midnight Luxury" dark mode with gold/amber accents

## Project Architecture

### Routes (Frontend)
- `/` - Consumer swipe app (public, no login needed)
- `/login` - Agent login page
- `/agent` - Agent Dashboard (protected, requires login)
- `/agent/listings` - Property CRUD grid (protected)
- `/agent/settings` - Agent preferences (protected)
- `/discover` - Redirects to `/`
- `/dashboard` - Redirects to `/agent`

### RBAC Security
- **Public routes**: GET `/api/properties`, GET `/api/properties/:id`, POST `/api/leads`, POST `/api/swipe`
- **Protected routes**: All POST/PATCH/DELETE on properties, GET leads, all notification endpoints
- **Auth endpoints**: POST `/api/auth/login`, POST `/api/auth/logout`, GET `/api/auth/me`
- **Default agent**: agent@taste.com / agent123

### API Endpoints
- `GET /api/properties` - List with filters (public)
- `GET /api/properties/:id` - Single property (public)
- `POST /api/properties` - Create property (agent only)
- `PATCH /api/properties/:id` - Update property (agent only)
- `DELETE /api/properties/:id` - Delete property (agent only)
- `POST /api/leads` - Create lead (public, validates propertyId)
- `GET /api/leads` - List all leads (agent only)
- `POST /api/swipe` - Record swipe (public), trigger notifications for high matches (>85%)
- `GET /api/notifications` - List notifications (agent only)
- `GET /api/notifications/count` - Unread count (agent only)
- `PATCH /api/notifications/:id/read` - Mark read (agent only)
- `PATCH /api/notifications/read-all` - Mark all read (agent only)

### Database Schema
- **agents**: id, email, passwordHash, name
- **properties**: id, title, description, price, bedrooms, bathrooms, sqft, location, images (JSON), agentId, status, vibe, tags (JSON)
- **leads**: id, propertyId, name, phone, createdAt
- **notifications**: id, recipientId, type, content (JSON), priority, readStatus, createdAt

### Key Files
- `shared/schema.ts` - Drizzle schema + Zod validation (agents, properties, leads, notifications, loginSchema, swipeSchema)
- `server/storage.ts` - Database storage interface with agent + notification CRUD
- `server/routes.ts` - API routes with requireAgent middleware
- `server/notificationService.ts` - Email dispatch via Nodemailer (Ethereal for dev)
- `server/seed.ts` - Seed data (5 properties + default agent)
- `client/src/hooks/use-auth.ts` - Auth hook using /api/auth/me
- `client/src/pages/login.tsx` - Agent login form
- `client/src/pages/consumer.tsx` - Consumer swipe app with Framer Motion
- `client/src/pages/dashboard.tsx` - Agent dashboard
- `client/src/pages/listings.tsx` - Property CRUD grid with lifestyle tag selector
- `client/src/components/app-sidebar.tsx` - Agent navigation sidebar with logout
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
