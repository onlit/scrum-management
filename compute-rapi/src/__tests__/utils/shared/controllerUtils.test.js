jest.mock('#utils/shared/basicLoggingUtils.js', () => ({
  logEvent: jest.fn(),
}));

const Joi = require('joi');
const {
  validateWithSchema,
  checkInterceptorHalt,
  handleControllerError,
  createOperationContext,
} = require('#utils/shared/controllerUtils.js');
const { ERROR_TYPES } = require('#configs/constants.js');

describe('controllerUtils', () => {
  describe('validateWithSchema', () => {
    const testSchema = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
    });

    const mockReq = { traceId: 'test-trace-123' };

    it('should return validated values on success', async () => {
      const data = { name: 'Test', email: 'test@example.com' };
      const result = await validateWithSchema(testSchema, data, mockReq, 'test_operation');
      expect(result).toEqual(data);
    });

    it('should throw standardized validation error on failure', async () => {
      const data = { name: '', email: 'invalid-email' };

      await expect(validateWithSchema(testSchema, data, mockReq, 'test_operation'))
        .rejects
        .toMatchObject({
          type: expect.stringMatching(/VALIDATION|BAD_REQUEST/),
          validationErrors: expect.arrayContaining([
            expect.objectContaining({ field: expect.any(String) }),
          ]),
        });
    });

    it('should strip unknown fields', async () => {
      const data = { name: 'Test', email: 'test@example.com', unknown: 'field' };
      const result = await validateWithSchema(testSchema, data, mockReq, 'test_operation');
      expect(result).not.toHaveProperty('unknown');
    });

    it('should collect all validation errors (abortEarly: false)', async () => {
      const data = { name: '', email: 'bad' };

      try {
        await validateWithSchema(testSchema, data, mockReq, 'test_operation');
        fail('Should have thrown');
      } catch (error) {
        expect(error.validationErrors.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('checkInterceptorHalt', () => {
    let mockRes;

    beforeEach(() => {
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    it('should return false when result has no halt flag', () => {
      const result = { data: { foo: 'bar' } };
      const halted = checkInterceptorHalt(result, mockRes);
      expect(halted).toBe(false);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return true and send response when halt is true', () => {
      const result = {
        halt: true,
        response: { status: 201, body: { success: true } },
      };
      const halted = checkInterceptorHalt(result, mockRes);
      expect(halted).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    it('should use status 200 as default when not specified', () => {
      const result = {
        halt: true,
        response: { body: { message: 'ok' } },
      };
      checkInterceptorHalt(result, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle missing response gracefully', () => {
      const result = { halt: true };
      const halted = checkInterceptorHalt(result, mockRes);
      expect(halted).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(undefined);
    });
  });

  describe('handleControllerError', () => {
    let mockReq;
    let mockRes;
    let mockInterceptor;

    beforeEach(() => {
      mockReq = { traceId: 'test-trace-456' };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockInterceptor = {
        onError: jest.fn().mockResolvedValue({ data: { handled: false } }),
      };
    });

    it('should re-throw standardized errors unchanged', async () => {
      const standardError = new Error('Not found');
      standardError.type = 'NOT_FOUND';

      await expect(
        handleControllerError(standardError, {
          req: mockReq,
          res: mockRes,
          interceptor: mockInterceptor,
          operationName: 'test_op',
        })
      ).rejects.toMatchObject({ type: 'NOT_FOUND' });
    });

    it('should convert non-standard errors to database errors', async () => {
      const dbError = new Error('Connection refused');

      await expect(
        handleControllerError(dbError, {
          req: mockReq,
          res: mockRes,
          interceptor: mockInterceptor,
          operationName: 'test_op',
        })
      ).rejects.toMatchObject({ type: 'INTERNAL' });
    });

    it('should let interceptor handle error if it returns handled: true', async () => {
      mockInterceptor.onError.mockResolvedValue({
        data: {
          handled: true,
          response: { status: 400, body: { error: 'custom' } },
        },
      });

      const error = new Error('test');
      const result = await handleControllerError(error, {
        req: mockReq,
        res: mockRes,
        interceptor: mockInterceptor,
        operationName: 'test_op',
      });

      expect(result).toBe(true); // Indicates response was sent
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'custom' });
    });

    it('should work without interceptor', async () => {
      const error = new Error('test');

      await expect(
        handleControllerError(error, {
          req: mockReq,
          res: mockRes,
          operationName: 'test_op',
        })
      ).rejects.toMatchObject({ type: 'INTERNAL' });
    });
  });

  describe('createOperationContext', () => {
    const mockReq = {
      user: { id: 'user-123', client: { id: 'client-456' } },
      params: { id: 'record-789' },
    };

    it('should create context with required fields', () => {
      const context = createOperationContext(mockReq, 'TestModel', 'create');

      expect(context).toMatchObject({
        req: mockReq,
        user: mockReq.user,
        model: 'TestModel',
        operation: 'create',
      });
    });

    it('should include recordId for update/delete/read operations', () => {
      const context = createOperationContext(mockReq, 'TestModel', 'update');
      expect(context.recordId).toBe('record-789');
    });

    it('should include queryBuilder when provided', () => {
      const mockQueryBuilder = { build: jest.fn() };
      const context = createOperationContext(mockReq, 'TestModel', 'list', {
        queryBuilder: mockQueryBuilder,
      });
      expect(context.queryBuilder).toBe(mockQueryBuilder);
    });

    it('should include custom extras', () => {
      const context = createOperationContext(mockReq, 'TestModel', 'create', {
        customField: 'customValue',
      });
      expect(context.customField).toBe('customValue');
    });
  });
});
