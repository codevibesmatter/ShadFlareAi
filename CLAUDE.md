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

This is a **comprehensive showcase template** demonstrating Cloudflare's full suite of cloud and AI capabilities, integrated with Vercel's AI SDK for modern frontend AI components. Built as a full-stack React admin dashboard for Cloudflare Workers with the following architecture:

### Frontend Stack
- **React 19** with **TypeScript** for the UI
- **TanStack Router** for file-based routing with type safety
- **TanStack Query** for server state management
- **Zustand** for client state management
- **Legend State v3** for reactive state management with WebSocket integration
- **Vercel AI SDK** (`@ai-sdk/react`, `@ai-sdk/ui`) for AI chat components and streaming
- **ShadcnUI** + **TailwindCSS** for styling with RTL support
- **Radix UI** for accessible components

### Backend Stack
- **Cloudflare Workers** for serverless compute
- **Hono** with **OpenAPI** integration for the web framework
- **D1** for the database (SQLite)
- **KV** for key-value storage
- **Better Auth** for authentication with OpenAPI documentation
- **Drizzle ORM** for database operations
- **Cloudflare AI** for AI chat functionality (OpenAI-compatible API)
- **Cloudflare Workers AI** for text generation, embeddings, and image processing
- **Durable Objects** for real-time WebSocket connections and stateful operations
- **Cloudflare R2** for object storage and file uploads
- **Cloudflare Pages** integration for static asset serving

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

## API Documentation

The application uses OpenAPI documentation with interactive testing:

- **API Docs**: `http://localhost:5174/api/ui` - Swagger UI for all endpoints
- **Auth Docs**: `http://localhost:5174/api/auth/reference` - Better Auth endpoints
- **OpenAPI Schema**: `http://localhost:5174/api/docs` - JSON specification

New routes defined in `src/server/routes/` with Zod schemas automatically appear in documentation.

## Authentication & Testing

### Test User Credentials
For development and testing purposes:
- **Email**: `demo@example.com`  
- **Password**: `password123`

**Note**: Users must be created via Better Auth API. Use this curl command to create new test users:
```bash
curl -X POST http://localhost:5174/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "password": "password123", "name": "New User"}'
```

### Sign-in Methods
1. **OAuth (GitHub/Google)**: Currently returns 404 - OAuth providers need configuration
2. **Email/Password**: Working with test credentials above
3. **Account Creation**: Better Auth handles user registration automatically on first successful OAuth or can be done via API

### Authentication Flow
- Better Auth manages sessions with database hooks for real-time WebSocket invalidation
- Legend State v3 provides reactive auth state management
- Sessions are stored in Cloudflare KV with automatic expiry
- WebSocket connections via UserSysDO provide cross-device session invalidation

### Backend API Testing with Session Cookies
For testing authenticated API endpoints, extract session cookies after login:

```bash
# 1. Sign in and capture cookies
curl -X POST http://localhost:5174/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@example.com", "password": "password123"}' \
  -c cookies.txt

# 2. Use session cookies for authenticated requests
curl -X GET http://localhost:5174/api/protected-endpoint \
  -b cookies.txt

# 3. Test WebSocket authentication
curl -X GET http://localhost:5174/api/auth/session \
  -b cookies.txt
```

**Cookie Storage**: Sessions persist in `cookies.txt` for easy reuse in testing scripts

## Testing Commands
No specific test commands are configured. Check with the user if testing setup is needed.

## Session Planning & Tracking

Claude should maintain session documentation in `sessions/YYYY-MM-DD/session-N/`:
- **plan.md**: Track goals, progress, and next steps
- **work-log.md**: Log activities and decisions
- **session-summary.md**: Summarize accomplishments (auto-generated on Stop)

### Session Configuration
- **Session Port**: [AUTO-ASSIGNED] (note the port when starting dev server to avoid conflicts)

### Working Guidelines
1. Update plan.md when starting new tasks
2. Mark goals with ✅ when completed
3. Add discovered tasks as new goals
4. Commit code after logical chunks of work


## Project Configuration

### Package Manager
- [x] npm
- [ ] yarn  
- [ ] pnpm
- [ ] pip
- [ ] cargo
- [ ] other: ___________

### Framework & Stack
- **Frontend**: React 19 + TypeScript + Vite + ShadcnUI + Vercel AI SDK
- **Backend**: Cloudflare Workers + Hono + OpenAPI
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM
- **Auth**: Better Auth with OAuth (Google, GitHub)
- **Deployment**: Cloudflare Workers + Pages

