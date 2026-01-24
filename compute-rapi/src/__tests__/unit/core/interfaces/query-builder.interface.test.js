/**
 * Tests for QueryBuilder Interface
 *
 * Fluent interface for building Prisma queries.
 * Used by interceptors to modify queries in beforeList/beforeRead hooks.
 */

const {
  QueryBuilder,
  createQueryBuilder,
} = require('../../../../computeConstructors/api/core/interfaces/query-builder.interface.template.js');

describe('QueryBuilder Interface', () => {
  describe('createQueryBuilder', () => {
    it('should create builder with default options', () => {
      const builder = createQueryBuilder('Employee');
      expect(builder.modelName).toBe('Employee');
      expect(builder.build()).toEqual({
        where: {},
        include: undefined,
        orderBy: undefined,
        skip: undefined,
        take: undefined,
        select: undefined,
      });
    });
  });

  describe('QueryBuilder', () => {
    let builder;

    beforeEach(() => {
      builder = createQueryBuilder('Employee');
    });

    it('should add where clauses', () => {
      builder = builder.where({ status: 'active' });
      builder = builder.where({ departmentId: 'dept-123' });

      const query = builder.build();
      expect(query.where.status).toBe('active');
      expect(query.where.departmentId).toBe('dept-123');
    });

    it('should add AND conditions', () => {
      builder = builder.andWhere({ status: 'active' }, { role: 'admin' });

      const query = builder.build();
      expect(query.where.AND).toHaveLength(2);
    });

    it('should add OR conditions', () => {
      builder = builder.orWhere({ email: { contains: 'admin' } }, { role: 'admin' });

      const query = builder.build();
      expect(query.where.OR).toHaveLength(2);
    });

    it('should configure includes/relations', () => {
      builder = builder.include('department', { select: { name: true } });
      builder = builder.include('manager');

      const query = builder.build();
      expect(query.include.department).toEqual({ select: { name: true } });
      expect(query.include.manager).toBe(true);
    });

    it('should configure ordering', () => {
      builder = builder.orderBy('createdAt', 'desc');
      builder = builder.orderBy('name', 'asc');

      const query = builder.build();
      expect(query.orderBy).toEqual([
        { createdAt: 'desc' },
        { name: 'asc' },
      ]);
    });

    it('should configure pagination', () => {
      builder = builder.paginate({ page: 2, pageSize: 25 });

      const query = builder.build();
      expect(query.skip).toBe(25);
      expect(query.take).toBe(25);
    });

    it('should be immutable (return new instance)', () => {
      const builder2 = builder.where({ status: 'active' });
      expect(builder2).not.toBe(builder);
      expect(builder.build().where).toEqual({});
    });

    it('should merge with existing query', () => {
      const existing = { where: { clientId: 'client-1' } };
      builder = builder.mergeWith(existing);
      builder = builder.where({ status: 'active' });

      const query = builder.build();
      expect(query.where.clientId).toBe('client-1');
      expect(query.where.status).toBe('active');
    });

    it('should support NOT conditions', () => {
      builder = builder.notWhere({ status: 'deleted' });

      const query = builder.build();
      expect(query.where.NOT).toEqual({ status: 'deleted' });
    });

    it('should support skip and take directly', () => {
      builder = builder.skip(10).take(5);

      const query = builder.build();
      expect(query.skip).toBe(10);
      expect(query.take).toBe(5);
    });

    it('should support field selection', () => {
      builder = builder.select({ id: true, name: true });

      const query = builder.build();
      expect(query.select).toEqual({ id: true, name: true });
    });

    it('should build findOne query without pagination', () => {
      builder = builder.where({ id: '123' }).skip(10).take(5);

      const query = builder.buildFindOne();
      expect(query.where).toEqual({ id: '123' });
      expect(query.skip).toBeUndefined();
      expect(query.take).toBeUndefined();
    });

    it('should build count query with only where', () => {
      builder = builder.where({ status: 'active' }).skip(10).take(5);

      const query = builder.buildCount();
      expect(query.where).toEqual({ status: 'active' });
      expect(query.skip).toBeUndefined();
    });
  });
});
