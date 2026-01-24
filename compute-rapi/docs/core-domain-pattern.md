# Core/Domain Separation Pattern

## Overview

The frontend generators produce code following a core/domain separation pattern that allows customization while surviving regeneration.

## Structure

### Entity-Core Package

```
packages/entity-core/src/{microservice}/
├── core/                      # Regenerated on each run
│   ├── index.ts              # Barrel exports for core
│   ├── configs/
│   │   ├── tableColumns/
│   │   ├── dataMappers/
│   │   └── validationSchemas/
│   └── forms/
│       ├── {Model}Create/
│       └── {Model}Detail/
├── domain/                    # PROTECTED - never overwritten
│   └── index.ts              # Domain customizations
└── index.ts                  # Barrel export (core + domain)
```

### App Package

```
apps/{microservice}/src/
├── core/                      # Regenerated on each run
│   └── pages/
│       └── {model-slug}/
│           ├── {Model}ListCore.tsx
│           ├── {Model}DetailCore.tsx
│           └── index.ts
├── domain/                    # PROTECTED - never overwritten
│   └── index.ts
└── pages/                     # Wrapper pages
    └── {model-slug}/
        ├── index.tsx
        └── [id].tsx
```

## Import Patterns

### Recommended (via barrel export)
```typescript
import {
  PaymentIntentCreate,
  paymentIntentColumns
} from '@ps/entity-core/payment';
```

### Direct Core Access
```typescript
import PaymentIntentCreate from '@ps/entity-core/payment/core/forms/PaymentIntentCreate/PaymentIntentCreate';
```

## Customization

### Adding Domain Extensions

1. Create your extension in the domain directory
2. Export it from `domain/index.ts`
3. The barrel export automatically includes it

### Extension Naming Conventions

| Type | Core Export | Domain Override |
|------|-------------|-----------------|
| Form Component | `PaymentIntentCreate` | `PaymentIntentCreate` (replaces) |
| Columns | `paymentIntentColumns` | `paymentIntentColumnsExtension` (merges) |
| Data Mapper | `paymentIntentDataMapper` | `paymentIntentDataMapper` (replaces) |
| Schema | `paymentIntentSchema` | `paymentIntentSchemaExtension` (merges) |

### Example: Adding Custom Columns

```typescript
// domain/index.ts
import { ColumnConfig } from '@ps/shared-core/ui/DataTableV2/TableColumns';

export const paymentIntentColumnsExtension: ColumnConfig[] = [
  {
    accessorKey: 'customField',
    header: 'Custom Field',
    size: 200,
    type: 'text',
  },
];
```

### Example: Overriding Create Form

```typescript
// domain/index.ts
export { default as PaymentIntentCreate } from './forms/PaymentIntentCreate';
```

## Wrapper Pages

Wrapper pages in `src/pages/` compose core components with domain customizations:

### List Page Example

```tsx
import { PaymentIntentListCore } from '@/core/pages/payment-intents';
import { customBulkActions } from '@/domain';

export default function PaymentIntentList() {
  return (
    <PaymentIntentListCore
      additionalBulkActions={customBulkActions}
    />
  );
}
```

### Detail Page Example

The DetailCore component generates all tabs internally (INA tab + related model tabs).
Use `additionalTabs` to add custom tabs and `hiddenTabs` to hide generated ones:

```tsx
import { PaymentIntentDetailCore } from '@/core/pages/payment-intents';
import { PaymentIntentDetail } from '@ps/entity-core/payment';
import { customTabs } from '@/domain';

export default function PaymentIntentDetail() {
  return (
    <PaymentIntentDetailCore
      DetailFormComponent={PaymentIntentDetail}
      // Add custom tabs from domain
      additionalTabs={customTabs}
      // Hide specific generated tabs by key
      hiddenTabs={['inas']}
      // Add custom header actions
      additionalHeaderActions={[
        {
          icon: <SomeIcon />,
          label: 'Custom Action',
          onClick: () => console.log('clicked'),
        },
      ]}
    />
  );
}
```

#### DetailCore Props

| Prop | Type | Description |
|------|------|-------------|
| `DetailFormComponent` | `React.ComponentType` | The form component for editing record details |
| `additionalTabs` | `TabConfig[]` | Custom tabs to add after generated tabs |
| `hiddenTabs` | `string[]` | Keys of tabs to hide (e.g., `['inas', 'postalCode']`) |
| `additionalHeaderActions` | `HeaderAction[]` | Custom action buttons in the page header |
| `children` | `ReactNode` | Content rendered between header and main grid |

#### Tab Keys

Generated tabs use these keys:
- `'inas'` - The INA/reminders tab
- `'{modelName}'` - Related model tabs use camelCase model name (e.g., `'postalCode'`)

## Regeneration Behavior

| Directory | On Regeneration |
|-----------|-----------------|
| `core/` | Completely replaced |
| `domain/` | Never touched |
| `index.ts` | Regenerated |
| `pages/` wrappers | Regenerated |

## Best Practices

1. **Never modify core files** - they will be overwritten
2. **Put all customizations in domain/** - they will persist
3. **Use barrel export imports** - they combine core + domain automatically
4. **Name extensions correctly** - follow the naming conventions for proper merging
