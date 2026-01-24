const mockModelFindMany = jest.fn();
const mockFieldFindMany = jest.fn();
const mockModelCount = jest.fn();
const mockFieldCount = jest.fn();
const mockSyncLogUpdate = jest.fn();
const mockTransaction = jest.fn((fn) => fn(mockPrisma));

const mockPrisma = {
  $transaction: mockTransaction,
  translationSyncLog: {
    update: mockSyncLogUpdate,
  },
  modelDefn: {
    findMany: mockModelFindMany,
    count: mockModelCount,
  },
  fieldDefn: {
    findMany: mockFieldFindMany,
    count: mockFieldCount,
  },
};

jest.mock('#configs/prisma.js', () => mockPrisma);

const mockGetClientLanguages = jest.fn();
const mockSyncModelTranslations = jest.fn();
const mockSyncFieldTranslations = jest.fn();

jest.mock('#utils/api/translationSyncUtils.js', () => ({
  getClientLanguages: mockGetClientLanguages,
  syncModelTranslations: mockSyncModelTranslations,
  syncFieldTranslations: mockSyncFieldTranslations,
}));

jest.mock('#configs/bullQueue.js', () => ({
  connection: {},
}));

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((name, processor, opts) => ({
    name,
    processor,
    on: jest.fn(),
  })),
}));

jest.mock('#utils/shared/loggingUtils.js', () => ({
  logEvent: jest.fn(),
}));

describe('translationSyncWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processTranslationSync', () => {
    it('processes models and fields in batches', async () => {
      // Setup mocks
      mockGetClientLanguages.mockResolvedValue([{ id: 'en', code: 'en' }]);

      mockModelCount.mockResolvedValue(2);
      mockFieldCount.mockResolvedValue(3);

      mockModelFindMany
        .mockResolvedValueOnce([
          { id: 'm1', label: 'Model 1' },
          { id: 'm2', label: 'Model 2' },
        ])
        .mockResolvedValueOnce([]); // End of models

      mockFieldFindMany
        .mockResolvedValueOnce([
          { id: 'f1', label: 'Field 1' },
          { id: 'f2', label: 'Field 2' },
          { id: 'f3', label: 'Field 3' },
        ])
        .mockResolvedValueOnce([]); // End of fields

      mockSyncModelTranslations.mockResolvedValue({
        translationsCreated: 1,
        translationsUpdated: 0,
        codesGenerated: 0,
        errors: [],
      });

      mockSyncFieldTranslations.mockResolvedValue({
        translationsCreated: 1,
        translationsUpdated: 0,
        codesGenerated: 0,
        errors: [],
      });

      mockSyncLogUpdate.mockResolvedValue({});

      // Import and get processor
      const {
        processTranslationSync,
      } = require('#bullQueues/workers/translationSyncWorker.js');

      const job = {
        id: 'job-uuid',
        data: {
          syncLogId: 'sync-log-uuid',
          clientId: 'client-uuid',
          userId: 'user-uuid',
          mode: 'Sync',
          generateMissingCodes: false,
        },
        updateProgress: jest.fn(),
      };

      const result = await processTranslationSync(job);

      expect(mockSyncModelTranslations).toHaveBeenCalledTimes(2);
      expect(mockSyncFieldTranslations).toHaveBeenCalledTimes(3);
      expect(result.modelsProcessed).toBe(2);
      expect(result.fieldsProcessed).toBe(3);
    });

    it('throws error when no languages found', async () => {
      mockGetClientLanguages.mockResolvedValue([]);

      const {
        processTranslationSync,
      } = require('#bullQueues/workers/translationSyncWorker.js');

      const job = {
        id: 'job-uuid',
        data: {
          syncLogId: 'sync-log-uuid',
          clientId: 'client-uuid',
          userId: 'user-uuid',
          mode: 'Sync',
        },
        updateProgress: jest.fn(),
      };

      await expect(processTranslationSync(job)).rejects.toThrow(
        'No languages found'
      );
    });
  });
});
