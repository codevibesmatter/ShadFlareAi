# ShadFlare AI - Cloudflare AI Admin Dashboard

A comprehensive full-stack AI-powered admin dashboard showcasing Cloudflare's complete suite of cloud and AI capabilities. Built on the foundation of the popular shadcn-admin template, this project demonstrates advanced integration with Cloudflare Workers, AI models, and real-time features.

**🚀 Live Demo:** Experience the full power of Cloudflare's edge computing and AI capabilities in a production-ready dashboard.

## 🌟 What Makes This Special

This isn't just another admin template - it's a **comprehensive showcase** of modern cloud-native architecture with AI at its core. Starting from the excellent shadcn-admin template, we've transformed it into a full-stack application that demonstrates:

- **Edge-First Architecture**: Built for Cloudflare Workers with sub-10ms cold starts
- **Advanced AI Integration**: Multiple AI models for chat, voice, image generation, and embeddings
- **Real-Time Features**: WebSocket-based live chat and voice transcription
- **Production-Ready**: Comprehensive authentication, state management, and testing
- **Developer Experience**: Hot reload, TypeScript, and extensive tooling

## 🎯 Core Features

### 🤖 AI & Machine Learning
- **Advanced Chat Interface**: Streaming AI responses with Vercel AI SDK integration
- **Voice Transcription**: Real-time speech-to-text using Cloudflare's Whisper model
- **Text Generation**: Multiple AI models including Llama and Nova-3
- **Image Generation**: AI-powered image creation with Stable Diffusion
- **Embeddings & Vector Search**: Semantic search capabilities
- **Artifact System**: Interactive code and content generation with persistence

### 🌐 Real-Time & WebSocket Features
- **Live Chat**: WebSocket-based AI conversations with connection stability
- **Voice AI**: Real-time voice transcription with manual controls
- **Cross-Device Sync**: Session management across multiple devices
- **Connection Recovery**: Robust WebSocket reconnection handling

### ☁️ Cloudflare Infrastructure Showcase
- **Workers**: Serverless compute with global edge deployment
- **D1 Database**: Planet-scale SQLite with Drizzle ORM
- **KV Storage**: Global key-value store for sessions and caching
- **R2 Object Storage**: File uploads and media management
- **Durable Objects**: Stateful WebSocket connections
- **Workers AI**: Complete AI model integration

### 🎨 UI & User Experience
- **Modern Design**: ShadcnUI components with TailwindCSS
- **Responsive Layout**: Mobile-first design with sidebar navigation
- **Dark/Light Mode**: Seamless theme switching
- **RTL Support**: Right-to-left language compatibility
- **Accessibility**: WCAG compliant with keyboard navigation
- **Global Search**: Command palette for quick navigation

### 🔐 Authentication & Security
- **Better Auth**: Email/password and OAuth (Google, GitHub)
- **Session Management**: Secure session handling with auto-expiry
- **API Documentation**: Interactive OpenAPI documentation
- **Rate Limiting**: Built-in protection against abuse

<details>
<summary>Customized Components (click to expand)</summary>

This project uses Shadcn UI components, but some have been slightly modified for better RTL (Right-to-Left) support and other improvements. These customized components differ from the original Shadcn UI versions.

If you want to update components using the Shadcn CLI (e.g., `npx shadcn@latest add <component>`), it's generally safe for non-customized components. For the listed customized ones, you may need to manually merge changes to preserve the project's modifications and avoid overwriting RTL support or other updates.

> If you don't require RTL support, you can safely update the 'RTL Updated Components' via the Shadcn CLI, as these changes are primarily for RTL compatibility. The 'Modified Components' may have other customizations to consider.

### Modified Components

- scroll-area
- sonner
- separator

### RTL Updated Components

- alert-dialog
- calendar
- command
- dialog
- dropdown-menu
- select
- table
- sheet
- sidebar
- switch

**Notes:**

- **Modified Components**: These have general updates, potentially including RTL adjustments.
- **RTL Updated Components**: These have specific changes for RTL language support (e.g., layout, positioning).
- For implementation details, check the source files in `src/components/ui/`.
- All other Shadcn UI components in the project are standard and can be safely updated via the CLI.

</details>

## 🛠️ Tech Stack

