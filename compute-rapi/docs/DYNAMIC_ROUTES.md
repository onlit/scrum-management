# Dynamic Routes Architecture

This document describes the dynamic routes architecture used in generated frontend applications. This architecture consolidates hundreds of static entity pages into a single pair of dynamic routes, dramatically reducing code duplication and improving maintainability.

## Overview

### Problem Statement

Previously, each entity type in a microservice required its own set of static page files:
- `src/pages/{entity-slug}/index.tsx` - List page
- `src/pages/{entity-slug}/[id].tsx` - Detail page
- `src/pages/{entity-slug}/create.tsx` - Create page

For a microservice with 395 entity types, this resulted in approximately 790+ page files containing largely duplicated code. This caused:
- Massive build memory consumption
- High disk space usage
- Difficult maintenance (changes needed in hundreds of locations)
- Webpack exhaustion issues during builds

### Solution: Dynamic Routes

The dynamic routes architecture consolidates all entity pages into:
- **2 dynamic route files** instead of hundreds of static pages
- **1 entity registry** that maps entity slugs to configurations
- **2 generic components** for list and detail pages

## Architecture

### File Structure

```
src/
├── config/
│   └── entityRegistry.ts          # Maps entity slugs to configurations
├── components/
│   ├── GenericListPage.tsx        # Reusable list page component
│   └── GenericDetailPage.tsx      # Reusable detail page component
└── pages/
    └── [listType]/
        ├── index.tsx              # Dynamic list route
        └── [id].tsx               # Dynamic detail route
```

### Entity Registry

The entity registry (`src/config/entityRegistry.ts`) is the heart of the system. It:

1. **Maps entity slugs to configurations** - Each entity slug (e.g., `account-types`) maps to an `EntityConfig` object
2. **Auto-converts naming conventions** - Automatically derives PascalCase, camelCase, and display names from slugs
3. **Lazy loads components** - Uses property access on barrel imports to load forms, columns, and data mappers

```typescript
export interface EntityConfig {
  singularName: string;        // "Account Type"
  pluralName: string;          // "Account Types"
  routeKey: string;            // "{microservice}/getAccountTypeURL"
  importModel: string;         // "accountType"
  CreateForm: () => Promise<{ default: ComponentType<any> }>;
  DetailForm: () => Promise<{ default: ComponentType<any> }>;
  columns: () => Promise<ColumnConfig[]>;
  dataMapper: () => Promise<(row: any) => any>;
  helpfulHint?: string;
}
```

### Generic Components

#### GenericListPage

The `GenericListPage` component:
- Dynamically loads `CreateForm`, `columns`, and `dataMapper` based on entity config
- Handles bulk actions (reminder creation)
- Manages loading states
- Renders the standard list page UI

#### GenericDetailPage

The `GenericDetailPage` component:
- Dynamically loads `DetailForm` based on entity config
- Fetches and displays entity data
- Handles tabs (INAs, related entities)
- Renders breadcrumb navigation

### Dynamic Route Files

The routes in `src/pages/[listType]/` handle URL resolution:

1. **Validate the entity slug** using `isValidEntitySlug()`
2. **Return 404** if the entity type doesn't exist
3. **Load entity config** from the registry
4. **Render the appropriate generic component**

## Configuration

### Enabling Dynamic Routes

Dynamic routes are **enabled by default** for new microservices. To disable them and use legacy static pages, set `useDynamicRoutes: false` on the microservice:

```javascript
// In microservice configuration
{
  name: 'MyMicroservice',
  useDynamicRoutes: false  // Use legacy static pages
}
```

### Generated Files

When dynamic routes are enabled, the generator creates:
- `src/config/entityRegistry.ts`
- `src/components/GenericListPage.tsx`
- `src/components/GenericDetailPage.tsx`
- `src/pages/[listType]/index.tsx`
- `src/pages/[listType]/[id].tsx`

When disabled (legacy mode), it creates individual page files for each entity.

