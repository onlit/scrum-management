# Template Placeholder Conventions

This document defines the standard conventions for placeholders used in code generation templates within the `src/computeConstructors/` folder.

## Overview

The template system uses an explicit `@gen` marker scheme to distinguish placeholders from natural text, preventing accidental replacements and substring collisions. All placeholders are replaced in a single pass during code generation.

## Placeholder Types

### 1. Inline Placeholders

Used for text substitution inside strings, JSX content, variable names, and other inline contexts.

**Syntax**: `@gen{TOKEN}` or `@gen{TOKEN|transform}`

**Examples**:
```javascript
// Basic substitution
<h1>@gen{MODEL_LABEL}</h1>
const tableName = '@gen{MODEL_NAME}';

// With case transforms
const url = get@gen{MODEL_NAME|Pascal}URL(id);
import @gen{MODEL_NAME|camel}Router from './routes/@gen{MODEL_NAME|kebab}';
const title = '@gen{MODEL_LABEL|StartCase}';
```

**Available Transforms**:
- `camel` - camelCase (e.g., `userProfile`)
- `Pascal` - PascalCase (e.g., `UserProfile`)
- `kebab` - kebab-case (e.g., `user-profile`)
- `StartCase` - Start Case (e.g., `User Profile`)
- `snake` - snake_case (e.g., `user_profile`)
- `UPPER_SNAKE` - UPPER_SNAKE_CASE (e.g., `USER_PROFILE`)

### 2. Anchor Placeholders

Used for code injection points where entire blocks or lists need to be inserted or replaced.

#### Single-Line Anchors

Used for appending or inserting single items (imports, enum entries, etc.).

**Syntax**: `// @gen:ANCHOR_NAME`

**Examples**:
```javascript
// JavaScript/TypeScript
import express from 'express';
// @gen:IMPORTS

const entities = {
  USER: 'user',
  // @gen:REMINDER_ENTITY_MICROSERVICES
};
```

```html
<!-- HTML/JSX comments -->
<div>
  <!-- @gen:COMPONENTS -->
</div>
```

```css
/* CSS comments */
.container {
  /* @gen:STYLES */
}
```

#### Ranged Block Anchors

Used for replacing entire sections of code that span multiple lines.

**Syntax**:
```
// @gen:start:BLOCK_NAME
... generated content ...
// @gen:end:BLOCK_NAME
```

**Examples**:
```javascript
// Route definitions
router.get('/users', getUsers);
// @gen:start:ROUTES
router.get('/profiles', getProfiles);
router.post('/profiles', createProfile);
// @gen:end:ROUTES
router.get('/settings', getSettings);

// Model imports
// @gen:start:MODEL_IMPORTS
import { User } from './models/User';
import { Profile } from './models/Profile';
// @gen:end:MODEL_IMPORTS
```

## Naming Conventions

### Token Names

All tokens use **UPPER_SNAKE_CASE** and should be descriptive and namespaced when helpful.

**Good Examples**:
- `MODEL_NAME` - Name of the current model
- `MODEL_LABEL` - Display label for the model
- `FIELD_NAME` - Name of a field
- `MICROSERVICE_NAME` - Name of the microservice
- `REMINDER_ENTITY_MICROSERVICES` - Specific anchor for entity reminders

**Bad Examples**:
- `name` - Too generic, not clearly a placeholder
- `ModelName` - Not UPPER_SNAKE_CASE
- `model-name` - Wrong case format

### Anchor Names

Anchor names should clearly indicate their purpose:
- `IMPORTS` - General imports section
- `ROUTES` - Route definitions
- `MODELS` - Model definitions
- `COMPONENTS` - Component declarations
- `REMINDER_ENTITY_MICROSERVICES` - Specific reminder anchor

For ranged blocks, use descriptive names:
- `MODEL_IMPORTS` - Import statements for models
- `ROUTE_HANDLERS` - Route handler functions
- `VALIDATION_SCHEMAS` - Validation schema definitions

## Replacement Rules

### Critical Rules

1. **Only replace marked placeholders** - Never replace plain words or text that doesn't match the `@gen` pattern
2. **Single-pass replacement** - All placeholders are replaced in one pass to avoid cascading matches
3. **Preserve formatting** - Maintain indentation and whitespace around placeholders
4. **Keep anchor markers** - For single-line anchors that support appending, preserve the marker after replacement

### Example: Avoiding Substring Collisions

**Wrong** (matching plain text):
```javascript
// This would incorrectly replace "Model" in "Fee Model"
content = content.replace(/Model/g, 'Invoice');
// Result: "Fee Invoice" ❌
```

**Correct** (using @gen markers):
```javascript
// This only replaces explicit placeholders
content = content.replace(/@gen\{MODEL_NAME\}/g, 'Invoice');
// "Fee Model" remains unchanged ✓
// "@gen{MODEL_NAME}" becomes "Invoice" ✓
```

## Regular Expressions

### Inline Placeholder Regex

```javascript
/@gen\{([A-Z0-9_]+)(?:\|([A-Za-z]+))?\}/g
```

**Capture Groups**:
1. Token name (e.g., `MODEL_NAME`)
2. Optional transform (e.g., `Pascal`)

### Anchor Placeholder Regex

```javascript
/^[ \t]*(?:\/\/|#|<!--|{\/\*|\*)[ \t]*@gen:(start:|end:)?([A-Z0-9:_-]+)[ \t]*(?:\*\/|-->)?[ \t]*$/gm
```