### Frontend
- **[React 19](https://react.dev/)** - Latest React with concurrent features
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development
- **[Vite](https://vitejs.dev/)** - Lightning-fast build tool with HMR
- **[ShadcnUI](https://ui.shadcn.com)** - Modern component library (TailwindCSS + RadixUI)
- **[TanStack Router](https://tanstack.com/router/latest)** - Type-safe file-based routing
- **[TanStack Query](https://tanstack.com/query/latest)** - Powerful server state management
- **[Vercel AI SDK](https://sdk.vercel.ai/)** - AI chat components and streaming
- **[Legend State v3](https://www.legendapp.com/open-source/state/)** - Reactive state management

### Backend & Infrastructure
- **[Cloudflare Workers](https://workers.cloudflare.com/)** - Edge serverless compute
- **[Hono](https://hono.dev/)** - Ultra-fast web framework with OpenAPI
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** - Serverless SQLite database
- **[Drizzle ORM](https://orm.drizzle.team/)** - Type-safe database operations
- **[Better Auth](https://www.better-auth.com/)** - Modern authentication with OpenAPI docs
- **[Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)** - Complete AI model suite
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)** - Stateful edge computing

### Development & Quality
- **[ESLint](https://eslint.org/)** & **[Prettier](https://prettier.io/)** - Code quality and formatting
- **[Playwright](https://playwright.dev/)** - E2E testing with MCP integration
- **[Vitest](https://vitest.dev/)** - Fast unit testing
- **[TypeScript](https://www.typescriptlang.org/)** - Full type safety across stack

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm/pnpm/yarn
- Cloudflare account (for deployment)

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/codevibesmatter/ShadFlareAi.git
cd ShadFlareAi
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

The app will start at `http://localhost:5174` with the integrated Cloudflare Workers runtime.

### 🧪 Test Account
For immediate testing:
- **Email:** `demo@example.com`
- **Password:** `password123`

### 📚 API Documentation
- **Swagger UI:** `http://localhost:5174/api/ui`
- **Auth Reference:** `http://localhost:5174/api/auth/reference`

### 🎮 Available Features
- `/ai-chat` - Advanced AI chat with streaming responses
- `/voice-ai` - Real-time voice transcription
- `/ai-chat-enhanced` - Feature-rich chat with artifacts
- `/conversation-ai` - Multi-modal AI conversations

## 🏗️ Architecture Highlights

### Edge-First Design
- **Global Distribution**: Deployed across 300+ Cloudflare edge locations
- **Sub-10ms Latency**: Workers cold start in under 10ms worldwide
- **Automatic Scaling**: Handles millions of requests without provisioning

### Real-Time Architecture
- **WebSocket Stability**: Custom connection manager with automatic recovery
- **Durable Objects**: Stateful connections that survive edge failures
- **Cross-Device Sync**: Sessions synchronized across multiple devices

### AI Integration Patterns
- **Streaming Responses**: Non-blocking AI responses with proper error handling
- **Model Flexibility**: Easy switching between different AI providers
- **Artifact System**: Persistent code generation with version control

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start dev server with Workers runtime
npm run build           # Production build
npm run preview         # Preview production build

# Code Quality  
npm run lint            # ESLint checking
npm run format          # Prettier formatting
npm run typecheck       # TypeScript validation

# Testing
npm run test            # Run unit tests
npm run test:e2e        # Playwright E2E tests
npm run test:coverage   # Coverage report

# Cloudflare
wrangler deploy         # Deploy to Cloudflare
wrangler d1 migrations apply <DB>  # Run database migrations
```

## 📖 Documentation

Comprehensive guides and API documentation:

- **[Getting Started Guide](./docs/getting-started.md)** - Complete setup walkthrough
- **[AI Features Guide](./docs/ai-features.md)** - Using AI models and chat
- **[WebSocket Guide](./docs/websocket.md)** - Real-time feature implementation
- **[Deployment Guide](./docs/deployment.md)** - Production deployment steps
- **[API Reference](http://localhost:5174/api/ui)** - Interactive OpenAPI docs

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License

This project builds upon the excellent [shadcn-admin](https://github.com/satnaing/shadcn-admin) template by [@satnaing](https://github.com/satnaing).

**Original Template Credits:** Crafted with 🤍 by [@satnaing](https://github.com/satnaing)

**ShadFlare AI Enhancements:** Built with ⚡ by the ShadFlare AI team

Licensed under the [MIT License](https://choosealicense.com/licenses/mit/)

---

## 🌟 Acknowledgments

- **Cloudflare Team** - For the incredible Workers platform and AI models
- **Vercel Team** - For the excellent AI SDK integration patterns
- **shadcn** - For the beautiful UI component system
- **Original shadcn-admin** - [@satnaing](https://github.com/satnaing) for the excellent foundation

**⭐ If this project helps you, please consider giving it a star!**
