# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server with Vite (includes integrated Cloudflare Workers runtime)
- `npm run build` - Build for production (TypeScript compilation + Vite build)
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run knip` - Find unused dependencies and exports

### Cloudflare Workers
- `wrangler deploy` - Deploy to Cloudflare Workers
- `wrangler d1 execute <DB_NAME> --file=<FILE>` - Execute SQL against D1 database
- `wrangler d1 migrations apply <DB_NAME>` - Apply database migrations

**IMPORTANT**: Do NOT run `wrangler dev` separately. The `@cloudflare/vite-plugin` handles the Workers runtime integration directly in Vite.

## Architecture

This is a full-stack React admin dashboard built for Cloudflare Workers with the following architecture:

### Frontend Stack
- **React 19** with **TypeScript** for the UI
- **TanStack Router** for file-based routing with type safety
- **TanStack Query** for server state management
- **Zustand** for client state management
- **ShadcnUI** + **TailwindCSS** for styling with RTL support
- **Radix UI** for accessible components

### Backend Stack
- **Cloudflare Workers** for serverless compute
- **Hono** as the web framework
- **D1** for the database (SQLite)
- **KV** for key-value storage
- **Better Auth** for authentication
- **Drizzle ORM** for database operations
- **Cloudflare AI** for AI chat functionality

### Key Architecture Patterns

1. **Feature-Based Organization**: Code is organized by features in `src/features/` (auth, dashboard, tasks, users, etc.)

2. **Routing Structure**: 
   - TanStack Router with file-based routing in `src/routes/`
   - `_authenticated/` routes require authentication
   - `(auth)/` and `(errors)/` are route groups

3. **Component Architecture**:
   - Reusable UI components in `src/components/ui/` (ShadcnUI)
   - Layout components in `src/components/layout/`
   - Feature-specific components within each feature directory

4. **Data Layer**:
   - TanStack Query for server state with React Query DevTools
   - Custom hooks for data fetching patterns
   - Type-safe API calls with Zod validation

5. **Authentication Flow**:
   - Better Auth configured for email/password and OAuth (Google, GitHub)
   - Protected routes with authentication context
   - Session management with KV storage

6. **Cloudflare Integration**:
   - Worker entry point in `worker.ts` using Hono
   - API functions in `functions/api/` directory
   - Environment bindings for D1, KV, AI, and auth secrets

## Important Configuration

### Path Aliases
- `@/*` maps to `src/*` (configured in tsconfig.json and vite.config.ts)

### ESLint Rules
- Uses TypeScript ESLint with React hooks and TanStack Query plugins
- Enforces type-only imports with inline syntax
- No console.log statements in production
- Strict unused variable checking with underscore prefix exception

### Database
- Uses D1 (Cloudflare's SQLite) with Drizzle ORM
- Schema and migrations in `database/` directory
- Local development uses file-based SQLite

### Modified ShadcnUI Components
The following components have been customized for RTL support and should not be updated via Shadcn CLI without reviewing changes:
- **Modified**: scroll-area, sonner, separator
- **RTL Updated**: alert-dialog, calendar, command, dialog, dropdown-menu, select, table, sheet, sidebar, switch

### Development Integration
The `@cloudflare/vite-plugin` provides seamless integration between Vite and the Cloudflare Workers runtime:

- **Native HMR**: Hot Module Replacement works for both client and server code
- **Integrated Runtime**: Worker code runs in workerd (same as production) during development
- **No Proxy Needed**: API routes are handled directly by Vite, no separate wrangler dev process required
- **Environment Parity**: Development environment matches production Cloudflare Workers runtime
- **SPA Fallback**: Client-side routing works correctly - direct URL navigation is supported

**Critical Configuration**:
- Remove any server proxy configuration from vite.config.ts - the plugin handles routing internally
- Set `appType: 'spa'` in vite.config.ts for proper SPA fallback
- The worker handles SPA fallback by serving index.html for non-API routes when ASSETS is unavailable (development)

## Testing Commands
No specific test commands are configured. Check with the user if testing setup is needed.