**Capture Groups**:
1. Block type (`start:`, `end:`, or empty for single-line)
2. Anchor name (e.g., `IMPORTS`, `ROUTES`)

**Supported Comment Styles**:
- JavaScript/TypeScript: `// @gen:ANCHOR`
- Python/Bash: `# @gen:ANCHOR`
- HTML: `<!-- @gen:ANCHOR -->`
- CSS/JSX: `/* @gen:ANCHOR */` or `{/* @gen:ANCHOR */}`

## Implementation Examples

### Single-Line Anchor Append (Idempotent)

```javascript
// Append to enum while preserving marker
if (modifiedContent.includes('// @gen:REMINDER_ENTITY_MICROSERVICES')) {
  const entry = `${toStartCaseUpperUnderscore(microservice.name)}: '${microservice.name}',\n// @gen:REMINDER_ENTITY_MICROSERVICES`;
  modifiedContent = modifiedContent.replace(
    '// @gen:REMINDER_ENTITY_MICROSERVICES',
    entry
  );
}
```

### Inline Placeholder with Transform

```javascript
// Replace with case transformation
const replaceInline = (content, token, value, transform) => {
  const transformedValue = applyTransform(value, transform);
  const pattern = new RegExp(`@gen\\{${token}(?:\\|${transform})?\\}`, 'g');
  return content.replace(pattern, transformedValue);
};

// Usage
content = replaceInline(content, 'MODEL_NAME', 'userProfile', 'Pascal');
// @gen{MODEL_NAME|Pascal} → UserProfile
```

### Ranged Block Replacement

```javascript
// Replace content between start and end markers
const replaceBlock = (content, blockName, newContent) => {
  const startMarker = `// @gen:start:${blockName}`;
  const endMarker = `// @gen:end:${blockName}`;
  const pattern = new RegExp(
    `${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`,
    'g'
  );
  return content.replace(
    pattern,
    `${startMarker}\n${newContent}\n${endMarker}`
  );
};
```

## Common Tokens Reference

### Model-Related
- `@gen{MODEL_NAME}` - Model name (e.g., `userProfile`)
- `@gen{MODEL_LABEL}` - Display label (e.g., `User Profile`)
- `@gen{MODEL_NAME|Pascal}` - PascalCase model name (e.g., `UserProfile`)
- `@gen{MODEL_NAME|kebab}` - Kebab-case model name (e.g., `user-profile`)

### Field-Related
- `@gen{FIELD_NAME}` - Field name
- `@gen{FIELD_TYPE}` - Field data type
- `@gen{FIELD_LABEL}` - Field display label
- `@gen{FIELD_DEFAULT}` - Default value

### Microservice-Related
- `@gen{MICROSERVICE_NAME}` - Microservice name
- `@gen{MICROSERVICE_LABEL}` - Microservice display label
- `@gen{MICROSERVICE_PORT}` - Service port number

### Path-Related
- `@gen{API_PATH}` - API endpoint path
- `@gen{ROUTE_PATH}` - Frontend route path

## Common Anchors Reference

### Single-Line Anchors
- `// @gen:IMPORTS` - Import statements
- `// @gen:ROUTES` - Route definitions
- `// @gen:EXPORTS` - Export statements
- `// @gen:REMINDER_ENTITY_MICROSERVICES` - Entity microservice enum entries

### Ranged Block Anchors
- `// @gen:start:MODEL_IMPORTS` / `// @gen:end:MODEL_IMPORTS` - Model import blocks
- `// @gen:start:ROUTES` / `// @gen:end:ROUTES` - Route definition blocks
- `// @gen:start:VALIDATION` / `// @gen:end:VALIDATION` - Validation schema blocks

## Best Practices

1. **Be Explicit**: Always use `@gen` markers; never rely on plain text matching
2. **Be Consistent**: Use the same token names across related templates
3. **Be Descriptive**: Choose token names that clearly indicate their purpose
4. **Test Idempotency**: Ensure anchor replacements can run multiple times safely
5. **Document Custom Tokens**: Add new tokens to this reference when creating them
6. **Use Transforms Appropriately**: Apply case transforms only when needed for code conventions
7. **Preserve Structure**: Maintain indentation and formatting when replacing blocks

## Migration Guide

When updating existing templates to use this convention:

1. Identify all dynamic content that needs replacement
2. Replace plain text patterns with `@gen{TOKEN}` inline placeholders
3. Replace comment-based injection points with `// @gen:ANCHOR` markers
4. Update generator scripts to use the standard regex patterns
5. Test thoroughly to ensure no unintended replacements occur

## Why This Works

✅ **Prevents substring collisions**: `@gen{MODEL}` won't match "Model" in "Fee Model"

✅ **Single-pass safety**: Explicit delimiters prevent replacement-order bugs

✅ **Idempotent anchors**: Markers can be preserved for repeated generations

✅ **Clear intent**: Obvious distinction between template code and placeholders

✅ **Maintainable**: Consistent patterns across all templates and generators

## Related Documentation

- [Error Handling Guidelines](./ERROR_HANDLING_GUIDELINES.md)
- [Routes Controllers Design Standards](./ROUTES_CONTROLLERS_DESIGN_STANDARDS.md)
- [Prisma Enum Design Guidelines](./PRISMA_ENUM_DESIGN_GUIDELINES.md)
