/**
 * QueryBuilder Interface
 *
 * Fluent interface for building Prisma queries.
 * Used by interceptors to modify queries in beforeList/beforeRead hooks.
 *
 * @module shared/interfaces/query-builder.interface
 */

/**
 * @typedef {Object} PrismaQuery
 * @property {Object} where - Where conditions
 * @property {Object} [include] - Relations to include
 * @property {Array|Object} [orderBy] - Sort order
 * @property {number} [skip] - Pagination offset
 * @property {number} [take] - Pagination limit
 * @property {Object} [select] - Field selection
 */

/**
 * Immutable query builder for Prisma queries.
 */
class QueryBuilder {
  /**
   * @param {string} modelName - Target Prisma model
   * @param {PrismaQuery} [initial] - Initial query state
   */
  constructor(modelName, initial = {}) {
    this.modelName = modelName;
    this._where = { ...initial.where };
    this._include = initial.include ? { ...initial.include } : undefined;
    this._orderBy = initial.orderBy
      ? [...(Array.isArray(initial.orderBy) ? initial.orderBy : [initial.orderBy])]
      : [];
    this._skip = initial.skip;
    this._take = initial.take;
    this._select = initial.select ? { ...initial.select } : undefined;
  }

  /**
   * Create a clone with modifications.
   * @private
   */
  _clone() {
    const clone = new QueryBuilder(this.modelName);
    clone._where = { ...this._where };
    clone._include = this._include ? { ...this._include } : undefined;
    clone._orderBy = [...this._orderBy];
    clone._skip = this._skip;
    clone._take = this._take;
    clone._select = this._select ? { ...this._select } : undefined;
    return clone;
  }

  /**
   * Add where conditions (merged with existing).
   * @param {Object} conditions - Prisma where conditions
   * @returns {QueryBuilder} New builder instance
   */
  where(conditions) {
    const clone = this._clone();
    clone._where = { ...clone._where, ...conditions };
    return clone;
  }

  /**
   * Add AND conditions.
   * @param {...Object} conditions - Conditions to AND together
   * @returns {QueryBuilder} New builder instance
   */
  andWhere(...conditions) {
    const clone = this._clone();
    clone._where.AND = [...(clone._where.AND || []), ...conditions];
    return clone;
  }

  /**
   * Add OR conditions.
   * @param {...Object} conditions - Conditions to OR together
   * @returns {QueryBuilder} New builder instance
   */
  orWhere(...conditions) {
    const clone = this._clone();
    clone._where.OR = [...(clone._where.OR || []), ...conditions];
    return clone;
  }

  /**
   * Add NOT conditions.
   * @param {Object} conditions - Conditions to negate
   * @returns {QueryBuilder} New builder instance
   */
  notWhere(conditions) {
    const clone = this._clone();
    clone._where.NOT = { ...(clone._where.NOT || {}), ...conditions };
    return clone;
  }

  /**
   * Include a relation.
   * @param {string} relation - Relation name
   * @param {Object|boolean} [options] - Include options or true for simple include
   * @returns {QueryBuilder} New builder instance
   */
  include(relation, options = true) {
    const clone = this._clone();
    if (!clone._include) clone._include = {};
    clone._include[relation] = options;
    return clone;
  }

  /**
   * Add ordering.
   * @param {string} field - Field to order by
   * @param {'asc'|'desc'} [direction='asc'] - Sort direction
   * @returns {QueryBuilder} New builder instance
   */
  orderBy(field, direction = 'asc') {
    const clone = this._clone();
    clone._orderBy.push({ [field]: direction });
    return clone;
  }

  /**
   * Set pagination.
   * @param {Object} params
   * @param {number} params.page - Page number (1-indexed)
   * @param {number} params.pageSize - Items per page
   * @returns {QueryBuilder} New builder instance
   */
  paginate({ page, pageSize }) {
    const clone = this._clone();
    clone._skip = (page - 1) * pageSize;
    clone._take = pageSize;
    return clone;
  }

  /**
   * Set skip directly.
   * @param {number} skip
   * @returns {QueryBuilder} New builder instance
   */
  skip(skip) {
    const clone = this._clone();
    clone._skip = skip;
    return clone;
  }

  /**
   * Set take/limit directly.
   * @param {number} take
   * @returns {QueryBuilder} New builder instance
   */
  take(take) {
    const clone = this._clone();
    clone._take = take;
    return clone;
  }

  /**
   * Select specific fields.
   * @param {Object} fields - Fields to select
   * @returns {QueryBuilder} New builder instance
   */
  select(fields) {
    const clone = this._clone();
    clone._select = { ...clone._select, ...fields };
    return clone;
  }

  /**
   * Merge with an existing query object.
   * @param {PrismaQuery} query - Existing query to merge with
   * @returns {QueryBuilder} New builder instance
   */
  mergeWith(query) {
    const clone = this._clone();
    if (query.where) clone._where = { ...query.where, ...clone._where };
    if (query.include) clone._include = { ...query.include, ...clone._include };
    if (query.orderBy) {
      const existing = Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy];
      clone._orderBy = [...existing, ...clone._orderBy];
    }
    if (query.skip !== undefined && clone._skip === undefined) clone._skip = query.skip;
    if (query.take !== undefined && clone._take === undefined) clone._take = query.take;
    if (query.select) clone._select = { ...query.select, ...clone._select };
    return clone;
  }

  /**
   * Build the final Prisma query object.
   * @returns {PrismaQuery}
   */
  build() {
    return {
      where: this._where,
      include: this._include,
      orderBy: this._orderBy.length > 0 ? this._orderBy : undefined,
      skip: this._skip,
      take: this._take,
      select: this._select,
    };
  }

  /**
   * Build query for findMany.
   * @returns {PrismaQuery}
   */
  buildFindMany() {
    return this.build();
  }

  /**
   * Build query for findFirst/findUnique.
   * @returns {PrismaQuery}
   */
  buildFindOne() {
    const query = this.build();
    delete query.skip;
    delete query.take;
    delete query.orderBy;
    return query;
  }

  /**
   * Build query for count.
   * @returns {{ where: Object }}
   */
  buildCount() {
    return { where: this._where };
  }
}

/**
 * Create a new QueryBuilder instance.
 * @param {string} modelName - Target model name
 * @param {PrismaQuery} [initial] - Initial query state
 * @returns {QueryBuilder}
 */
function createQueryBuilder(modelName, initial) {
  return new QueryBuilder(modelName, initial);
}

module.exports = {
  QueryBuilder,
  createQueryBuilder,
};
