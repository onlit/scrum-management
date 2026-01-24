## Prisma Enum Design Standards

These standards ensure your schema is clear, maintainable, and scalable.

### 1. Naming Conventions

Consistency is paramount. All enums must follow these naming rules.

* **Enum Type:** Use `PascalCase` and a **singular noun**. Add a descriptive suffix like `Status`, `Type`, `Level`, or `Category` if it adds clarity.
  * **Good:** `UserStatus`, `PaymentType`, `CompanySize`
  * **Bad:** `user_statuses`, `Types`, `CompanySizes`

* **Enum Value:** Use `SCREAMING_SNAKE_CASE`. Values should be concise and avoid repeating the context of the enum's name.
  * **Good:**

        ```prisma
        enum DocumentStatus {
          DRAFT
          PUBLISHED
          ARCHIVED
        }
        ```

  * **Bad:**

        ```prisma
        enum DocumentStatus {
          DOCUMENT_STATUS_DRAFT // Redundant
          Published             // Wrong case
        }
        ```

### 2. Logical Ordering

The order of values within an enum definition matters for readability and predictability.

* **Order by Progression:** If the values represent a sequence, order them logically (e.g., from lowest to highest, start to finish).
* **Order Alphabetically:** If no logical sequence exists, order them alphabetically.

  * **Good:**

        ```prisma
        enum TargetFrequency {
          DAILY
          WEEKLY
          MONTHLY
          QUARTERLY
        }
        ```

  * **Bad:** (Unordered)

        ```prisma
        enum TargetFrequency {
          WEEKLY
          DAILY
          MONTHLY
        }
        ```

### 3. Handling Ranges and Complex Values

Prisma enum values must be valid identifiers. To represent ranges like "11-50", use a standardized, machine-readable format.

* **Pattern:** `PREFIX_MIN_TO_MAX`
* **Prefix:** Use a short, descriptive prefix (e.g., `SIZE_`, `LEVEL_`).
* **Ranges:** Use `_TO_` to separate min and max values.
* **Open-Ended Ranges:** Use `_PLUS` for values like "10,001+".

  * **Standard Example:**

        ```prisma
        enum CompanySize {
          SIZE_1
          SIZE_2_TO_10
          SIZE_11_TO_50
          SIZE_51_TO_100
          SIZE_10001_PLUS
        }
        ```

### 4. Separate Identifiers from Display Labels

**This is the most critical rule.** The database enum is a programmatic identifier, not a display string for the UI. Human-friendly labels belong in the application code.

* **Do:** Store a clean, programmatic value like `SIZE_11_TO_50` in the database.
* **Don't:** Attempt to store `11-50` or `11 to 50` as an enum value.
* **How:** Create a utility mapping function in your frontend or backend code to translate the enum identifier into a human-readable label. This allows for flexibility and internationalization (i18n).

  * **Example (TypeScript):**

        ```typescript
        // /utils/labels.ts
        import { CompanySize } from '@prisma/client';

        export const companySizeLabels: Record<CompanySize, string> = {
          [CompanySize.SIZE_1]: '1',
          [CompanySize.SIZE_2_TO_10]: '2 - 10',
          [CompanySize.SIZE_11_TO_50]: '11 - 50',
          [CompanySize.SIZE_10001_PLUS]: '10,001+',
        };
        ```

### 5. Define Default and Unknown States

For robustness, always include a default or "unknown" state, especially for optional fields or when dealing with data from external sources.

* **Names:** Use `UNKNOWN`, `UNSPECIFIED`, or `NONE`.
* **Placement:** List this value first in the enum definition.

  * **Example:**

        ```prisma
        enum CompanySize {
          UNKNOWN
          SIZE_1
          // ...
        }
        ```

### 6. Know When to Use a Relational Table Instead

An enum is not always the right tool. Use a separate model with a relation when:

1. **You need more metadata:** Each option requires associated data (e.g., a price, description, color hex code, `minValue`, `maxValue`).
2. **The options are dynamic:** You want non-developers (e.g., an admin) to add, edit, or remove options through a UI without a new code deployment.
3. **You need to query by the metadata:** You need to find all companies where `size.minValue > 100`.