## Customization

### Domain Customizations

Custom entity-specific logic should be placed in the `src/domain/` directory, which is protected and never overwritten during regeneration.

### Adding Custom Bulk Actions

Extend `GenericListPage` by passing `additionalBulkActions`:

```tsx
<GenericListPage
  entityConfig={entityConfig}
  entitySlug={listType}
  additionalBulkActions={[
    {
      key: 'customAction',
      label: 'Custom Action',
      onClick: ({ selectedIds }) => { /* ... */ },
    },
  ]}
/>
```

### Adding Custom Tabs

Extend `GenericDetailPage` by passing `additionalTabs`:

```tsx
<GenericDetailPage
  entityConfig={entityConfig}
  entitySlug={listType}
  additionalTabs={[
    {
      key: 'customTab',
      label: 'Custom Tab',
      content: <CustomTabContent />,
    },
  ]}
/>
```

### Hiding Default Tabs

Use `hiddenTabs` to hide default tabs:

```tsx
<GenericDetailPage
  entityConfig={entityConfig}
  entitySlug={listType}
  hiddenTabs={['inas']}  // Hide INAs tab
/>
```

## Migration Guide

### Migrating from Static Pages

If you have an existing microservice using static pages:

1. **Backup any custom domain logic** from individual page files
2. **Set `useDynamicRoutes: true`** on the microservice
3. **Regenerate the frontend** using the compute-rapi generator
4. **Move custom logic** to the `src/domain/` directory or use the customization hooks
5. **Delete old static page directories** (optional, they won't be used)

### Preserving Custom Behavior

If a specific entity needs custom behavior:

1. Create a custom component in `src/domain/components/`
2. Modify the entity registry to use the custom component
3. Or, keep the static page for that specific entity while using dynamic routes for others

## Benefits

| Metric | Before (Static Pages) | After (Dynamic Routes) |
|--------|----------------------|------------------------|
| Page files | ~790 files | 2 files |
| Lines of code | ~26,000 lines | ~1,000 lines |
| Build time | Slow (webpack exhaustion) | Fast |
| Memory usage | High | Low |
| Maintenance | Change 395 files | Change 1-2 files |

## Technical Details

### Lazy Loading Pattern

Components are lazy-loaded using property access on barrel imports to avoid webpack's template literal issues:

```typescript
// Problem: Template literals don't work with webpack
CreateForm: () => import(`@ps/entity-core/${slug}/forms/CreateForm`)  // ❌

// Solution: Property access on barrel import
CreateForm: async () => ({ default: (Barrel as any)[componentName] })  // ✅
```

### Naming Convention Helpers

The registry includes helper functions for converting between naming conventions:

- `slugToPascalCase('account-types')` → `'AccountType'`
- `slugToCamelCase('account-types')` → `'accountType'`
- `slugToDisplayName('account-types')` → `'Account Types'`

These handle edge cases like:
- Irregular plurals: `'ies'` → `'y'`
- Words ending in `'ses'`, `'xes'`, `'ches'`, `'shes'`
- Special cases: `'bases'`, `'cases'`, `'phases'`

## Troubleshooting

### Entity Not Found Errors

If you see "Unknown entity type" errors:
1. Check that the entity slug is in the `ENTITY_SLUGS` array in `entityRegistry.ts`
2. Verify the slug matches the URL pattern exactly (kebab-case)
3. Ensure the entity's forms, columns, and data mappers exist in entity-core

### Component Loading Failures

If components fail to load:
1. Check browser console for import errors
2. Verify the component exists in the entity-core barrel export
3. Ensure naming conventions match (e.g., `AccountTypeCreate`, `accountTypeColumns`)

### Build Errors

If builds fail after enabling dynamic routes:
1. Run `pnpm generate:registries` to regenerate entity-core registries
2. Clear build cache: `rm -rf .next`
3. Reinstall dependencies: `pnpm install`
