# AO Intelligence - Professional Outbound Calling Dialer

## Overview
This is a professional outbound calling dialer application built with React, Express, and TypeScript. The application provides features for agent verification, call tracking, appointment scheduling, and comprehensive call center management.

## Project Architecture

### Frontend (Port 5000)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Routing**: Wouter
- **UI Components**: Radix UI, Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Host Configuration**: 0.0.0.0:5000 with allowedHosts enabled for Replit proxy compatibility

### Backend (Port 5001, proxied through Vite in dev)
- **Framework**: Express.js
- **Language**: TypeScript (ESM)
- **Runtime**: tsx for development, compiled with esbuild for production
- **Host Configuration**: localhost:5001

### Database
- **Primary**: PostgreSQL (Replit-managed Neon database) with Drizzle ORM
- **Schema**: Defined in `shared/schema.ts`
- **Migrations**: Use `npm run db:push` to push schema changes (never manual SQL)
- **Additional Storage**: Supabase for file storage and additional features

### Key External Services
- **Twilio**: Voice calling and SMS (credentials in hardcoded-config.ts)
- **Stripe**: Payment processing
- **Whereby**: Video calling
- **Google Calendar**: Appointment scheduling
- **Supabase**: File storage and real-time features

## Development Setup

### Prerequisites
- Node.js 20.x (installed via Replit)
- PostgreSQL database (auto-provisioned by Replit)

### Running the Application
The development server runs both frontend and backend:
```bash
npm run dev
```

This starts:
- Frontend Vite dev server on port 5000 (0.0.0.0)
- Backend Express server on port 5001 (localhost)
- Frontend proxies API requests to backend via Vite proxy

### Database Management
To push schema changes to the database:
```bash
npm run db:push
```

If you encounter data-loss warnings:
```bash
npm run db:push --force
```

### Build for Production
```bash
npm run build
npm start
```

## Deployment
The application is configured for VM deployment on Replit:
- **Build command**: `npm run build`
- **Run command**: `npm start`
- **Deployment type**: VM (stateful, always running)

## Configuration
Configuration is managed through `server/hardcoded-config.ts` which includes:
- Twilio credentials (Account SID, Auth Token, API Keys)
- Database URLs (respects DATABASE_URL env var)
- Supabase configuration
- Stripe keys
- Session secrets
- S3/Storage configuration

The application prioritizes environment variables when available:
- `DATABASE_URL` - PostgreSQL connection string (set by Replit)
- `APP_URL` - Application base URL
- `RAILWAY_PUBLIC_DOMAIN` - Railway deployment domain
- `NODE_ENV` - Environment (development/staging/production)
- `PORT` - Server port (defaults to 5000)

## Project Structure
```
├── client/              # Frontend React application
│   ├── src/
│   │   ├── components/  # React components (organized by feature)
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utilities and API clients
│   │   └── types/       # TypeScript type definitions
│   └── index.html       # HTML template
├── server/              # Backend Express application
│   ├── routes/          # API route handlers
│   ├── index.ts         # Server entry point
│   ├── db.ts           # Database connection (Drizzle + Neon)
│   ├── hardcoded-config.ts  # Configuration management
│   └── *.ts            # Various services and utilities
├── shared/              # Shared code between frontend and backend
│   └── schema.ts        # Database schema (Drizzle ORM)
├── electron/            # Electron desktop app files
├── attached_assets/     # Static assets (videos, images)
├── vite.config.ts       # Vite configuration
├── drizzle.config.ts    # Drizzle ORM configuration
└── package.json         # Dependencies and scripts
```

## Recent Changes

### 2025-10-19: Initial Replit Setup
- Installed Node.js 20 and all npm dependencies
- Created PostgreSQL database using Replit's built-in service
- Fixed database schema issues:
  - Removed duplicate primary key definitions in `qualityManagerTeamAssignments` table
  - Removed duplicate primary key definitions in `qualityManagerAssignments` table
- Pushed database schema to Replit PostgreSQL
- Configured Vite to allow all hosts (required for Replit iframe proxy)
- Set frontend host to 0.0.0.0:5000
- Set up development workflow
- Configured VM deployment settings
- Updated hardcoded-config.ts to prioritize DATABASE_URL environment variable

## Known Issues & Warnings

### Non-Critical Warnings
- **Video Files**: Large video files in `attached_assets` may be Git LFS pointers (0 MB instead of expected ~108 MB)
- **npm Deprecations**: Several packages have deprecation warnings (non-critical, don't affect functionality)
- **Database Warnings**: Some legacy table columns referenced in code don't exist in fresh database:
  - `twilio_call_logs.status` - doesn't exist in schema
  - `producerlist.CompanyEmail` - should be `company_email` (case sensitivity)
  - `vdp_calls.Date` - column name mismatch
  These are from the original production database and can be safely ignored or fixed later.

### Vite HMR WebSocket Issue
- Browser console shows WebSocket connection error: `wss://localhost:undefined/?token=...`
- This is a known Vite HMR issue in proxied/iframe environments
- Does NOT affect application functionality
- Only impacts hot module replacement during development

## Technical Notes

### Database Schema
The database uses Drizzle ORM with PostgreSQL. Key tables include:
- `users` - User authentication
- `agent_profiles` - Agent information and team assignments
- `call_logs` - Simple call tracking
- `appointments` - Appointment scheduling
- `role_page_permissions` - Role-based access control
- `quality_manager_team_assignments` - QM team relationships
- Many more specialized tables for various features

### External API Integration
The application integrates with multiple external services:
- **Twilio Voice SDK 2.x** for WebRTC calling
- **Stripe** for payment processing
- **Whereby** for video conferencing
- **Google Calendar API** for appointment scheduling
- **Supabase** for real-time features and storage

### Security Considerations
- API keys and secrets are managed in `hardcoded-config.ts`
- Session management uses `express-session` with secure secrets
- Database uses SSL connections (Neon requires SSL)
- CORS configured for production domains

## User Preferences
- None documented yet
