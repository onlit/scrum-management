/**
 * Domain Constants
 *
 * Application-wide constants for domain logic.
 * This file is PROTECTED - never overwritten by the generator.
 *
 * @module shared/constants/domain.constants
 */

/**
 * Standard entity statuses.
 */
const EntityStatus = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  ARCHIVED: 'archived',
  DELETED: 'deleted',
});

/**
 * Operation types for audit logging and events.
 */
const OperationType = Object.freeze({
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  BULK_UPDATE: 'bulk_update',
  BULK_DELETE: 'bulk_delete',
  IMPORT: 'import',
  EXPORT: 'export',
});

/**
 * Visibility scopes for multi-tenant data.
 */
const VisibilityScope = Object.freeze({
  /** Visible only to creator */
  PRIVATE: 'private',
  /** Visible to same client/tenant */
  CLIENT: 'client',
  /** Visible to specific users */
  SHARED: 'shared',
  /** Visible to everyone */
  PUBLIC: 'public',
});

/**
 * Standard pagination defaults.
 */
const PaginationDefaults = Object.freeze({
  PAGE: 1,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
});

/**
 * Date format patterns.
 */
const DateFormats = Object.freeze({
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  DATE_ONLY: 'YYYY-MM-DD',
  TIME_ONLY: 'HH:mm:ss',
  DISPLAY: 'MMM D, YYYY',
  DISPLAY_WITH_TIME: 'MMM D, YYYY h:mm A',
});

/**
 * Cache TTL values in seconds.
 */
const CacheTTL = Object.freeze({
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
});

/**
 * Event priorities for ordered processing.
 */
const EventPriority = Object.freeze({
  CRITICAL: 0,
  HIGH: 10,
  NORMAL: 50,
  LOW: 90,
});

module.exports = {
  EntityStatus,
  OperationType,
  VisibilityScope,
  PaginationDefaults,
  DateFormats,
  CacheTTL,
  EventPriority,
};
