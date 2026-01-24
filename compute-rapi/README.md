## ENV Variables

```
NODE_ENV="development" # sandbox, staging, or production
DATABASE_URL="postgresql://postgres:password@localhost:5432/ms-rapi?schema=public"
ACCOUNTS_HOST="https://sandbox.accounts.pullstream.com"
HR_HOST="https://sandbox.hr.pullstream.com"
CRM_HOST="https://sandbox.crm.pullstream.com"
LOGS_HOST="https://sandbox.logs.pullstream.com"
SYSTEM_HOST="https://sandbox.system.pullstream.com"
GIT_HOST="https://git.pullstream.com"
GIT_USERNAME=""
GIT_ACCESS_TOKEN=""
GIT_ENV_DOCKER_TOKEN=""
GIT_ENV_PRIVATE_KEY=""
GIT_ENV_SERVER_IP=""
GIT_ENV_SERVER_PORT=""
GIT_ENV_SERVER_USER=""
APP_HOST
PORT
```

## API Docs

- See `docs/API_MODELS_AND_FIELDS.md` for `/api/v1/models` and `/api/v1/model-fields` endpoints.
- See `docs/API_DEPENDENCY_RULES.md` for `/api/v1/field-dependency-rules` and `/api/v1/field-groups` endpoints.

## Field Dependency Rules System

The Field Dependency Rules system provides powerful dynamic field management capabilities for generated forms and APIs. It allows you to:

- **Conditional Visibility**: Show/hide fields based on other field values
- **Dynamic Validation**: Make fields required/optional conditionally
- **Chained Dependencies**: Enable/disable fields in cascading relationships (e.g., Country → State → City)
- **Field Groups**: Validate groups of fields collectively (e.g., "at least one contact method required")

### Quick Start

#### 1. Create a Field Group (optional)
```bash
POST /api/v1/field-groups
{
  "modelId": "uuid",
  "name": "contactInformation",
  "label": "Contact Information",
  "requirementType": "AtLeastOne"
}
```

#### 2. Create Dependency Rules
```bash
POST /api/v1/field-dependency-rules
{
  "targetFieldId": "uuid",
  "action": "Show",
  "conditions": [
    {
      "sourceFieldId": "uuid",
      "operator": "Equals",
      "compareValue": "email"
    }
  ]
}
```

### Documentation

- **[Architecture Guide](DEPENDENCY_RULES_ARCHITECTURE.md)** - Complete technical architecture and implementation details
- **[API Reference](docs/API_DEPENDENCY_RULES.md)** - Full API endpoint documentation
- **[Usage Examples](docs/DEPENDENCY_RULES_USAGE.md)** - Common patterns and real-world examples

### Migration from Legacy System

If you have existing fields using `dependsOnFieldId`, migrate them to the new system:

```bash
node src/scripts/migrateDependenciesToRules.js
```

The legacy `dependsOnFieldId` field remains functional but is deprecated. New implementations should use the Field Dependency Rules system.