### Development Commands
```bash
# Install dependencies
npm install

# Run development server (includes Workers runtime) - QUIET MODE BY DEFAULT
npm run dev

# Run with verbose logging (all logs)
npm run log:verbose

# Focus logging on specific areas
npm run log:websocket  # WebSocket debugging
npm run log:ai         # AI operations only
npm run log:voice      # Voice features only

# Run tests
npm test

# Build for production
npm run build

# Lint and format
npm run lint && npm run format

# Type checking
npx tsc --noEmit
```

### Logging System
- **Default Mode**: Quiet (only errors) - reduces WebSocket/AI noise
- **Runtime Control**: `logControl.focus('ai')` in browser console  
- **Contexts**: websocket, ai, voice, auth, ui, data, artifacts, performance
- **Documentation**: See `LOGGING.md` for complete guide

### Ports & Services
- **Frontend**: http://localhost:[VITE_DYNAMIC_PORT] (default 5174, auto-assigned by Vite)
- **Backend API**: http://localhost:[SAME_PORT]/api  
- **Database**: Cloudflare D1 (local SQLite in development)
- **Other services**: WebSocket connections via Durable Objects


## Testing Strategy

### Test Structure
```
tests/
├── unit/        # Unit tests
├── integration/ # Integration tests
├── e2e/         # End-to-end tests
└── fixtures/    # Test data
```

### Testing Commands
- **Unit tests**: `npm test` (Vitest)
- **Integration tests**: `npm run test:integration` (API + Workers)
- **E2E tests**: `npm run test:e2e` (Playwright + Playwright MCP)
- **Coverage**: `npm run test:coverage`

### Testing Requirements
- [x] All new features must have tests
- [x] Maintain >80% code coverage
- [x] Run tests before committing
- [x] E2E tests for critical user flows
- [x] AI component testing with mock streaming responses
- [x] WebSocket connection testing for real-time features

### E2E Testing with Playwright MCP
- **MCP Integration**: Use `mcp__playwright__*` tools for browser automation
- **AI Feature Testing**: Test chat interfaces, voice features, and artifact generation
- **Authentication Flows**: Test OAuth and email/password sign-in with test credentials
- **Cross-browser Testing**: Chrome, Firefox, Safari support via MCP


## Authentication & Security

### Auth Implementation
- **Method**: [x] JWT [x] Session [x] OAuth [ ] Other: _____
- **Provider**: [x] Custom (Better Auth) [ ] Auth0 [ ] Clerk [ ] Supabase [ ] Firebase
- **MFA**: [ ] Enabled [x] Optional [ ] Not implemented
- **OAuth Providers**: Google, GitHub (configurable)

### Security Checklist
- [x] Input validation on all endpoints (Zod schemas)
- [x] SQL injection prevention (Drizzle ORM parameterized queries)
- [x] XSS protection (React built-in + CSP headers)
- [x] CSRF tokens (Better Auth handled)
- [x] Rate limiting (Cloudflare Workers built-in)
- [x] Secure headers (Hono security middleware)
- [x] Environment variables for secrets (Cloudflare secrets)


## API Structure

### REST Endpoints
```
GET    /api/[resource]      # List
GET    /api/[resource]/:id  # Get one
POST   /api/[resource]      # Create
PUT    /api/[resource]/:id  # Update
DELETE /api/[resource]/:id  # Delete
```

### Response Format
```json
{
  "success": true,
  "data": {},
  "error": null,
  "metadata": {}
}
```


## Database Schema

### Tables/Collections
```
[DEFINE YOUR SCHEMA HERE]
```

### Migrations
- **Tool**: Drizzle Kit + Cloudflare Wrangler
- **Location**: `database/migrations/` directory
- **Command**: `wrangler d1 migrations apply <DB_NAME>`


## Environment Variables

### Required Variables
```env
# Development
NODE_ENV=development

# Cloudflare Bindings (automatically injected in Workers)
# D1_DATABASE=your-d1-database
# KV_STORE=your-kv-namespace  
# AI_BINDING=@cf/workers-ai
# R2_BUCKET=your-r2-bucket

# Auth Secrets (Cloudflare secrets)
# AUTH_SECRET=your-secret-key
# GOOGLE_CLIENT_ID=your-google-oauth-id
# GOOGLE_CLIENT_SECRET=your-google-oauth-secret  
# GITHUB_CLIENT_ID=your-github-oauth-id
# GITHUB_CLIENT_SECRET=your-github-oauth-secret
```

### Setup Instructions
1. Configure `wrangler.toml` with your Cloudflare account details
2. Set Cloudflare secrets using: `wrangler secret put <SECRET_NAME>`
3. Create D1 database: `wrangler d1 create <DB_NAME>`
4. Set up KV namespace: `wrangler kv:namespace create <NAMESPACE_NAME>`
5. Never commit secrets or keys to repository


