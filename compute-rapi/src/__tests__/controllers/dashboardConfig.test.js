const prisma = require('#configs/prisma.js');
const { createDashboardBatch } = require('#controllers/dashboardConfig.controller.js');

// Mock Prisma client with all dashboard-related models
jest.mock('#configs/prisma.js', () => ({
  microservice: {
    findUnique: jest.fn(),
  },
  dashboardConfig: {
    findUnique: jest.fn(),
  },
  dashboardMetric: {
    findMany: jest.fn(),
  },
  modelDefn: {
    findMany: jest.fn(),
  },
  fieldDefn: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
}));

// Mock visibility utilities
jest.mock('#utils/shared/visibilityUtils.js', () => ({
  getVisibilityFilters: jest.fn(),
  buildCreateRecordPayload: jest.fn().mockImplementation(({ validatedValues }) => validatedValues),
}));

// Mock trace utilities
jest.mock('#utils/shared/traceUtils.js', () => ({
  logOperationStart: jest.fn(),
  logOperationSuccess: jest.fn(),
  logOperationError: jest.fn(),
  logDatabaseStart: jest.fn(),
  logDatabaseSuccess: jest.fn(),
  createErrorWithTrace: jest.fn((type, message) => {
    const error = new Error(message);
    error.type = type;
    return error;
  }),
}));

// Mock name resolver utilities
jest.mock('#utils/shared/nameResolver.js', () => ({
  resolveModelNamesToIds: jest.fn().mockResolvedValue(new Map()),
  resolveFieldNamesToIds: jest.fn().mockResolvedValue(new Map()),
}));

