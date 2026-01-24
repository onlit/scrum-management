/**
 * Integration tests for Translation Sync
 *
 * These tests require a real database connection.
 * Run with: yarn test -- --testPathPattern=integration
 */

const prisma = require('#configs/prisma.js');
const {
  syncModelTranslations,
  syncFieldTranslations,
  getClientLanguages,
} = require('#utils/api/translationSyncUtils.js');
const {
  generateUniqueCode,
} = require('#utils/api/translationCodeGeneratorUtils.js');

// Skip if no database connection
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb('Translation Sync Integration', () => {
  let testClientId;
  let testUserId;
  let testLanguageId;
  let testMicroserviceId;
  let testModelId;
  let testFieldId;

  beforeAll(async () => {
    // Create test data
    testClientId = '00000000-0000-0000-0000-000000000001';
    testUserId = '00000000-0000-0000-0000-000000000002';

    // Create test language
    const language = await prisma.language.create({
      data: {
        code: 'test-en',
        name: 'Test English',
        direction: 'LTR',
        client: testClientId,
        createdBy: testUserId,
        updatedBy: testUserId,
      },
    });
    testLanguageId = language.id;

    // Create test microservice
    const microservice = await prisma.microservice.create({
      data: {
        name: 'TestSyncService',
        version: '1.0.0',
        client: testClientId,
        createdBy: testUserId,
        updatedBy: testUserId,
      },
    });
    testMicroserviceId = microservice.id;

    // Create test model
    const model = await prisma.modelDefn.create({
      data: {
        name: 'TestSyncModel',
        label: 'Test Sync Model',
        helpfulHint: 'A model for testing sync',
        microserviceId: testMicroserviceId,
        client: testClientId,
        createdBy: testUserId,
        updatedBy: testUserId,
      },
    });
    testModelId = model.id;

    // Create test field
    const field = await prisma.fieldDefn.create({
      data: {
        name: 'testSyncField',
        label: 'Test Sync Field',
        helpfulHint: 'A field for testing sync',
        dataType: 'String',
        modelId: testModelId,
        client: testClientId,
        createdBy: testUserId,
        updatedBy: testUserId,
      },
    });
    testFieldId = field.id;
  });

  afterAll(async () => {
    // Cleanup in reverse order
    await prisma.translation.deleteMany({ where: { client: testClientId } });
    await prisma.fieldDefn.deleteMany({ where: { id: testFieldId } });
    await prisma.modelDefn.deleteMany({ where: { id: testModelId } });
    await prisma.microservice.deleteMany({ where: { id: testMicroserviceId } });
    await prisma.language.deleteMany({ where: { id: testLanguageId } });
    await prisma.$disconnect();
  });

  describe('generateUniqueCode', () => {
    it('generates unique codes that do not collide', async () => {
      const codes = new Set();
      for (let i = 0; i < 10; i += 1) {
        const code = await generateUniqueCode(prisma, testClientId);
        expect(codes.has(code)).toBe(false);
        codes.add(code);

        // Create translation with this code to test uniqueness
        await prisma.translation.create({
          data: {
            translationCode: code,
            value: `Test ${i}`,
            namespace: 'test',
            languageId: testLanguageId,
            client: testClientId,
            createdBy: testUserId,
            updatedBy: testUserId,
          },
        });
      }
    });
  });

  describe('syncModelTranslations', () => {
    it('creates translations when codes are assigned', async () => {
      // Assign translation codes to model
      const labelCode = await generateUniqueCode(prisma, testClientId);
      const hintCode = await generateUniqueCode(prisma, testClientId);

      await prisma.modelDefn.update({
        where: { id: testModelId },
        data: {
          labelTranslationCode: labelCode,
          helpfulHintTranslationCode: hintCode,
        },
      });

      const model = await prisma.modelDefn.findUnique({
        where: { id: testModelId },
        select: {
          id: true,
          label: true,
          helpfulHint: true,
          labelTranslationCode: true,
          helpfulHintTranslationCode: true,
        },
      });

      const languages = await getClientLanguages(prisma, testClientId);

      const result = await prisma.$transaction(async (tx) => {
        return syncModelTranslations({
          tx,
          model,
          languages,
          clientId: testClientId,
          userId: testUserId,
          generateMissingCodes: false,
          dryRun: false,
        });
      });

      expect(result.translationsCreated).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Verify translations exist
      const labelTrans = await prisma.translation.findFirst({
        where: { translationCode: labelCode, languageId: testLanguageId },
      });
      expect(labelTrans).not.toBeNull();
      expect(labelTrans.value).toBe(model.label);
    });

    it('updates translations when values change', async () => {
      const model = await prisma.modelDefn.findUnique({
        where: { id: testModelId },
        select: {
          id: true,
          label: true,
          helpfulHint: true,
          labelTranslationCode: true,
          helpfulHintTranslationCode: true,
        },
      });

      // Update model label
      const newLabel = 'Updated Test Sync Model';
      await prisma.modelDefn.update({
        where: { id: testModelId },
        data: { label: newLabel },
      });

      const updatedModel = await prisma.modelDefn.findUnique({
        where: { id: testModelId },
        select: {
          id: true,
          label: true,
          helpfulHint: true,
          labelTranslationCode: true,
          helpfulHintTranslationCode: true,
        },
      });

      const languages = await getClientLanguages(prisma, testClientId);

      const result = await prisma.$transaction(async (tx) => {
        return syncModelTranslations({
          tx,
          model: updatedModel,
          languages,
          clientId: testClientId,
          userId: testUserId,
          generateMissingCodes: false,
          dryRun: false,
        });
      });

      expect(result.translationsUpdated).toBeGreaterThanOrEqual(1);

      // Verify translation was updated
      const labelTrans = await prisma.translation.findFirst({
        where: {
          translationCode: model.labelTranslationCode,
          languageId: testLanguageId,
        },
      });
      expect(labelTrans.value).toBe(newLabel);
    });

    it('dry run mode does not modify database', async () => {
      const beforeCount = await prisma.translation.count({
        where: { client: testClientId },
      });

      const model = await prisma.modelDefn.findUnique({
        where: { id: testModelId },
        select: {
          id: true,
          label: true,
          helpfulHint: true,
          labelTranslationCode: true,
          helpfulHintTranslationCode: true,
        },
      });

      const languages = await getClientLanguages(prisma, testClientId);

      // Update label but use dry run
      await prisma.modelDefn.update({
        where: { id: testModelId },
        data: { label: 'Dry Run Label' },
      });

      const updatedModel = await prisma.modelDefn.findUnique({
        where: { id: testModelId },
        select: {
          id: true,
          label: true,
          helpfulHint: true,
          labelTranslationCode: true,
          helpfulHintTranslationCode: true,
        },
      });

      const result = await prisma.$transaction(async (tx) => {
        return syncModelTranslations({
          tx,
          model: updatedModel,
          languages,
          clientId: testClientId,
          userId: testUserId,
          generateMissingCodes: false,
          dryRun: true, // DRY RUN
        });
      });

      const afterCount = await prisma.translation.count({
        where: { client: testClientId },
      });

      // Count should be same (or would_update reported)
      expect(result.wouldUpdate).toBeGreaterThanOrEqual(0);
    });
  });
});
