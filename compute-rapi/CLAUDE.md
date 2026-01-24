# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `compute-rapi`, a Node.js/Express REST API that serves as a microservices generator and management system. The application dynamically generates complete microservice architectures including APIs, databases, frontends, and DevOps configurations based on schema definitions stored in a PostgreSQL database.

## Common Commands

### Development
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run Jest test suite

### Database
- `npx prisma migrate dev` - Run database migrations in development
- `npx prisma generate` - Generate Prisma client
- `npx prisma studio` - Open Prisma database browser
- `npx prisma db seed` - Seed database with initial data

### Code Quality
- `npx eslint .` - Run ESLint (uses airbnb-base config with Jest plugin)
- `npx prettier --write .` - Format code with Prettier

### Utilities
- `npm run convert-mermaid` - Convert Mermaid diagrams to images
- `node src/scripts/generateAPI.js` - Generate complete microservice from schema
- `node src/scripts/generateDevOps.js` - Generate DevOps configurations
- `node src/scripts/generateFrontend.js` - Generate frontend application

## Architecture Overview

### Core System Components

1. **Schema Definition Layer** (`prisma/schema.prisma`):
   - Defines microservice metadata, models, fields, enums, and relationships
   - Uses PostgreSQL with comprehensive data type support
   - Handles multilingual content through translation system

2. **Code Generation Engine** (`src/scripts/generateAPI.js`):
   - Generates complete microservice stacks from schema definitions
   - Creates API endpoints, database schemas, frontend components, and DevOps configs
   - Uses template-based generation from `src/computeConstructors/`

3. **Template System** (`src/computeConstructors/`):
   - `api/` - Backend API templates (Express, Prisma, BullMQ)
   - `frontend/` - Next.js frontend templates
   - `devops/` - Kubernetes and deployment templates

4. **API Layer** (`src/controllers/`, `src/routes/`):
   - RESTful endpoints for managing microservice definitions
   - CRUD operations for models, fields, enums, and configurations
   - Import/export functionality for schema data

### Key Architectural Patterns

- **Path Aliases**: Uses Node.js subpath imports (`#src/*`, `#configs/*`, etc.)
- **Middleware Chain**: Authentication, error handling, rate limiting, CORS
- **Schema Validation**: Joi schemas for request validation
- **Background Processing**: BullMQ for async operations (import/export)
- **Multi-tenancy**: Visibility controls and user-based filtering

### Generated Microservice Structure

When generating a microservice, the system creates:
- **Backend**: Express API with Prisma ORM, CRUD endpoints, validation
- **Frontend**: Next.js application with forms, tables, and routing
- **Database**: PostgreSQL schema with migrations
- **DevOps**: Kubernetes manifests, Docker configurations, Nginx setup
- **Git Integration**: Automated repository creation and deployment

### Dynamic Routes Architecture (Frontend)

Generated frontends use a dynamic routes architecture by default, which consolidates all entity pages into a single pair of dynamic routes:

**Key Files Generated:**
- `src/config/entityRegistry.ts` - Maps entity slugs to configurations
- `src/components/GenericListPage.tsx` - Reusable list page component
- `src/components/GenericDetailPage.tsx` - Reusable detail page component
- `src/pages/[listType]/index.tsx` - Dynamic list route
- `src/pages/[listType]/[id].tsx` - Dynamic detail route

**Benefits:**
- Reduces file count (~790 static pages → 2 dynamic routes)
- Centralized component logic for easier maintenance
- Automatic propagation of fixes across all entities
- Significantly reduced build times and memory usage

**Configuration:**
- Enabled by default (`useDynamicRoutes: true`)
- Set `useDynamicRoutes: false` on microservice to use legacy static pages

See `docs/DYNAMIC_ROUTES.md` for detailed documentation.

## Database Schema Key Models

- `Microservice` - Top-level service definition
- `ModelDefn` - Data model definitions within a microservice
- `FieldDefn` - Field definitions with types, validation, relationships
- `EnumDefn`/`EnumValue` - Enumeration types and values
- `MenuDefn` - Navigation structure for generated frontends
- `Language`/`Translation` - Internationalization support

## Configuration Files

- `src/configs/constants.js` - Application constants and field type definitions
- `src/configs/computePaths.js` - Path resolution for generated code
- `prisma/schema.prisma` - Database schema definition
- `package.json` - Dependency management with path aliases

## Testing

- Tests located in `src/__tests__/`
- Jest configuration for unit testing
- Tests cover controllers, middlewares, and utilities
- Run individual test: `npx jest src/__tests__/controllers/microservice.test.js`

## Environment Setup

Environment variables are configured through a `.env` file. Key variables include:
- `DATABASE_URL` - PostgreSQL connection string
- Host configurations for various services (`ACCOUNTS_HOST`, `HR_HOST`, etc.)
- Git integration settings (`GIT_HOST`, `GIT_USERNAME`, `GIT_ACCESS_TOKEN`)
- Server configuration (`APP_HOST`, `PORT`)

## Important Notes

- The system generates complete, deployable microservices from metadata
- Generated code follows consistent patterns and includes security measures
- Git automation handles repository creation and deployment workflows
- ERD generation creates visual representations of data models
- Import/export supports CSV and JSON formats for bulk operations
- Uses CommonJS module system with Node.js subpath imports for path aliases