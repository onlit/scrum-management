/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Unit tests for schemaRegistry utility.
 */

const {
  register,
  get,
  normalizePath,
  clear,
} = require('#core/utils/schemaRegistry.js');

describe('schemaRegistry', () => {
  beforeEach(() => {
    clear();
  });

  describe('normalizePath', () => {
    it('should replace UUID path segments with :id', () => {
      const path = '/api/v1/events/550e8400-e29b-41d4-a716-446655440000';
      expect(normalizePath(path)).toBe('/api/v1/events/:id');
    });

    it('should handle multiple UUIDs in path', () => {
      const path = '/api/v1/events/550e8400-e29b-41d4-a716-446655440000/tickets/660e8400-e29b-41d4-a716-446655440001';
      expect(normalizePath(path)).toBe('/api/v1/events/:id/tickets/:id');
    });

    it('should leave non-UUID paths unchanged', () => {
      const path = '/api/v1/events';
      expect(normalizePath(path)).toBe('/api/v1/events');
    });

    it('should handle trailing slashes', () => {
      const path = '/api/v1/events/';
      expect(normalizePath(path)).toBe('/api/v1/events');
    });
  });

  describe('register and get', () => {
    it('should register and retrieve schema config', () => {
      const config = { methods: ['GET', 'POST'] };
      register('/api/v1/events', config);
      expect(get('/api/v1/events')).toEqual(config);
    });

    it('should normalize path on registration', () => {
      const config = { methods: ['GET'] };
      register('/api/v1/events/', config);
      expect(get('/api/v1/events')).toEqual(config);
    });

    it('should normalize UUID paths on lookup', () => {
      const config = { methods: ['GET', 'PUT', 'DELETE'] };
      register('/api/v1/events/:id', config);
      expect(get('/api/v1/events/550e8400-e29b-41d4-a716-446655440000')).toEqual(config);
    });

    it('should return undefined for unregistered paths', () => {
      expect(get('/api/v1/unknown')).toBeUndefined();
    });
  });
});