## Code Style & Conventions

### Naming Conventions
- **Files**: `kebab-case.ts`
- **Components**: `PascalCase.tsx`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **CSS Classes**: `kebab-case`

### File Organization
```
src/
├── components/   # Reusable components
├── pages/        # Route pages
├── lib/          # Utilities
├── hooks/        # Custom hooks
├── types/        # TypeScript types
├── styles/       # Global styles
└── api/          # API routes/handlers
```

### Git Configuration
- **Current Branch**: main
- **Main Branch**: main

### Git Commit Format
```
[type]: brief description

Types: feat, fix, docs, style, refactor, test, chore
```


## Deployment

### Deployment Platform
- [ ] Vercel
- [ ] Netlify
- [ ] AWS
- [ ] Heroku
- [ ] Railway
- [x] Other: **Cloudflare Workers + Pages**

### CI/CD Pipeline
- [x] GitHub Actions (Cloudflare Workers deployment)
- [ ] GitLab CI
- [ ] CircleCI
- [ ] Jenkins
- [ ] Other: _____________

### Production Checklist
- [x] Environment variables configured (Cloudflare secrets)
- [x] Database migrations run (D1)
- [x] SSL certificates active (Cloudflare managed)
- [x] Monitoring setup (Cloudflare Analytics + Workers analytics)
- [x] Error tracking enabled (Hono error handling + Cloudflare logs)
- [x] Backups configured (D1 automatic backups)


## Monitoring & Logging

### Error Tracking
- **Service**: [ ] Sentry [ ] Bugsnag [ ] Rollbar [x] Custom (Cloudflare Workers analytics)
- **DSN**: Built-in Cloudflare Workers error reporting

### Analytics
- **Service**: [ ] GA4 [ ] Posthog [ ] Mixpanel [ ] Plausible [x] Cloudflare Web Analytics
- **ID**: Configured in Cloudflare dashboard

### Logging
- **Level**: [x] Debug [x] Info [x] Warn [x] Error
- **Destination**: [x] Console [x] File [x] Cloud service (Cloudflare Logpush)


## Performance Requirements

### Load Time Targets
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Largest Contentful Paint**: < 2.5s

### Optimization Checklist
- [x] Code splitting implemented (Vite + TanStack Router)
- [x] Images optimized (Cloudflare Image Resizing + R2)
- [x] Lazy loading enabled (React.lazy + TanStack Router)
- [x] Caching strategy defined (Cloudflare CDN + KV + browser cache)
- [x] Database queries optimized (Drizzle ORM + D1 prepared statements)


## Project-Specific Instructions

### Cloudflare AI Showcase Features

This template demonstrates the full breadth of Cloudflare's capabilities:

#### AI & ML Features
- **Text Generation**: Using `@cf/meta/llama-2-7b-chat-int8` and OpenAI-compatible endpoints
- **Image Generation**: Integration with `@cf/stabilityai/stable-diffusion-xl-base-1.0`
- **Text Embeddings**: Vector search with `@cf/baai/bge-base-en-v1.5`
- **Audio Transcription**: Speech-to-text with `@cf/openai/whisper`
- **Real-time AI Chat**: WebSocket-based chat with streaming responses

#### Cloudflare Infrastructure Showcase
- **Workers**: Serverless compute with sub-10ms cold starts
- **D1**: Planet-scale SQLite database with global replication
- **KV**: Global key-value storage for sessions and cache
- **R2**: Object storage for user uploads and generated content
- **Durable Objects**: Stateful WebSocket connections and real-time features
- **Pages**: Static site hosting with SPA fallback
- **CDN**: Global content delivery and caching

#### Vercel AI SDK Integration
- **Components**: `useChat`, `useCompletion`, `useAssistant` hooks
- **Streaming UI**: Real-time message rendering with proper loading states
- **Tool Calling**: Function calling capabilities with schema validation
- **Image Generation UI**: Interactive image generation with progress indicators

#### Template Usage Guidelines
1. **Feature Demonstration**: Each route showcases specific Cloudflare + AI capabilities
2. **Code Examples**: Well-documented patterns for common AI/cloud integrations
3. **Performance**: Optimized for Cloudflare's edge computing model
4. **Scalability**: Designed to handle production workloads across global regions

#### Development Workflow
- Use `npm run dev` for full-stack development with hot reload
- Test AI features with mock responses in development
- Deploy incrementally using `wrangler deploy`
- Monitor performance using Cloudflare Analytics dashboard
