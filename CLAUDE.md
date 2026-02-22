# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SesamoTV is a video streaming platform with dual authentication (admin + user with approval workflow), video management, tag-based categorization, ratings, and streaming. Built with Node.js/Express backend and vanilla JavaScript frontends.

## Commands

All commands run from `backend/`:

```bash
cd backend
npm install          # Install dependencies
npm run dev          # Start dev server with nodemon (port 4000)
npm start            # Start production server
```

No test suite, linter, or build step exists. Frontend files are static (no build process).

### Database Setup

```bash
psql -U jose -d sesamotv -f backend/schema.sql
# Then apply migrations in order:
psql -U jose -d sesamotv -f backend/migrations/001_create_users_table.sql
psql -U jose -d sesamotv -f backend/migrations/002_add_rating.sql
psql -U jose -d sesamotv -f backend/migrations/003_video_ratings.sql
```

## Architecture

### Backend (`backend/`)

- **server.js** — Express entry point. Serves static files for both frontends, mounts API routes, configures security (Helmet, CORS, rate limiting).
- **config/database.js** — PostgreSQL connection pool (max 20 connections). Uses parameterized queries throughout.
- **middleware/auth.js** — Two auth middlewares: `authenticateToken` (admin-only) and `requireApprovedUser` (user routes, also allows admin tokens). JWT tokens via `Authorization: Bearer` header or `?token=` query param (for video streaming in HTML5 `<video>` elements).
- **routes/auth.js** — Admin login (24h JWT expiry)
- **routes/userAuth.js** — User registration/login (7d JWT expiry). Users register as 'pending' and require admin approval.
- **routes/users.js** — Admin-only user management (approve/reject/delete users, handle password resets)
- **routes/videos.js** — Video CRUD, upload (multer, 500MB max, UUID filenames), HTTP Range streaming (206 Partial Content), rating (upsert per-user), view counting, drag-drop reorder via sort_order
- **routes/tags.js** — Tag CRUD for video categorization

### Database (PostgreSQL)

Tables: `admins`, `users` (with status: pending/approved/rejected), `videos`, `tags`, `video_tags` (many-to-many), `video_ratings` (per-user, unique constraint on user_id+video_id). Schema in `backend/schema.sql`, incremental changes in `backend/migrations/`.

**Note:** Code references a `password_resets` table that is not yet created in schema or migrations.

### Frontend — Two vanilla JS SPAs

- **public/** — User-facing app served at `/`. Screens: landing, login, register, reset, home, player. Features tag filtering, search (debounced 300ms), video player with star ratings, view tracking.
- **admin/** — Admin panel served at `/admin`. Screens: login, dashboard, upload, edit, tags, users. Features video upload, drag-and-drop reorder, user approval workflow, password reset handling.

API base URL: admin app hardcodes `http://localhost:4000/api`, public app uses relative `/api`.

### Auth Token Storage

- Admin: `localStorage` key `sesamotv_admin_token`
- User: `localStorage` key `sesamotv_user_token`

### File Uploads

Videos stored at `backend/uploads/videos/{uuid}.{ext}`. Supported: .mp4, .webm, .mov, .avi, .mkv.

## Access Points

- Public: http://localhost:4000
- Admin: http://localhost:4000/admin
- API: http://localhost:4000/api
- Health check: GET /api/health
