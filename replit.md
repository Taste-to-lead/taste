# LuxeEstates - Real Estate Agent Dashboard & Consumer App

## Overview
A full-stack real estate application with two distinct experiences:
1. **Agent Dashboard** (Command Center) - Property CRUD, stats, lead management
2. **Consumer App** (Taste to Lead) - Tinder-style property swipe discovery with onboarding wizard

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, Framer Motion, shadcn/ui, wouter routing
- **Backend**: Express.js, PostgreSQL, Drizzle ORM
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

### Database Schema
- **properties**: id, title, description, price, bedrooms, bathrooms, sqft, location, images (JSON), agentId, status, vibe
- **leads**: id, propertyId, name, phone, createdAt

### Key Files
- `shared/schema.ts` - Drizzle schema + Zod validation
- `server/storage.ts` - Database storage interface
- `server/routes.ts` - API routes
- `server/seed.ts` - Seed data (5 properties)
- `client/src/pages/consumer.tsx` - Consumer swipe app with Framer Motion
- `client/src/pages/dashboard.tsx` - Agent dashboard
- `client/src/pages/listings.tsx` - Property CRUD grid
- `client/src/components/app-sidebar.tsx` - Navigation sidebar

## User Preferences
- Dark mode by default
- Gold/amber primary accent color
- Clean, sans-serif typography
