const mockSyncLogCreate = jest.fn();
const mockSyncLogFindFirst = jest.fn();
const mockSyncLogFindMany = jest.fn();
const mockSyncLogUpdate = jest.fn();
const mockSyncLogCount = jest.fn();
const mockModelDefnCount = jest.fn();
const mockFieldDefnCount = jest.fn();
const mockModelDefnFindMany = jest.fn();
const mockFieldDefnFindMany = jest.fn();
const mockTranslationCount = jest.fn();
const mockQueueAdd = jest.fn();
const mockQueueGetJob = jest.fn();

const mockPrisma = {
  translationSyncLog: {
    create: mockSyncLogCreate,
    findFirst: mockSyncLogFindFirst,
    findMany: mockSyncLogFindMany,
    update: mockSyncLogUpdate,
    count: mockSyncLogCount,
  },
  modelDefn: {
    count: mockModelDefnCount,
    findMany: mockModelDefnFindMany,
  },
  fieldDefn: {
    count: mockFieldDefnCount,
    findMany: mockFieldDefnFindMany,
  },
  translation: {
    count: mockTranslationCount,
  },
};

jest.mock('#configs/prisma.js', () => mockPrisma);

jest.mock('#bullQueues/queues/translationSyncQueue.js', () => ({
  translationSyncQueue: {
    add: mockQueueAdd,
    getJob: mockQueueGetJob,
  },
}));

jest.mock('#utils/shared/visibilityUtils.js', () => ({
  getVisibilityFilters: jest.fn().mockReturnValue({ client: 'client-uuid' }),
  buildCreateRecordPayload: jest.fn((p) => p.validatedValues),
}));

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

const {
  startTranslationSync,
  getTranslationSyncStatus,
  getTranslationSyncLog,
  resumeTranslationSync,
} = require('#controllers/translationSync.controller.js');

describe('translationSync controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startTranslationSync', () => {
    it('creates sync log and queues job', async () => {
      const mockSyncLog = {
        id: 'sync-uuid',
        status: 'Processing',
        mode: 'Sync',
      };
      mockSyncLogCreate.mockResolvedValue(mockSyncLog);
      mockQueueAdd.mockResolvedValue({ id: 'job-uuid' });

      const req = {
        user: {
          id: 'user-uuid',
          client: { id: 'client-uuid' },
        },
        body: {
          mode: 'Sync',
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await startTranslationSync(req, res);

      expect(mockSyncLogCreate).toHaveBeenCalled();
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'translation-sync',
        expect.objectContaining({
          syncLogId: 'sync-uuid',
          clientId: 'client-uuid',
          userId: 'user-uuid',
        }),
        expect.objectContaining({
          jobId: 'sync-uuid',
        })
      );
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('started'),
          syncLogId: 'sync-uuid',
        })
      );
    });

    it('validates mode parameter', async () => {
      const req = {
        user: { id: 'user-uuid', client: { id: 'client-uuid' } },
        body: { mode: 'InvalidMode' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await expect(startTranslationSync(req, res)).rejects.toThrow();
    });
  });

  describe('getTranslationSyncStatus', () => {
    it('returns counts and missing code statistics', async () => {
      mockModelDefnCount.mockResolvedValue(100);
      mockFieldDefnCount.mockResolvedValue(500);
      mockModelDefnFindMany.mockResolvedValue([
        { id: 'm1', labelTranslationCode: 'CODE-001', helpfulHintTranslationCode: null },
        { id: 'm2', labelTranslationCode: null, helpfulHintTranslationCode: null },
      ]);
      mockFieldDefnFindMany.mockResolvedValue([
        { id: 'f1', labelTranslationCode: 'CODE-002', helpfulHintTranslationCode: null },
      ]);
      mockTranslationCount.mockResolvedValue(50);
      mockSyncLogFindMany.mockResolvedValue([]);

      const req = {
        user: { id: 'user-uuid', client: { id: 'client-uuid' } },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getTranslationSyncStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalModels: 100,
          totalFields: 500,
          totalTranslations: 50,
        })
      );
    });
  });

  describe('getTranslationSyncLog', () => {
    it('returns sync log by id', async () => {
      const mockLog = {
        id: 'sync-uuid',
        status: 'Completed',
        processedModels: 100,
        processedFields: 500,
      };
      mockSyncLogFindFirst.mockResolvedValue(mockLog);

      const req = {
        params: { id: 'sync-uuid' },
        user: { id: 'user-uuid', client: { id: 'client-uuid' } },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getTranslationSyncLog(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sync-uuid',
          status: 'Completed',
        })
      );
    });

    it('returns 404 when log not found', async () => {
      mockSyncLogFindFirst.mockResolvedValue(null);

      const req = {
        params: { id: 'nonexistent' },
        user: { id: 'user-uuid', client: { id: 'client-uuid' } },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await expect(getTranslationSyncLog(req, res)).rejects.toThrow(
        'not found'
      );
    });
  });
});
