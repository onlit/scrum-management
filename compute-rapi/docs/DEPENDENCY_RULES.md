# Dependency Rules Feature Documentation

**Version:** 1.0.0
**Last Updated:** 2025-01-10
**Status:** Ready for Testing & Deployment

---

## Table of Contents

- [Feature Overview](#feature-overview)
- [Architecture](#architecture)
- [API Endpoints](#api-endpoints)
- [Implementation Status](#implementation-status)
- [Usage Guide](#usage-guide)
- [Quick Reference](#quick-reference)
- [Related Code Files](#related-code-files)
- [Source Attribution](#source-attribution)

---

## Feature Overview

The Field Dependency Rules system provides a robust framework for implementing dynamic field relationships, conditional visibility, and validation requirements in forms. This feature allows administrators to create sophisticated form behaviors that respond to user input in real-time.

### Primary Use Case

**Enum-based Conditional Field Management**: Control the visibility, requirement status, and enablement of fields (particularly Foreign Keys) based on an Enum field's value. Support field groups where "at least one field must be required" based on the enum selection.

### Key Features

- ✅ Enum value → Field visibility/requirement
- ✅ Field groups with collective validation (at least one, exactly one, all, none)
- ✅ Chained dependencies (A → B → C) with priority-based execution
- ✅ Frontend (UX) + Backend (validation) enforcement
- ✅ Backward compatible with existing `dependsOnFieldId`
- ✅ Circular dependency detection
- ✅ Extensible for future operators and actions

### Benefits

- **Dynamic Forms**: Fields appear/disappear based on user selections
- **Conditional Validation**: Requirements change based on context
- **Improved UX**: Users see only relevant fields
- **Data Integrity**: Server-side validation prevents invalid submissions
- **Maintainability**: Centralized rule management

---

## Architecture

### System Components

The Dependency Rules system consists of three main layers:

#### 1. Database Layer

**Core Models:**

- **`FieldGroup`** - Groups related fields with collective validation requirements
- **`FieldDependencyRule`** - Defines actions to perform on target fields
- **`FieldDependencyCondition`** - Individual conditions that trigger rules

**Key Enums:**

- `DependencyActionType` - Show, Hide, Require, Optional, Enable, Disable
- `DependencyConditionOperator` - Equals, NotEquals, In, NotIn, IsSet, IsNotSet
- `DependencyLogicOperator` - And, Or
- `GroupRequirementType` - AtLeastOne, ExactlyOne, All, None

#### 2. Backend Layer

**Controllers:**

- `fieldDependencyRule.controller.js` - CRUD operations for rules
- `fieldGroup.controller.js` - CRUD operations for field groups

**Utilities:**

- `dependencyRulesUtils.js` - Core evaluation and validation logic
  - `evaluateRuleConditions()` - Determines if rule conditions are met
  - `validateDependencyRules()` - Validates data against all applicable rules
  - `validateNoCircularDependencies()` - Prevents circular dependency chains
  - `getDependencyRulesForModel()` - Fetches all rules for a model

**Validation Schemas:**

- `fieldDependencyRule.schemas.js` - Joi validation for rules
- `fieldGroup.schemas.js` - Joi validation for groups

#### 3. Frontend Layer

**React Hook:**

- `useDependencyRules.ts` - Custom hook that evaluates rules and returns field states
  - Memoized for performance
  - Returns `{visible, required, enabled}` state for each field
  - Evaluates conditions in priority order

**Type Definitions:**

- `dependencyRules.ts` - TypeScript interfaces for rules, conditions, and field states

**Integration:**

- Auto-generated forms include dependency rules
- Form templates use `useDependencyRules` hook
- Field rendering conditionally based on evaluated states

### Data Flow

```
User Input → Form Values Change
           → useDependencyRules Hook
           → Evaluate Conditions (by priority)
           → Update Field States
           → Re-render Form with Updated States

On Submit → Backend Validation
          → validateDependencyRules()
          → Check All Rules
          → Return Validation Errors or Success
```

### Design Principles

1. **Priority-Based Execution** - Rules execute in order (0, 1, 2...) for chained dependencies
2. **Fail-Fast Validation** - Both client and server validate to catch errors early
3. **Circular Dependency Prevention** - Graph analysis prevents cycles at creation time
4. **Backward Compatibility** - Existing `dependsOnFieldId` continues to work
5. **Extensibility** - Easy to add new operators, actions, and requirement types

---

## API Endpoints

### Field Dependency Rules

#### List All Dependency Rules

```
GET /field-dependency-rules
```

**Query Parameters:**
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 50, max: 100)
- `search` (string) - Search in description field
- `targetFieldId` (string) - Filter by target field ID
- `action` (string) - Filter by action type
- `fieldGroupId` (string) - Filter by field group ID
- `sortBy` (string) - Field to sort by (default: priority)
- `sortOrder` (string) - `asc` or `desc` (default: asc)

**Response:** Paginated list with rules, conditions, target fields, and field groups.

#### Create Dependency Rule

```
POST /field-dependency-rules
```

**Request Body:**
```json
{
  "targetFieldId": "uuid",
  "action": "Require",
  "logicOperator": "And",
  "priority": 0,
  "fieldGroupId": "uuid",
  "description": "Rule description",
  "conditions": [
    {
      "sourceFieldId": "uuid",
      "operator": "Equals",
      "compareValue": "value"
    }
  ]
}
```

**Required Fields:**
- `targetFieldId` - Field affected by this rule
- `action` - Show, Hide, Require, Optional, Enable, Disable
- `conditions` - Array with at least one condition

**Validation:**
- Target field must exist
- All source fields must exist in same model
- No circular dependencies
- Field group (if provided) must be in same model

#### Get Dependency Rule

```
GET /field-dependency-rules/:id
```

Returns rule with all conditions, target field, and field group details.

#### Update Dependency Rule

```
PATCH /field-dependency-rules/:id
```

All fields optional. If `conditions` is provided, all existing conditions are replaced.

#### Delete Dependency Rule

```
DELETE /field-dependency-rules/:id
```

Soft-deletes the rule and cascades to conditions.

### Field Groups

#### List All Field Groups

```
GET /field-groups
```

**Query Parameters:** Same as dependency rules, plus `modelId` and `requirementType` filters.

#### Create Field Group

```
POST /field-groups
```

**Request Body:**
```json
{
  "modelId": "uuid",
  "name": "groupName",
  "label": "Group Label",
  "description": "Description",
  "requirementType": "AtLeastOne"
}
```

**Requirement Types:**
- `AtLeastOne` - At least one field must be filled
- `ExactlyOne` - Exactly one field (mutually exclusive)
- `All` - All fields required
- `None` - All fields optional

#### Get Field Group

```
GET /field-groups/:id
```

Returns group with all associated rules.

#### Update Field Group

```
PATCH /field-groups/:id
```

Update group properties (name, label, requirementType, etc.).

#### Delete Field Group

```
DELETE /field-groups/:id
```

Soft-deletes group and cascades to all associated rules.

### Error Responses

**400 Bad Request** - Validation errors
```json
{
  "error": {
    "type": "VALIDATION",
    "message": "Validation failed",
    "details": {"errors": [...]}
  }
}
```

**404 Not Found** - Resource not found
```json
{
  "error": {
    "type": "NOT_FOUND",
    "message": "Dependency rule not found"
  }
}
```

**409 Conflict** - Circular dependency detected
```json
{
  "error": {
    "type": "VALIDATION",
    "message": "Circular dependency detected. Field dependencies cannot form a cycle."
  }
}
```

---

## Implementation Status

### Overall Progress: ~82% Complete

| Phase | Status | Progress |
|-------|--------|----------|
| Database Schema | ✅ Complete | 100% |
| Backend Implementation | ✅ Complete | 100% |
| Frontend Implementation | ✅ Complete | 95% |
| Testing & Validation | ⏸️ Pending | 0% |
| Migration & Compatibility | ✅ Complete | 100% |
| Documentation | ✅ Complete | 100% |

### Completed Features

✅ **Fully Functional:**
- Database schema with all models and enums
- Prisma migration created and applied
- Backend API endpoints (CRUD for rules and groups)
- Validation and circular dependency detection
- Frontend React hook (`useDependencyRules`)
- Form generation with dependency rules
- Migration script for legacy `dependsOnFieldId`
- Complete documentation suite

### Pending Features

⏸️ **Needs Completion:**
- Table inline editing with dependency rules
- Comprehensive unit test suite
- Integration test coverage
- Manual testing of all scenarios

### Next Steps

1. **Testing Priority:**
   - Write unit tests for `dependencyRulesUtils.js`
   - Create controller tests
   - Perform manual testing of common scenarios

2. **Table Updates:**
   - Update `tableColumnsUtils.js` for inline editing support
   - Test table editing with dependency rules

3. **Production Readiness:**
   - Run migration script on staging environment
   - Monitor performance with large rule sets
   - Gather user feedback and iterate

### Known Limitations

- Frontend table inline editing doesn't yet respect dependency rules
- No unit/integration test coverage yet
- Performance with 50+ rules per model untested

---

## Usage Guide

### Basic Concepts

#### Key Components

1. **Target Field** - The field being controlled
2. **Source Field(s)** - The field(s) being evaluated
3. **Conditions** - Logic determining when the rule applies
4. **Action** - What happens when conditions are met
5. **Field Group** (optional) - Groups related fields

### Simple Examples

#### Example 1: Show Field Conditionally

**Scenario:** Show email field only when user selects "email" as contact method.

```javascript
POST /field-dependency-rules
{
  "targetFieldId": "<emailAddress-field-id>",
  "action": "Show",
  "conditions": [
    {
      "sourceFieldId": "<contactMethod-field-id>",
      "operator": "Equals",
      "compareValue": "email"
    }
  ],
  "description": "Show email when contact method is email"
}
```

**Behavior:**
- Field hidden by default
- Becomes visible when `contactMethod = "email"`
- Hidden again if user selects different value

#### Example 2: Conditional Required Field

**Scenario:** Make phone required when user selects "phone" as contact method.

```javascript
POST /field-dependency-rules
{
  "targetFieldId": "<phoneNumber-field-id>",
  "action": "Require",
  "conditions": [
    {
      "sourceFieldId": "<contactMethod-field-id>",
      "operator": "Equals",
      "compareValue": "phone"
    }
  ]
}
```

#### Example 3: Multiple Conditions (AND)

**Scenario:** Show discount field for VIP customers with orders over $100.

```javascript
POST /field-dependency-rules
{
  "targetFieldId": "<discountCode-field-id>",
  "action": "Show",
  "logicOperator": "And",
  "conditions": [
    {
      "sourceFieldId": "<customerType-field-id>",
      "operator": "Equals",
      "compareValue": "VIP"
    },
    {
      "sourceFieldId": "<orderTotal-field-id>",
      "operator": "GreaterThan",
      "compareValue": 100
    }
  ]
}
```

**Both conditions must be true.**

#### Example 4: Multiple Conditions (OR)

**Scenario:** Show expedited shipping for VIP customers OR large orders.

```javascript
POST /field-dependency-rules
{
  "targetFieldId": "<expeditedShipping-field-id>",
  "action": "Show",
  "logicOperator": "Or",
  "conditions": [
    {
      "sourceFieldId": "<customerType-field-id>",
      "operator": "Equals",
      "compareValue": "VIP"
    },
    {
      "sourceFieldId": "<orderTotal-field-id>",
      "operator": "GreaterThan",
      "compareValue": 500
    }
  ]
}
```

**At least one condition must be true.**

### Advanced Examples

#### Chained Foreign Key Dependencies

**Scenario:** Country → State → City cascade selection.

```javascript
// Step 1: Enable State when Country is selected (Priority 1)
POST /field-dependency-rules
{
  "targetFieldId": "<stateId-field-id>",
  "action": "Enable",
  "priority": 1,
  "conditions": [
    {
      "sourceFieldId": "<countryId-field-id>",
      "operator": "IsSet"
    }
  ]
}

// Step 2: Enable City when State is selected (Priority 2)
POST /field-dependency-rules
{
  "targetFieldId": "<cityId-field-id>",
  "action": "Enable",
  "priority": 2,
  "conditions": [
    {
      "sourceFieldId": "<stateId-field-id>",
      "operator": "IsSet"
    }
  ]
}
```

**Behavior:**
1. Initially only Country is enabled
2. Selecting country enables State
3. Selecting state enables City
4. Priority ensures proper execution order

#### Field Groups with "At Least One" Requirement

**Scenario:** User must provide at least one contact method.

```javascript
// Step 1: Create field group
POST /field-groups
{
  "modelId": "<contact-model-id>",
  "name": "contactInformation",
  "label": "Contact Information",
  "requirementType": "AtLeastOne"
}

// Step 2: Create rules for each contact option
// (Show + Require rules for email, phone, address)
POST /field-dependency-rules
{
  "targetFieldId": "<emailId-field-id>",
  "action": "Show",
  "fieldGroupId": "<contactInformation-group-id>",
  "conditions": [...]
}

POST /field-dependency-rules
{
  "targetFieldId": "<emailId-field-id>",
  "action": "Require",
  "fieldGroupId": "<contactInformation-group-id>",
  "conditions": [...]
}
// Repeat for other contact methods...
```

**Behavior:**
- User selects contact method from dropdown
- Only relevant field becomes visible and required
- Group validation ensures at least one contact detail provided

### Frontend Integration

#### Using useDependencyRules Hook

```typescript
import { useDependencyRules } from '@ps-admin-microfe/packages/hooks-core/src/shared/useDependencyRules';

function MyForm() {
  const [values, setValues] = useState({});
  const fieldStates = useDependencyRules(values, dependencyRules);

  return (
    <form>
      {fieldStates['emailAddress']?.visible && (
        <TextField
          name="emailAddress"
          required={fieldStates['emailAddress']?.required}
          disabled={!fieldStates['emailAddress']?.enabled}
          value={values.emailAddress}
          onChange={handleChange}
        />
      )}
    </form>
  );
}
```

**Hook Location:** `@ps-admin-microfe/packages/hooks-core/src/shared/useDependencyRules.ts`

#### Auto-Generated Forms

Forms generated by the system automatically include dependency rules:

```tsx
const dependencyRules = @gen{DEPENDENCY_RULES_JSON};
const fieldStates = useDependencyRules(values, dependencyRules);

{fieldStates['fieldName']?.visible && (
  <FormikTextField
    name="fieldName"
    required={fieldStates['fieldName']?.required}
    disabled={!fieldStates['fieldName']?.enabled}
  />
)}
```

### Common Patterns

#### Pattern 1: Show + Require

Often you want to both show AND require a field:

```javascript
// Rule 1: Show the field
{"action": "Show", "conditions": [...]}

// Rule 2: Require the field
{"action": "Require", "conditions": [...]}
```

#### Pattern 2: Cascading Dropdowns

Use `IsSet` operator with `Enable` action and ascending priorities:

```javascript
// Priority 1: Parent enables child
// Priority 2: Child enables grandchild
// Priority 3: Grandchild enables great-grandchild
```

#### Pattern 3: Multiple Options, One Required

Use field groups with `AtLeastOne` requirement:

```javascript
// Create group
// Add rules for each option
// Group validates at least one is filled
```

### Troubleshooting

#### Rule Not Triggering

**Check:**
1. Are source and target fields in same model?
2. Is condition operator correct?
3. Is compareValue the correct data type?
4. Are there conflicting rules?

**Debug:**
```javascript
console.log('Field value:', formValues.sourceFieldName);
console.log('Compare value:', rule.conditions[0].compareValue);
console.log('Match:', formValues.sourceFieldName === rule.conditions[0].compareValue);
```

#### Circular Dependency Error

**Problem:** Fields depend on each other in a cycle (A → B → A).

**Solution:**
- Review dependency chain
- Remove circular reference
- Redesign dependency logic

#### Field Group Validation Not Working

**Check:**
1. Are all rules associated with correct field group ID?
2. Is requirement type correct?
3. Are field values actually being set?

#### "In" Operator Not Matching

**Check:**
- Is compareValue an array? `["value1", "value2"]`
- Are values correct data type?
- Are values exact matches (case-sensitive)?

### Migration from Old System

If you have existing fields using `dependsOnFieldId`:

```bash
node src/scripts/migrateDependenciesToRules.js
```

This will:
- Create equivalent `FieldDependencyRule` records
- Preserve old field for backward compatibility
- Log all migrations for review

The old `dependsOnFieldId` is deprecated but still functional during transition.

---

## Quick Reference

### Action Types

| Action | Effect | Use Case |
|--------|--------|----------|
| `Show` | Make field visible | Hide by default, show conditionally |
| `Hide` | Hide field | Show by default, hide conditionally |
| `Require` | Make required | Optional by default, require conditionally |
| `Optional` | Make optional | Required by default, make optional conditionally |
| `Enable` | Enable interaction | Disabled by default, enable when dependency met |
| `Disable` | Disable interaction | Enabled by default, disable conditionally |

### Operators

| Operator | Description | compareValue Type | Example |
|----------|-------------|-------------------|---------|
| `Equals` | Exact match | Single value | `"email"`, `42`, `true` |
| `NotEquals` | Not equal | Single value | `"active"` |
| `In` | Value in array | Array | `["US", "CA", "MX"]` |
| `NotIn` | Not in array | Array | `["inactive", "deleted"]` |
| `IsSet` | Has value | `null` | `null` |
| `IsNotSet` | No value | `null` | `null` |

### Logic Operators

| Operator | Behavior | Use When |
|----------|----------|----------|
| `And` | ALL conditions true | Need multiple criteria met |
| `Or` | ANY condition true | Any criterion sufficient |

### Field Group Types

| Type | Validation | Use Case |
|------|------------|----------|
| `AtLeastOne` | ≥1 field filled | Multiple options, need at least one |
| `ExactlyOne` | Exactly 1 filled | Mutually exclusive options |
| `All` | All filled | All required together |
| `None` | All optional | No requirement |

### API Endpoints Summary

```bash
# Dependency Rules
GET    /field-dependency-rules
POST   /field-dependency-rules
GET    /field-dependency-rules/:id
PATCH  /field-dependency-rules/:id
DELETE /field-dependency-rules/:id

# Field Groups
GET    /field-groups
POST   /field-groups
GET    /field-groups/:id
PATCH  /field-groups/:id
DELETE /field-groups/:id
```

### Validation Rules

✅ **Valid:**
- Source and target in same model
- At least one condition
- No circular dependencies
- Valid field group (same model)
- Priority ≥ 0

❌ **Invalid:**
- Cross-model dependencies
- Zero conditions
- Circular dependency chains
- Field group from different model
- Negative priority

### Performance Tips

- Use `useMemo` for rule evaluation (already implemented)
- Minimize number of rules per field
- Keep dependency chains shallow (≤3 levels)
- Use field groups for related fields
- Set appropriate priorities

---

## Related Code Files

### Target Front-End (`@ps-admin-microfe`)

**Core Implementation:**
- `packages/hooks-core/src/shared/useDependencyRules.ts` - Custom React hook with type definitions merged
- `packages/hooks-core/package.json` - Package configuration

### Admin Front-End (`@ps-admin-react-fe-v2`)

**Pages:**
- `src/pages/Compute/Model/detail.jsx` - Model detail page with dependency rule integration
- `src/pages/Compute/FieldDependencyRule/detail.jsx` - Dependency rule detail page
- `src/pages/Compute/routes.jsx` - Route configurations

**Configuration:**
- `src/config/forms/compute/index.jsx` - Form definitions including dependency rules
- `src/config/handleRows/compute/index.js` - Row handling logic
- `src/config/meta/compute/index.js` - Metadata definitions
- `src/config/routes/computeUrls.js` - URL routing configuration
- `src/config/metaMappings.js` - Meta mappings
- `src/config/constants.js` - Constants and enums

### API (`@compute-rapi`)

**Controllers:**
- `src/controllers/modelField.controller.js` - Model field CRUD operations
- `src/controllers/fieldDependencyRule.controller.js` - Dependency rule CRUD
- `src/controllers/fieldGroup.controller.js` - Field group CRUD

**Schemas:**
- `src/schemas/fieldDependencyRule.schemas.js` - Joi validation schemas for rules
- `src/schemas/fieldGroup.schemas.js` - Joi validation schemas for groups

**Routes:**
- `src/routes/v1/fieldDependencyRule.routes.js` - Dependency rule endpoints
- `src/routes/v1/fieldGroup.routes.js` - Field group endpoints

**Templates:**
- `src/computeConstructors/frontend/app/src/forms/CreateForm.template.tsx` - Create form template
- `src/computeConstructors/frontend/app/src/forms/DetailForm.template.tsx` - Detail form template

**Database:**
- `prisma/schema.prisma` - Prisma schema with FieldGroup, FieldDependencyRule, FieldDependencyCondition models

**Utilities:**
- `src/utils/shared/dependencyRulesUtils.js` - Core utility functions for rule evaluation and validation

---

## Source Attribution

This consolidated document combines information from the following source files:

### Source Documents

1. **DEPENDENCY_RULES_ARCHITECTURE.md** (`@compute-rapi`)
   - Complete architecture and implementation guide
   - Database schema design
   - Backend and frontend implementation details
   - Phase-by-phase implementation checklist

2. **DEPENDENCY_RULES_IMPLEMENTATION_STATUS.md** (`@compute-rapi`)
   - Current implementation progress
   - Completion status by phase
   - What's working and what's pending
   - Next steps and getting started guide

3. **API_DEPENDENCY_RULES.md** (`@compute-rapi/docs`)
   - Complete API endpoint documentation
   - Request/response examples
   - Query parameters and validation rules
   - Error response formats

4. **DEPENDENCY_RULES_QUICK_REFERENCE.md** (`@compute-rapi/docs`)
   - Quick reference tables for operators and actions
   - Common patterns and code snippets
   - API endpoint summary
   - Debugging tips and performance guidance

5. **DEPENDENCY_RULES_USAGE.md** (`@compute-rapi/docs`)
   - Detailed usage examples (basic to advanced)
   - Common patterns and best practices
   - Frontend integration guide
   - Troubleshooting section

6. **DEPENDENCY_RULES_FRONTEND_IMPLEMENTATION_PLAN.md** (`@ps-admin-react-fe-v2`)
   - Frontend implementation phases and tasks
   - UI component specifications
   - Detailed acceptance criteria
   - Timeline and task breakdown

### Consolidation Notes

- **Architecture section** primarily from DEPENDENCY_RULES_ARCHITECTURE.md
- **API Endpoints section** from API_DEPENDENCY_RULES.md
- **Implementation Status** from DEPENDENCY_RULES_IMPLEMENTATION_STATUS.md
- **Usage Guide** combines examples from DEPENDENCY_RULES_USAGE.md with frontend details from FRONTEND_IMPLEMENTATION_PLAN.md
- **Quick Reference** from DEPENDENCY_RULES_QUICK_REFERENCE.md
- **Related Code Files** compiled from all sources

### Additional Information

**useDependencyRules Hook:**
- Implemented in: `@ps-admin-microfe/packages/hooks-core/src/shared/useDependencyRules.ts`
- Type definitions merged directly into the hook file
- Returns `{visible, required, enabled}` state for each field
- Uses `useMemo` for performance optimization

**Generated:** January 11, 2025
**Consolidation Source Count:** 6 documentation files

---

**For questions or issues:**
- Review this documentation first
- Check troubleshooting section
- Review source attribution for detailed information
- Contact development team for assistance
