# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack hotel management system (monorepo) with a React/Vite frontend and Node.js/Express backend, backed by PostgreSQL via Sequelize ORM.

## Commands

### Development

```bash
npm run dev              # Start backend + frontend concurrently
npm run dev:backend      # Backend only (port 3001)
npm run dev:frontend     # Frontend only (port 5173)
```

### Database

```bash
npm run db:migrate       # Run pending migrations
npm run db:seed          # Seed initial data (admin/recepcion users, room types, rooms)
npm run db:reset         # Undo all migrations, re-migrate, re-seed
```

### Frontend Build

```bash
cd frontend && npm run build    # Production build
cd frontend && npm run preview  # Preview production build
```

### Environment Setup

Copy `backend/.env.example` to `backend/.env` and configure:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — PostgreSQL connection
- `JWT_SECRET`, `JWT_EXPIRES_IN` — Auth token config
- `PORT` (default: 3001), `NODE_ENV`

The PostgreSQL schema lives in `database/init.sql`. Run it before migrations if starting fresh.

## Architecture

### Monorepo Structure

- **`backend/`** — Express REST API
- **`frontend/`** — React SPA
- **`database/`** — Raw SQL schema (`init.sql`)

### Backend (`backend/src/`)

Layered Express app with JWT auth and role-based access control:

- **`index.js`** — App entry: Express setup, global error handler, route mounting under `/api`
- **`routes/`** — 6 route files: `auth`, `reservations`, `rooms`, `roomTypes`, `guests`, `dashboard`
- **`models/`** — 10 Sequelize models: `User`, `Guest`, `Room`, `RoomType`, `Reservation`, `Payment`, `ExtraCharge`, `HousekeepingTask`, `AuditLog`, `DailyCash`
- **`middleware/auth.js`** — JWT verification + role authorization (`admin`, `manager`, `receptionist`, `accounting`, `housekeeping`)
- **`config/`** — DB connection (`database.js`) and JWT helpers (`auth.js`)
- **`seeders/initial.js`** — Creates default users (`admin`/`admin123`, `recepcion`/`recepcion123`), 4 room types, 10 rooms

### Frontend (`frontend/src/`)

React 18 SPA with React Router v6, Tailwind CSS, and Lucide icons:

- **`main.jsx`** — React entry, Router + AuthProvider wrapper
- **`context/AuthContext.jsx`** — Auth state; stores JWT in `localStorage`, attaches token to all API requests
- **`services/api.js`** — Centralized HTTP client; all API calls go through here
- **`pages/`** — 6 route-level components: `LoginPage`, `DashboardPage`, `RoomsPage`, `GuestsPage`, `ReservationsPage`, `ReservationDetailPage`
- **`components/`** — Grouped by domain: `layout/`, `rooms/`, `guests/`, `reservations/`, `ui/`

### Key Data Flows

**Auth:** Login → POST `/api/auth/login` → JWT returned → stored in `localStorage` → sent as `Authorization: Bearer <token>` on all requests.

**Reservation lifecycle:** `pending` → `checked_in` (check-in updates room to `occupied`) → `checked_out` (room moves to `cleaning`). Payments and extra charges are separate records linked to a reservation.

**Frontend → Backend proxy:** Vite dev server proxies `/api` requests to `localhost:3001` (configured in `vite.config.js`).

### Room Status Enum

`available` → `reserved` → `occupied` → `cleaning` → `maintenance` → `available`

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router v6, date-fns |
| Backend | Node.js, Express 4, Sequelize 6, bcryptjs, jsonwebtoken |
| Database | PostgreSQL |
| Dev tooling | nodemon, concurrently, sequelize-cli |
