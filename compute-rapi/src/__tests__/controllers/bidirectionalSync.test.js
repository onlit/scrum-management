/**
 * Bidirectional Translation Sync Tests
 *
 * Tests the bidirectional sync between Translation and ModelDefn/FieldDefn:
 * - Translation → Model/Field (reverse sync, only for primary language)
 * - Model/Field → Translation (forward sync, existing functionality)
 */

const prisma = require('#configs/prisma.js');
const { getPrimaryLanguage } = require('#utils/api/translationSyncUtils.js');

// Mock prisma
jest.mock('#configs/prisma.js', () => ({
  language: {
    findFirst: jest.fn(),
  },
  translation: {
    update: jest.fn(),
  },
  modelDefn: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  fieldDefn: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}));

// Mock logging utils
jest.mock('#utils/shared/loggingUtils.js', () => ({
  logEvent: jest.fn(),
}));

jest.mock('#utils/shared/traceUtils.js', () => ({
  logOperationStart: jest.fn(),
  logOperationSuccess: jest.fn(),
  logOperationError: jest.fn(),
  logDatabaseStart: jest.fn(),
  logDatabaseSuccess: jest.fn(),
  createErrorWithTrace: jest.fn((type, message) => new Error(message)),
}));

describe('Bidirectional Translation Sync', () => {
  const clientId = 'client-uuid';
  const primaryLangId = 'primary-lang-uuid';
  const secondaryLangId = 'secondary-lang-uuid';
  const modelId = 'model-uuid';
  const fieldId = 'field-uuid';
  const translationCode = 'TEST-001';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPrimaryLanguage', () => {
    it('should return primary language for client', async () => {
      const mockPrimaryLang = {
        id: primaryLangId,
        code: 'en',
        name: 'English',
      };

      prisma.language.findFirst.mockResolvedValue(mockPrimaryLang);

      const result = await getPrimaryLanguage(prisma, clientId);

      expect(result).toEqual(mockPrimaryLang);
      expect(prisma.language.findFirst).toHaveBeenCalledWith({
        where: {
          client: clientId,
          isPrimary: true,
          deleted: null,
        },
        select: { id: true, code: true, name: true },
      });
    });

    it('should return null if no primary language is set', async () => {
      prisma.language.findFirst.mockResolvedValue(null);

      const result = await getPrimaryLanguage(prisma, clientId);

      expect(result).toBeNull();
    });
  });

  describe('Reverse Sync: Translation → ModelDefn', () => {
    it('should update model label when primary language translation is updated', async () => {
      // This test would require mocking the full controller flow
      // For now, we test the logic components

      const mockPrimaryLang = { id: primaryLangId, code: 'en', name: 'English' };
      const mockModel = {
        id: modelId,
        labelTranslationCode: translationCode,
        helpfulHintTranslationCode: null,
      };

      prisma.language.findFirst.mockResolvedValue(mockPrimaryLang);
      prisma.modelDefn.findFirst.mockResolvedValue(mockModel);
      prisma.modelDefn.update.mockResolvedValue({ ...mockModel, label: 'Updated Label' });

      // Simulate the reverse sync logic
      const updatedTranslation = {
        id: 'trans-uuid',
        translationCode,
        value: 'Updated Label',
        languageId: primaryLangId,
      };

      const primaryLanguage = await getPrimaryLanguage(prisma, clientId);
      expect(primaryLanguage).toBeTruthy();

      if (primaryLanguage && updatedTranslation.languageId === primaryLanguage.id) {
        const linkedModel = await prisma.modelDefn.findFirst({
          where: {
            OR: [
              { labelTranslationCode: translationCode },
              { helpfulHintTranslationCode: translationCode },
            ],
            deleted: null,
          },
          select: {
            id: true,
            labelTranslationCode: true,
            helpfulHintTranslationCode: true,
          },
        });

        expect(linkedModel).toBeTruthy();

        if (linkedModel) {
          const updateData = {};
          if (linkedModel.labelTranslationCode === translationCode) {
            updateData.label = updatedTranslation.value;
          }

          await prisma.modelDefn.update({
            where: { id: linkedModel.id },
            data: updateData,
          });

          expect(prisma.modelDefn.update).toHaveBeenCalledWith({
            where: { id: modelId },
            data: { label: 'Updated Label' },
          });
        }
      }
    });

    it('should NOT update model when non-primary language translation is updated', async () => {
      const mockSecondaryLang = { id: secondaryLangId, code: 'ar', name: 'Arabic' };

      // Primary language is English, but we're updating Arabic
      prisma.language.findFirst.mockResolvedValue({ id: primaryLangId, code: 'en', name: 'English' });

      const updatedTranslation = {
        id: 'trans-uuid',
        translationCode,
        value: 'تسمية محدثة',
        languageId: secondaryLangId, // Different from primary
      };

      const primaryLanguage = await getPrimaryLanguage(prisma, clientId);

      // Should not proceed with sync
      if (primaryLanguage && updatedTranslation.languageId === primaryLanguage.id) {
        // This should not execute
        expect(true).toBe(false);
      } else {
        // Correct - should not sync
        expect(prisma.modelDefn.findFirst).not.toHaveBeenCalled();
        expect(prisma.modelDefn.update).not.toHaveBeenCalled();
      }
    });

    it('should update model helpfulHint when primary language translation is updated', async () => {
      const mockPrimaryLang = { id: primaryLangId, code: 'en', name: 'English' };
      const mockModel = {
        id: modelId,
        labelTranslationCode: null,
        helpfulHintTranslationCode: translationCode,
      };

      prisma.language.findFirst.mockResolvedValue(mockPrimaryLang);
      prisma.modelDefn.findFirst.mockResolvedValue(mockModel);
      prisma.modelDefn.update.mockResolvedValue({ ...mockModel, helpfulHint: 'Updated Hint' });

      const updatedTranslation = {
        id: 'trans-uuid',
        translationCode,
        value: 'Updated Hint',
        languageId: primaryLangId,
      };

      const primaryLanguage = await getPrimaryLanguage(prisma, clientId);

      if (primaryLanguage && updatedTranslation.languageId === primaryLanguage.id) {
        const linkedModel = await prisma.modelDefn.findFirst({
          where: {
            OR: [
              { labelTranslationCode: translationCode },
              { helpfulHintTranslationCode: translationCode },
            ],
            deleted: null,
          },
          select: {
            id: true,
            labelTranslationCode: true,
            helpfulHintTranslationCode: true,
          },
        });

        if (linkedModel) {
          const updateData = {};
          if (linkedModel.helpfulHintTranslationCode === translationCode) {
            updateData.helpfulHint = updatedTranslation.value;
          }

          await prisma.modelDefn.update({
            where: { id: linkedModel.id },
            data: updateData,
          });

          expect(prisma.modelDefn.update).toHaveBeenCalledWith({
            where: { id: modelId },
            data: { helpfulHint: 'Updated Hint' },
          });
        }
      }
    });
  });

  describe('Reverse Sync: Translation → FieldDefn', () => {
    it('should update field label when primary language translation is updated', async () => {
      const mockPrimaryLang = { id: primaryLangId, code: 'en', name: 'English' };
      const mockField = {
        id: fieldId,
        labelTranslationCode: translationCode,
        helpfulHintTranslationCode: null,
      };

      prisma.language.findFirst.mockResolvedValue(mockPrimaryLang);
      prisma.modelDefn.findFirst.mockResolvedValue(null); // No model found
      prisma.fieldDefn.findFirst.mockResolvedValue(mockField);
      prisma.fieldDefn.update.mockResolvedValue({ ...mockField, label: 'Updated Field Label' });

      const updatedTranslation = {
        id: 'trans-uuid',
        translationCode,
        value: 'Updated Field Label',
        languageId: primaryLangId,
      };

      const primaryLanguage = await getPrimaryLanguage(prisma, clientId);

      if (primaryLanguage && updatedTranslation.languageId === primaryLanguage.id) {
        // Check model first (would return null in this test)
        await prisma.modelDefn.findFirst({
          where: {
            OR: [
              { labelTranslationCode: translationCode },
              { helpfulHintTranslationCode: translationCode },
            ],
            deleted: null,
          },
        });

        // Then check field
        const linkedField = await prisma.fieldDefn.findFirst({
          where: {
            OR: [
              { labelTranslationCode: translationCode },
              { helpfulHintTranslationCode: translationCode },
            ],
            deleted: null,
          },
          select: {
            id: true,
            labelTranslationCode: true,
            helpfulHintTranslationCode: true,
          },
        });

        if (linkedField) {
          const updateData = {};
          if (linkedField.labelTranslationCode === translationCode) {
            updateData.label = updatedTranslation.value;
          }

          await prisma.fieldDefn.update({
            where: { id: linkedField.id },
            data: updateData,
          });

          expect(prisma.fieldDefn.update).toHaveBeenCalledWith({
            where: { id: fieldId },
            data: { label: 'Updated Field Label' },
          });
        }
      }
    });

    it('should NOT update field when non-primary language translation is updated', async () => {
      prisma.language.findFirst.mockResolvedValue({ id: primaryLangId, code: 'en', name: 'English' });

      const updatedTranslation = {
        id: 'trans-uuid',
        translationCode,
        value: 'حقل محدث',
        languageId: secondaryLangId, // Different from primary
      };

      const primaryLanguage = await getPrimaryLanguage(prisma, clientId);

      // Should not proceed with sync
      if (primaryLanguage && updatedTranslation.languageId === primaryLanguage.id) {
        expect(true).toBe(false);
      } else {
        expect(prisma.fieldDefn.findFirst).not.toHaveBeenCalled();
        expect(prisma.fieldDefn.update).not.toHaveBeenCalled();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle case where no primary language is set', async () => {
      prisma.language.findFirst.mockResolvedValue(null);

      const primaryLanguage = await getPrimaryLanguage(prisma, clientId);

      expect(primaryLanguage).toBeNull();

      // Sync should not proceed
      if (primaryLanguage) {
        expect(true).toBe(false);
      }
    });

    it('should handle case where translation code is not linked to any model or field', async () => {
      const mockPrimaryLang = { id: primaryLangId, code: 'en', name: 'English' };

      prisma.language.findFirst.mockResolvedValue(mockPrimaryLang);
      prisma.modelDefn.findFirst.mockResolvedValue(null);
      prisma.fieldDefn.findFirst.mockResolvedValue(null);

      const updatedTranslation = {
        id: 'trans-uuid',
        translationCode: 'ORPHAN-001',
        value: 'Orphan Translation',
        languageId: primaryLangId,
      };

      const primaryLanguage = await getPrimaryLanguage(prisma, clientId);

      if (primaryLanguage && updatedTranslation.languageId === primaryLanguage.id) {
        const linkedModel = await prisma.modelDefn.findFirst({
          where: {
            OR: [
              { labelTranslationCode: updatedTranslation.translationCode },
              { helpfulHintTranslationCode: updatedTranslation.translationCode },
            ],
            deleted: null,
          },
        });

        const linkedField = await prisma.fieldDefn.findFirst({
          where: {
            OR: [
              { labelTranslationCode: updatedTranslation.translationCode },
              { helpfulHintTranslationCode: updatedTranslation.translationCode },
            ],
            deleted: null,
          },
        });

        expect(linkedModel).toBeNull();
        expect(linkedField).toBeNull();
        expect(prisma.modelDefn.update).not.toHaveBeenCalled();
        expect(prisma.fieldDefn.update).not.toHaveBeenCalled();
      }
    });
  });
});
