# Overview

This is a full-stack AI development platform that combines a React TypeScript frontend with an Express.js backend. The application provides an integrated development environment with features for AI model management, code editing, project management, terminal access, and browser automation. It's designed as a comprehensive workspace for AI-powered development workflows.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript in SPA (Single Page Application) mode
- **Routing**: Wouter for client-side routing with page-based navigation
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Framework**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS styling
- **Build Tool**: Vite for development and production builds with ESM modules

## Backend Architecture
- **Runtime**: Node.js with Express.js framework using ES modules
- **API Design**: RESTful APIs with Socket.IO for real-time communication (terminal sessions)
- **File Structure**: Monorepo with shared types and schemas between client and server
- **Development**: tsx for TypeScript execution in development mode

## Database & ORM
- **Database**: PostgreSQL (configured for Neon serverless)
- **ORM**: Drizzle ORM with type-safe schema definitions
- **Schema Management**: Drizzle Kit for migrations and schema push operations
- **Connection**: Connection pooling with @neondatabase/serverless for serverless environments

## Authentication & External Services
- **GitHub Integration**: OAuth-based GitHub client using Octokit for repository operations
- **Token Management**: Replit connector system for secure credential management
- **Session Management**: PostgreSQL session storage with connect-pg-simple

## Core Features & Services

### Model Management
- **Ollama Integration**: Local AI model management with download progress tracking
- **HuggingFace Integration**: Remote model search and download capabilities
- **Model Lifecycle**: Status tracking (downloading, ready, running, error) with performance metrics

### Development Environment
- **Code Editor**: File system integration with syntax highlighting and multi-tab editing
- **Terminal Service**: Multi-session terminal management with WebSocket communication
- **File Operations**: Complete file system CRUD operations with directory traversal
- **Project Management**: Template-based project scaffolding with GitHub repository cloning

### Real-time Communication
- **WebSockets**: Socket.IO for terminal sessions and live updates
- **Event Handling**: Real-time model status updates and terminal output streaming

## Build & Deployment
- **Development**: Concurrent client and server development with Vite HMR
- **Production**: Vite builds static assets, esbuild bundles server code
- **Asset Management**: Separate client/server builds with proper asset resolution

## Type Safety & Validation
- **Shared Schemas**: Zod schemas with Drizzle integration for runtime validation
- **TypeScript Configuration**: Strict typing with path mapping for clean imports
- **Form Handling**: React Hook Form with Zod resolvers for type-safe form validation

# External Dependencies

## Core Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless connection driver
- **@octokit/rest**: GitHub API client for repository operations
- **drizzle-orm**: Type-safe ORM with PostgreSQL support
- **socket.io**: Real-time bidirectional communication
- **@tanstack/react-query**: Server state management and caching

## UI & Styling
- **@radix-ui/***: Accessible UI primitives for components
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library for consistent iconography
- **wouter**: Lightweight client-side routing

## Development Tools
- **vite**: Frontend build tool and dev server
- **tsx**: TypeScript execution for Node.js
- **drizzle-kit**: Database schema management and migrations

## Authentication & Connectors
- **Replit Connectors**: GitHub OAuth integration through Replit's connector system
- **connect-pg-simple**: PostgreSQL session store for Express sessions

## Optional Integrations
- **Replit Development Plugins**: Error overlay, cartographer, and dev banner for Replit environment
- **WebSocket (ws)**: For Neon database WebSocket connections