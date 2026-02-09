# LuxeEstates - Real Estate Agent Dashboard & Consumer App

## Overview
A full-stack real estate application with two distinct experiences:
1. **Agent Dashboard** (Command Center) - Property CRUD, stats, lead management, real-time notification feed
2. **Consumer App** (Taste to Lead) - Tinder-style property swipe discovery with onboarding wizard

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, Framer Motion, shadcn/ui, wouter routing
- **Backend**: Express.js, PostgreSQL, Drizzle ORM, Nodemailer
- **Theme**: "Midnight Luxury" dark mode with gold/amber accents

## Project Architecture

### Routes
- `/` - Agent Dashboard overview with stats
- `/listings` - Property grid with CRUD (create, edit, delete with modal confirmations)
- `/settings` - Agent profile & notification preferences
- `/discover` - Consumer swipe app (full-screen, onboarding wizard → swipe deck → lead capture)

### API Endpoints
- `GET /api/properties` - List with filters (location, minPrice, maxPrice, bedrooms, vibe, status)
- `GET /api/properties/:id` - Single property
- `POST /api/properties` - Create property
- `PATCH /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property
- `POST /api/leads` - Create lead (validates propertyId exists)
- `GET /api/leads` - List all leads
- `POST /api/swipe` - Record swipe, trigger notifications for high matches (>85%)
- `GET /api/notifications` - List notifications for agent
- `GET /api/notifications/count` - Unread notification count
- `PATCH /api/notifications/:id/read` - Mark single notification read
- `PATCH /api/notifications/read-all` - Mark all notifications read

### Database Schema
- **properties**: id, title, description, price, bedrooms, bathrooms, sqft, location, images (JSON), agentId, status, vibe, tags (JSON)
- **leads**: id, propertyId, name, phone, createdAt
- **notifications**: id, recipientId, type, content (JSON), priority, readStatus, createdAt

### Key Files
- `shared/schema.ts` - Drizzle schema + Zod validation (properties, leads, notifications, swipeSchema)
- `server/storage.ts` - Database storage interface with notification CRUD
- `server/routes.ts` - API routes including swipe + notification endpoints
- `server/notificationService.ts` - Email dispatch via Nodemailer (Ethereal for dev)
- `server/seed.ts` - Seed data (5 properties with lifestyle tags)
- `client/src/pages/consumer.tsx` - Consumer swipe app with Framer Motion
- `client/src/pages/dashboard.tsx` - Agent dashboard
- `client/src/pages/listings.tsx` - Property CRUD grid with lifestyle tag selector
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
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
- **PWA**: manifest.json with "Taste to Lead" name, custom icons (192/512), standalone display, portrait orientation
- **Service Worker**: Caches images (cache-first), Google Fonts (cache-first), pages (network-first); skips /api/ requests
- **Security**: Helmet middleware for headers (HSTS, X-Content-Type-Options, X-Frame-Options, etc.); CSP disabled for Vite compatibility
- **Database**: PostgreSQL via Replit's built-in Neon-backed DB (persistent by default, no SQLite)
- **Port**: Uses process.env.PORT with fallback to 5000

## User Preferences
- Dark mode by default
- Gold/amber primary accent color
- Clean, sans-serif typography