describe('createDashboardBatch', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.resetAllMocks();
    // Set default mock values that can be overridden in specific tests
    prisma.microservice.findUnique.mockResolvedValue({ id: 'microservice-uuid', name: 'Test MS' });
    prisma.dashboardConfig.findUnique.mockResolvedValue(null);
    prisma.modelDefn.findMany.mockResolvedValue([]);
    prisma.fieldDefn.findMany.mockResolvedValue([]);
    prisma.dashboardMetric.findMany.mockResolvedValue([]);
    // Reset nameResolver defaults (cleared by resetAllMocks)
    const { resolveModelNamesToIds, resolveFieldNamesToIds } = require('#utils/shared/nameResolver.js');
    resolveModelNamesToIds.mockResolvedValue(new Map());
    resolveFieldNamesToIds.mockResolvedValue(new Map());
    // Reset createErrorWithTrace implementation (cleared by resetAllMocks)
    const { createErrorWithTrace } = require('#utils/shared/traceUtils.js');
    createErrorWithTrace.mockImplementation((type, message) => {
      const error = new Error(message);
      error.type = type;
      return error;
    });
    // Reset buildCreateRecordPayload implementation (cleared by resetAllMocks)
    const { buildCreateRecordPayload } = require('#utils/shared/visibilityUtils.js');
    buildCreateRecordPayload.mockImplementation(({ validatedValues }) => validatedValues);
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        dashboardConfig: { create: jest.fn().mockResolvedValue({ id: 'config-uuid' }) },
        dashboardMetric: { create: jest.fn().mockResolvedValue({ id: 'metric-uuid' }) },
        dashboardWidget: { create: jest.fn().mockResolvedValue({ id: 'widget-uuid' }) },
        dashboardFilter: { create: jest.fn().mockResolvedValue({ id: 'filter-uuid' }) },
        widgetDateConfig: { create: jest.fn().mockResolvedValue({ id: 'date-config-uuid' }) },
      };
      return callback(tx);
    });
  });

  // Helper to create mock request/response
  const createMockReqRes = (body) => ({
    req: {
      user: { isAuthenticated: true, id: 'user-uuid', client: { id: 'client-uuid' } },
      body,
    },
    res: {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    },
    next: jest.fn(),
  });

  describe('successful batch creation', () => {
    it('should successfully create dashboard config with metrics and widgets', async () => {
      const modelUuid = '660e8400-e29b-41d4-a716-446655440001';
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Dashboard', enableDateFilter: true, defaultDateRange: 'Last30Days',
        metrics: [{ reference: 'metric-1', name: 'totalOrders', modelName: 'Order', aggregationType: 'Count' }],
        widgets: [{ title: 'Orders KPI', widgetType: 'KpiCard', metricReference: 'metric-1' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      // Mock name resolution for the 'Order' model name
      const { resolveModelNamesToIds } = require('#utils/shared/nameResolver.js');
      resolveModelNamesToIds.mockResolvedValue(new Map([['Order', modelUuid]]));

      // Override findUnique to return null first (check existing), then return result (fetch after create)
      prisma.dashboardConfig.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'config-uuid', widgets: [], filters: [] });
      prisma.modelDefn.findMany.mockResolvedValue([{ id: modelUuid }]);

      await createDashboardBatch(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should create dashboard with empty metrics and filters arrays', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Minimal Dashboard',
        metrics: [],
        widgets: [{ title: 'Simple Widget', widgetType: 'KpiCard', modelId: '660e8400-e29b-41d4-a716-446655440001' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      prisma.dashboardConfig.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'config-uuid', widgets: [], filters: [] });
      prisma.modelDefn.findMany.mockResolvedValue([{ id: '660e8400-e29b-41d4-a716-446655440001' }]);
      prisma.fieldDefn.findMany.mockResolvedValue([]);

      await createDashboardBatch(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('validation errors', () => {
    it('should throw validation error when microserviceId is missing', async () => {
      const body = {
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', modelId: 'model-uuid' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Input validation failed');
    });

    it('should throw validation error when widgets array is empty', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Input validation failed');
    });

    it('should throw validation error for invalid widgetType', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'InvalidType' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Input validation failed');
    });

    it('should throw validation error for invalid defaultDateRange', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test', defaultDateRange: 'InvalidRange',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', modelId: 'model-uuid' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Input validation failed');
    });

    it('should throw validation error when widget references non-existent metricReference', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', metricReference: 'non-existent' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Input validation failed');
    });

    it('should throw validation error when widget has both metricReference and modelId', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [{ reference: 'metric-1', name: 'test' }],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', metricReference: 'metric-1', modelId: 'model-uuid' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Input validation failed');
    });

    it('should throw validation error when widget has neither metricReference nor modelId/modelName', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Orphan Widget', widgetType: 'KpiCard' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Input validation failed');
    });

    it('should throw validation error when metric is missing reference', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [{ name: 'test' }],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', modelId: 'model-uuid' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Input validation failed');
    });

  });

  describe('not found errors', () => {
    it('should throw error when microservice does not exist', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', modelId: '660e8400-e29b-41d4-a716-446655440001' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      prisma.dashboardConfig.findUnique.mockResolvedValue(null);
      prisma.modelDefn.findMany.mockResolvedValue([{ id: '660e8400-e29b-41d4-a716-446655440001' }]);
      prisma.fieldDefn.findMany.mockResolvedValue([]);
      prisma.microservice.findUnique.mockResolvedValue(null);

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Microservice not found');
    });

    it('should throw error when referenced model does not exist', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'BarChart', modelId: '660e8400-e29b-41d4-a716-446655440001' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      prisma.dashboardConfig.findUnique.mockResolvedValue(null);
      prisma.modelDefn.findMany.mockResolvedValue([]);

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Referenced entities not found');
    });

    it('should throw error when referenced field does not exist', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', modelId: '660e8400-e29b-41d4-a716-446655440001' }],
        filters: [{ modelId: '660e8400-e29b-41d4-a716-446655440001', fieldId: '770e8400-e29b-41d4-a716-446655440002' }],
      };
      const { req, res } = createMockReqRes(body);

      prisma.dashboardConfig.findUnique.mockResolvedValue(null);
      prisma.modelDefn.findMany.mockResolvedValue([{ id: '660e8400-e29b-41d4-a716-446655440001' }]);
      prisma.fieldDefn.findMany.mockResolvedValue([]);

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Referenced entities not found');
    });
  });

  describe('conflict errors', () => {
    it('should throw error when dashboard config already exists for microservice', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', modelId: '660e8400-e29b-41d4-a716-446655440001' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      prisma.dashboardConfig.findUnique.mockResolvedValue({ id: 'existing-config' });
      prisma.modelDefn.findMany.mockResolvedValue([{ id: '660e8400-e29b-41d4-a716-446655440001' }]);
      prisma.fieldDefn.findMany.mockResolvedValue([]);

      await expect(createDashboardBatch(req, res)).rejects.toThrow(
        'A dashboard config already exists for this microservice'
      );
    });
  });

  describe('database errors', () => {
    it('should throw error when transaction fails', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', modelId: '660e8400-e29b-41d4-a716-446655440001' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      prisma.dashboardConfig.findUnique.mockResolvedValue(null);
      prisma.modelDefn.findMany.mockResolvedValue([{ id: '660e8400-e29b-41d4-a716-446655440001' }]);
      prisma.fieldDefn.findMany.mockResolvedValue([]);
      prisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Database transaction failed');
    });

    it('should throw error when microservice lookup fails', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', modelId: '660e8400-e29b-41d4-a716-446655440001' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      prisma.dashboardConfig.findUnique.mockResolvedValue(null);
      prisma.modelDefn.findMany.mockResolvedValue([{ id: '660e8400-e29b-41d4-a716-446655440001' }]);
      prisma.fieldDefn.findMany.mockResolvedValue([]);
      prisma.microservice.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Database operation failed');
    });
  });

  describe('metric reference resolution', () => {
    it('should correctly resolve metricReference to actual metricId', async () => {
      const modelUuid = '660e8400-e29b-41d4-a716-446655440001';
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [{ reference: 'temp-metric-1', name: 'revenue', modelName: 'Order', aggregationType: 'Sum' }],
        widgets: [{ title: 'Revenue KPI', widgetType: 'KpiCard', metricReference: 'temp-metric-1' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      // Mock name resolution for the 'Order' model name
      const { resolveModelNamesToIds } = require('#utils/shared/nameResolver.js');
      resolveModelNamesToIds.mockResolvedValue(new Map([['Order', modelUuid]]));

      let capturedWidgetData = null;

      prisma.dashboardConfig.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'config-uuid', widgets: [], filters: [] });
      prisma.modelDefn.findMany.mockResolvedValue([{ id: modelUuid }]);

      const widgetCreateMock = jest.fn().mockResolvedValue({ id: 'widget-uuid' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          dashboardConfig: { create: jest.fn().mockResolvedValue({ id: 'config-uuid' }) },
          dashboardMetric: { create: jest.fn().mockResolvedValue({ id: 'actual-metric-uuid' }) },
          dashboardWidget: { create: widgetCreateMock },
          dashboardFilter: { create: jest.fn() },
          widgetDateConfig: { create: jest.fn() },
        };
        return callback(tx);
      });

      await createDashboardBatch(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(widgetCreateMock).toHaveBeenCalledTimes(1);
      // Verify widget was created with the resolved metric ID
      const widgetCallArg = widgetCreateMock.mock.calls[0][0];
      expect(widgetCallArg).toHaveProperty('data');
      expect(widgetCallArg.data).toHaveProperty('metricId', 'actual-metric-uuid');
    });

    it('should handle multiple metrics referenced by multiple widgets', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [
          { reference: 'metric-1', name: 'metric1' },
          { reference: 'metric-2', name: 'metric2' },
        ],
        widgets: [
          { title: 'Widget 1', widgetType: 'KpiCard', metricReference: 'metric-1' },
          { title: 'Widget 2', widgetType: 'KpiCard', metricReference: 'metric-2' },
          { title: 'Widget 3', widgetType: 'LineChart', metricReference: 'metric-1' },
        ],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      let metricsCreated = 0;
      let widgetsCreated = 0;

      prisma.dashboardConfig.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'config-uuid', widgets: [], filters: [] });

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          dashboardConfig: { create: jest.fn().mockResolvedValue({ id: 'config-uuid' }) },
          dashboardMetric: {
            create: jest.fn().mockImplementation(() => {
              metricsCreated++;
              return Promise.resolve({ id: `metric-uuid-${metricsCreated}` });
            }),
          },
          dashboardWidget: {
            create: jest.fn().mockImplementation(() => {
              widgetsCreated++;
              return Promise.resolve({ id: `widget-uuid-${widgetsCreated}` });
            }),
          },
          dashboardFilter: { create: jest.fn() },
          widgetDateConfig: { create: jest.fn() },
        };
        return callback(tx);
      });

      await createDashboardBatch(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(metricsCreated).toBe(2);
      expect(widgetsCreated).toBe(3);
    });
  });

  describe('widget and filter creation', () => {
    it('should create widget with modelId instead of metricReference', async () => {
      const modelUuid = '660e8400-e29b-41d4-a716-446655440001';
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Model Widget', widgetType: 'BarChart', modelId: modelUuid }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      prisma.dashboardConfig.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'config-uuid', widgets: [], filters: [] });
      prisma.modelDefn.findMany.mockResolvedValue([{ id: modelUuid }]);

      await createDashboardBatch(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should create filters correctly', async () => {
      const modelUuid = '660e8400-e29b-41d4-a716-446655440001';
      const fieldUuid = '770e8400-e29b-41d4-a716-446655440002';
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', modelId: modelUuid }],
        filters: [{ modelId: modelUuid, fieldId: fieldUuid, label: 'Status' }],
      };
      const { req, res } = createMockReqRes(body);

      let filterCreated = false;

      prisma.dashboardConfig.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'config-uuid', widgets: [], filters: [] });
      prisma.modelDefn.findMany.mockResolvedValue([{ id: modelUuid }]);
      prisma.fieldDefn.findMany.mockResolvedValue([{ id: fieldUuid }]);

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          dashboardConfig: { create: jest.fn().mockResolvedValue({ id: 'config-uuid' }) },
          dashboardMetric: { create: jest.fn() },
          dashboardWidget: { create: jest.fn() },
          dashboardFilter: {
            create: jest.fn().mockImplementation(() => {
              filterCreated = true;
              return Promise.resolve({ id: 'filter-uuid' });
            }),
          },
          widgetDateConfig: { create: jest.fn() },
        };
        return callback(tx);
      });

      await createDashboardBatch(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(filterCreated).toBe(true);
    });

    it('should create widget with nested dateConfig', async () => {
      const modelUuid = '660e8400-e29b-41d4-a716-446655440001';
      const dateFieldUuid = '880e8400-e29b-41d4-a716-446655440003';
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [
          {
            title: 'Chart',
            widgetType: 'LineChart',
            modelId: modelUuid,
            dateConfig: { dateFieldId: dateFieldUuid, defaultRange: 'ThisMonth' },
          },
        ],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      let dateConfigCreated = false;

      prisma.dashboardConfig.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'config-uuid', widgets: [], filters: [] });
      prisma.modelDefn.findMany.mockResolvedValue([{ id: modelUuid }]);
      prisma.fieldDefn.findMany.mockResolvedValue([{ id: dateFieldUuid }]);

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          dashboardConfig: { create: jest.fn().mockResolvedValue({ id: 'config-uuid' }) },
          dashboardMetric: { create: jest.fn() },
          dashboardWidget: { create: jest.fn().mockResolvedValue({ id: 'widget-uuid' }) },
          dashboardFilter: { create: jest.fn() },
          widgetDateConfig: {
            create: jest.fn().mockImplementation(() => {
              dateConfigCreated = true;
              return Promise.resolve({ id: 'date-config-uuid' });
            }),
          },
        };
        return callback(tx);
      });

      await createDashboardBatch(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(dateConfigCreated).toBe(true);
    });
  });

  describe('name resolution', () => {
    const { resolveModelNamesToIds, resolveFieldNamesToIds } = require('#utils/shared/nameResolver.js');

    it('should resolve modelName to modelId for widgets', async () => {
      const modelUuid = '660e8400-e29b-41d4-a716-446655440001';
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'BarChart', modelName: 'Deal' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      // Mock name resolution
      resolveModelNamesToIds.mockResolvedValue(new Map([['Deal', modelUuid]]));

      prisma.dashboardConfig.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'config-uuid', widgets: [], filters: [] });
      prisma.modelDefn.findMany.mockResolvedValue([{ id: modelUuid }]);

      const widgetCreateMock = jest.fn().mockResolvedValue({ id: 'widget-uuid' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          dashboardConfig: { create: jest.fn().mockResolvedValue({ id: 'config-uuid' }) },
          dashboardMetric: { create: jest.fn() },
          dashboardWidget: { create: widgetCreateMock },
          dashboardFilter: { create: jest.fn() },
          widgetDateConfig: { create: jest.fn() },
        };
        return callback(tx);
      });

      await createDashboardBatch(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(widgetCreateMock).toHaveBeenCalledTimes(1);
      // Verify widget was created with the resolved model ID
      const widgetCallArg = widgetCreateMock.mock.calls[0][0];
      expect(widgetCallArg).toHaveProperty('data');
      expect(widgetCallArg.data).toHaveProperty('modelId', modelUuid);
    });

    it('should resolve modelName and fieldName for filters', async () => {
      const modelUuid = '660e8400-e29b-41d4-a716-446655440001';
      const fieldUuid = '770e8400-e29b-41d4-a716-446655440002';
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', modelId: modelUuid }],
        filters: [{ modelName: 'Deal', fieldName: 'ownerId', label: 'Owner' }],
      };
      const { req, res } = createMockReqRes(body);

      // Mock name resolution
      resolveModelNamesToIds.mockResolvedValue(new Map([['Deal', modelUuid]]));
      const fieldMap = new Map([[modelUuid, new Map([['ownerId', fieldUuid]])]]);
      resolveFieldNamesToIds.mockResolvedValue(fieldMap);

      prisma.dashboardConfig.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'config-uuid', widgets: [], filters: [] });
      prisma.modelDefn.findMany.mockResolvedValue([{ id: modelUuid }]);
      prisma.fieldDefn.findMany.mockResolvedValue([{ id: fieldUuid }]);

      const filterCreateMock = jest.fn().mockResolvedValue({ id: 'filter-uuid' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          dashboardConfig: { create: jest.fn().mockResolvedValue({ id: 'config-uuid' }) },
          dashboardMetric: { create: jest.fn() },
          dashboardWidget: { create: jest.fn().mockResolvedValue({ id: 'widget-uuid' }) },
          dashboardFilter: { create: filterCreateMock },
          widgetDateConfig: { create: jest.fn() },
        };
        return callback(tx);
      });

      await createDashboardBatch(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(filterCreateMock).toHaveBeenCalledTimes(1);
      // Verify filter was created with the resolved model and field IDs
      const filterCallArg = filterCreateMock.mock.calls[0][0];
      expect(filterCallArg).toHaveProperty('data');
      expect(filterCallArg.data).toHaveProperty('modelId', modelUuid);
      expect(filterCallArg.data).toHaveProperty('fieldId', fieldUuid);
    });

    it('should throw error when modelName cannot be resolved', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'BarChart', modelName: 'NonExistentModel' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);

      // Mock name resolution returning empty map (model not found)
      resolveModelNamesToIds.mockResolvedValue(new Map());

      prisma.dashboardConfig.findUnique.mockResolvedValue(null);

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Some model names could not be resolved');
    });

    it('should throw error when fieldName cannot be resolved', async () => {
      const modelUuid = '660e8400-e29b-41d4-a716-446655440001';
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', modelName: 'Deal' }],
        filters: [{ modelName: 'Deal', fieldName: 'nonExistentField', label: 'Test' }],
      };
      const { req, res } = createMockReqRes(body);

      // Mock model resolution succeeds but field resolution fails
      resolveModelNamesToIds.mockResolvedValue(new Map([['Deal', modelUuid]]));
      resolveFieldNamesToIds.mockResolvedValue(new Map()); // Empty - field not found

      prisma.dashboardConfig.findUnique.mockResolvedValue(null);

      await expect(createDashboardBatch(req, res)).rejects.toThrow('Some field names could not be resolved');
    });
  });

  describe('internal request handling', () => {
    it('should require createdBy and client for internal requests', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', modelId: '660e8400-e29b-41d4-a716-446655440001' }],
        filters: [],
      };
      // Create request with internal flag but no createdBy/client
      const { req, res } = createMockReqRes(body);
      req.user = { isAuthenticated: false, internalRequest: true };

      prisma.dashboardConfig.findUnique.mockResolvedValue(null);
      prisma.modelDefn.findMany.mockResolvedValue([{ id: '660e8400-e29b-41d4-a716-446655440001' }]);
      prisma.fieldDefn.findMany.mockResolvedValue([]);

      await expect(createDashboardBatch(req, res)).rejects.toThrow(
        'For internal requests, both client and createdBy fields are required.'
      );
    });

    it('should successfully process internal request with createdBy and client', async () => {
      const body = {
        microserviceId: '550e8400-e29b-41d4-a716-446655440000',
        createdBy: '990e8400-e29b-41d4-a716-446655440099',
        client: '880e8400-e29b-41d4-a716-446655440088',
        title: 'Test',
        metrics: [],
        widgets: [{ title: 'Widget', widgetType: 'KpiCard', modelId: '660e8400-e29b-41d4-a716-446655440001' }],
        filters: [],
      };
      const { req, res } = createMockReqRes(body);
      req.user = { isAuthenticated: false, internalRequest: true };

      prisma.dashboardConfig.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'config-uuid', widgets: [], filters: [] });
      prisma.modelDefn.findMany.mockResolvedValue([{ id: '660e8400-e29b-41d4-a716-446655440001' }]);
      prisma.fieldDefn.findMany.mockResolvedValue([]);

      await createDashboardBatch(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
});
