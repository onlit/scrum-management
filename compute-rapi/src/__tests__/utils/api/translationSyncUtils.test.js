const {
  syncTranslationForValue,
  syncModelTranslations,
  syncFieldTranslations,
  getClientLanguages,
} = require('#utils/api/translationSyncUtils.js');

const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockFindMany = jest.fn();
const mockModelDefnUpdate = jest.fn();
const mockFieldDefnUpdate = jest.fn();

const mockPrisma = {
  $transaction: jest.fn((callback) => callback(mockPrisma)),
  translation: {
    findFirst: mockFindFirst,
    create: mockCreate,
    update: mockUpdate,
  },
  language: {
    findMany: mockFindMany,
  },
  modelDefn: {
    update: mockModelDefnUpdate,
  },
  fieldDefn: {
    update: mockFieldDefnUpdate,
  },
};

jest.mock('#configs/prisma.js', () => mockPrisma);

jest.mock('#utils/api/translationCodeGeneratorUtils.js', () => ({
  generateUniqueCodeWithLock: jest.fn().mockResolvedValue('GENR-001'),
  isValidCodeFormat: jest.fn().mockReturnValue(true),
}));

describe('translationSyncUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getClientLanguages', () => {
    it('returns all non-deleted languages for client', async () => {
      const mockLanguages = [
        { id: 'en-uuid', code: 'en', name: 'English' },
        { id: 'ar-uuid', code: 'ar', name: 'Arabic' },
      ];
      mockFindMany.mockResolvedValue(mockLanguages);

      const languages = await getClientLanguages(mockPrisma, 'client-uuid');

      expect(languages).toEqual(mockLanguages);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { client: 'client-uuid', deleted: null },
        select: { id: true, code: true, name: true },
      });
    });
  });

  describe('syncTranslationForValue', () => {
    it('creates translation when none exists', async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: 'trans-uuid',
        translationCode: 'CODE-001',
        value: 'Test Label',
      });

      const result = await syncTranslationForValue({
        tx: mockPrisma,
        translationCode: 'CODE-001',
        value: 'Test Label',
        languageId: 'lang-uuid',
        clientId: 'client-uuid',
        userId: 'user-uuid',
      });

      expect(result.action).toBe('created');
      expect(mockCreate).toHaveBeenCalled();
    });

    it('updates translation when value changed', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-uuid',
        translationCode: 'CODE-001',
        value: 'Old Value',
      });
      mockUpdate.mockResolvedValue({
        id: 'existing-uuid',
        value: 'New Value',
      });

      const result = await syncTranslationForValue({
        tx: mockPrisma,
        translationCode: 'CODE-001',
        value: 'New Value',
        languageId: 'lang-uuid',
        clientId: 'client-uuid',
        userId: 'user-uuid',
      });

      expect(result.action).toBe('updated');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('skips when value unchanged', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-uuid',
        translationCode: 'CODE-001',
        value: 'Same Value',
      });

      const result = await syncTranslationForValue({
        tx: mockPrisma,
        translationCode: 'CODE-001',
        value: 'Same Value',
        languageId: 'lang-uuid',
        clientId: 'client-uuid',
        userId: 'user-uuid',
      });

      expect(result.action).toBe('unchanged');
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('syncModelTranslations', () => {
    it('syncs label and helpfulHint to all languages', async () => {
      const model = {
        id: 'model-uuid',
        label: 'Order',
        labelTranslationCode: 'ORDL-001',
        helpfulHint: 'Create orders',
        helpfulHintTranslationCode: 'ORDH-001',
      };
      const languages = [
        { id: 'en-uuid', code: 'en' },
        { id: 'ar-uuid', code: 'ar' },
      ];

      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: 'new-trans' });

      const result = await syncModelTranslations({
        tx: mockPrisma,
        model,
        languages,
        clientId: 'client-uuid',
        userId: 'user-uuid',
        generateMissingCodes: false,
        dryRun: false,
      });

      // 2 fields (label, hint) x 2 languages = 4 translations
      expect(mockCreate).toHaveBeenCalledTimes(4);
      expect(result.translationsCreated).toBe(4);
    });

    it('does not modify database in dryRun mode', async () => {
      const model = {
        id: 'model-uuid',
        label: 'Order',
        labelTranslationCode: 'ORDL-001',
        helpfulHint: null,
        helpfulHintTranslationCode: null,
      };
      const languages = [{ id: 'en-uuid', code: 'en' }];

      mockFindFirst.mockResolvedValue(null);

      const result = await syncModelTranslations({
        tx: mockPrisma,
        model,
        languages,
        clientId: 'client-uuid',
        userId: 'user-uuid',
        generateMissingCodes: true,
        dryRun: true,
      });

      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockModelDefnUpdate).not.toHaveBeenCalled();
      expect(result.wouldCreate).toBeGreaterThan(0);
    });
  });
});
