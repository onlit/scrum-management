/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Unit tests for schemaOptionsHandler middleware.
 */

const { createSchemaOptionsHandler } = require('#core/middlewares/schemaOptionsHandler.js');
const { register, clear } = require('#core/utils/schemaRegistry.js');

describe('schemaOptionsHandler', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let schemaOptionsHandler;

  beforeEach(() => {
    clear();
    // Create handler without auth by default
    schemaOptionsHandler = createSchemaOptionsHandler();
    mockReq = {
      method: 'OPTIONS',
      path: '/api/v1/events',
      get: jest.fn(),
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should call next() for non-OPTIONS requests', () => {
    mockReq.method = 'GET';

    schemaOptionsHandler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  it('should call next() when Accept header does not contain application/schema+json', () => {
    mockReq.get.mockReturnValue('application/json');

    schemaOptionsHandler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  it('should return schema when Accept header contains application/schema+json', () => {
    const schemaConfig = { query_params: [], methods: { GET: {} } };
    register('/api/v1/events', schemaConfig);
    mockReq.get.mockReturnValue('application/schema+json');

    schemaOptionsHandler(mockReq, mockRes, mockNext);

    expect(mockRes.set).toHaveBeenCalledWith('Content-Type', 'application/schema+json');
    expect(mockRes.json).toHaveBeenCalledWith(schemaConfig);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 404 when schema not found', () => {
    mockReq.get.mockReturnValue('application/schema+json');
    mockReq.path = '/api/v1/unknown';

    schemaOptionsHandler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    );
  });

  it('should set CORS headers on schema response', () => {
    const schemaConfig = { query_params: [], methods: {} };
    register('/api/v1/events', schemaConfig);
    mockReq.get.mockImplementation((header) => {
      if (header === 'Accept') return 'application/schema+json';
      if (header === 'Origin') return 'https://example.com';
      return null;
    });

    schemaOptionsHandler(mockReq, mockRes, mockNext);

    expect(mockRes.set).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      expect.any(String)
    );
  });

  describe('with authentication', () => {
    it('should call authMiddleware before returning schema', () => {
      // Mock auth middleware that sets isAuthenticated: true (simulating valid token)
      const mockAuthMiddleware = jest.fn((req, res, next) => {
        req.user = { isAuthenticated: true, id: 'test-user-id' };
        next();
      });
      const protectedHandler = createSchemaOptionsHandler({ authMiddleware: mockAuthMiddleware });

      const schemaConfig = { query_params: [], methods: { GET: {} } };
      register('/api/v1/events', schemaConfig);
      mockReq.get.mockReturnValue('application/schema+json');

      protectedHandler(mockReq, mockRes, mockNext);

      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(schemaConfig);
    });

    it('should return 401 when user is not authenticated', () => {
      // Mock auth middleware that sets isAuthenticated: false (no token)
      const mockAuthMiddleware = jest.fn((req, res, next) => {
        req.user = { isAuthenticated: false };
        next();
      });
      const protectedHandler = createSchemaOptionsHandler({ authMiddleware: mockAuthMiddleware });

      const schemaConfig = { query_params: [], methods: { GET: {} } };
      register('/api/v1/events', schemaConfig);
      mockReq.get.mockReturnValue('application/schema+json');

      protectedHandler(mockReq, mockRes, mockNext);

      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Authentication required' })
      );
    });

    it('should pass auth errors to next()', () => {
      const authError = new Error('Unauthorized');
      const mockAuthMiddleware = jest.fn((req, res, next) => next(authError));
      const protectedHandler = createSchemaOptionsHandler({ authMiddleware: mockAuthMiddleware });

      const schemaConfig = { query_params: [], methods: { GET: {} } };
      register('/api/v1/events', schemaConfig);
      mockReq.get.mockReturnValue('application/schema+json');

      protectedHandler(mockReq, mockRes, mockNext);

      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(authError);
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should not call authMiddleware for non-schema OPTIONS requests', () => {
      const mockAuthMiddleware = jest.fn();
      const protectedHandler = createSchemaOptionsHandler({ authMiddleware: mockAuthMiddleware });

      mockReq.get.mockReturnValue('application/json'); // Not schema request

      protectedHandler(mockReq, mockRes, mockNext);

      expect(mockAuthMiddleware).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
