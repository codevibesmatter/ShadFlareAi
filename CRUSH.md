# CRUSH.md - Development Commands and Guidelines

## Development Commands

### Frontend
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production (TypeScript + Vite)
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting
- `npm run knip` - Find unused dependencies

### Cloudflare Workers
- `wrangler dev` - Start local Workers dev server
- `wrangler deploy` - Deploy to Cloudflare
- `wrangler d1 execute <DB_NAME> --file=<FILE>` - Run SQL against D1
- `wrangler d1 migrations apply <DB_NAME>` - Apply database migrations

## Code Style Guidelines

### Imports
- Use absolute imports with `@/` alias (maps to `src/`)
- Group imports: 3rd party, then local
- Sort alphabetically within groups

### Formatting
- Use Prettier for formatting (configured in .prettierrc)
- 2-space indentation
- 80-character line limit
- Use TypeScript for type safety

### Types
- Use TypeScript interfaces and types
- Prefer interfaces over types for object shapes
- Use `unknown` instead of `any`

### Naming
- PascalCase for components and types
- camelCase for functions and variables
- snake_case for constants
- Use descriptive names (avoid abbreviations)

### Error Handling
- Use try/catch for async operations
- Handle errors at the boundary
- Use custom error classes when needed
- Log errors to console in development mode

### Best Practices
- Avoid console.log in production
- Use hooks and context for state management
- Follow feature-based organization in `src/features/`
- Use TanStack Query for data fetching
- Maintain RTL support for UI components

💘 Generated with Crush
Co-Authored-By: Crush <crush@charm.land>