const prisma = require('#configs/prisma.js');

/**
 * Migrates existing dependsOnFieldId relationships to new dependency rules system
 *
 * This script:
 * 1. Finds all fields with dependsOnFieldId set
 * 2. Creates equivalent FieldDependencyRule with IsSet condition
 * 3. Maintains backward compatibility by not removing old field
 *
 * Run: node src/scripts/migrateDependenciesToRules.js
 */
async function migrateDependencies() {
  console.log('====================================');
  console.log('Dependency Migration Tool');
  console.log('====================================\n');
  console.log('Starting migration of old dependencies to new rule system...\n');

  try {
    // Find all fields with dependencies
    const fieldsWithDependencies = await prisma.fieldDefn.findMany({
      where: {
        dependsOnFieldId: { not: null },
        deleted: null,
      },
      include: {
        dependsOnField: true,
        model: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(
      `Found ${fieldsWithDependencies.length} fields with dependencies\n`
    );

    if (fieldsWithDependencies.length === 0) {
      console.log('No dependencies to migrate. Exiting.\n');
      return;
    }

    let migratedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const field of fieldsWithDependencies) {
      try {
        // Check if rule already exists
        const existingRule = await prisma.fieldDependencyRule.findFirst({
          where: {
            targetFieldId: field.id,
            deleted: null,
            conditions: {
              some: {
                sourceFieldId: field.dependsOnFieldId,
                operator: 'IsSet',
              },
            },
          },
        });

        if (existingRule) {
          console.log(
            `⏭️  Skipping ${field.name} (${field.model.name}): Rule already exists`
          );
          skippedCount++;
          continue;
        }

        // Create equivalent dependency rule
        const createdRule = await prisma.fieldDependencyRule.create({
          data: {
            targetFieldId: field.id,
            action: 'Enable',
            logicOperator: 'And',
            priority: 0,
            description: `Auto-migrated from dependsOnField: ${field.dependsOnField.name}`,
            client: field.client,
            createdBy: field.createdBy,
            updatedBy: field.updatedBy,
            everyoneCanSeeIt: field.everyoneCanSeeIt,
            anonymousCanSeeIt: field.anonymousCanSeeIt,
            everyoneInObjectCompanyCanSeeIt:
              field.everyoneInObjectCompanyCanSeeIt,
            onlyTheseRolesCanSeeIt: field.onlyTheseRolesCanSeeIt,
            onlyTheseUsersCanSeeIt: field.onlyTheseUsersCanSeeIt,
            conditions: {
              create: {
                sourceFieldId: field.dependsOnFieldId,
                operator: 'IsSet',
                compareValue: null,
                client: field.client,
                createdBy: field.createdBy,
                updatedBy: field.updatedBy,
              },
            },
          },
          include: {
            conditions: {
              include: {
                sourceField: true,
              },
            },
          },
        });

        console.log(`✅ Migrated: ${field.name} (${field.model.name})`);
        console.log(
          `   Source: ${field.dependsOnField.name} → Target: ${field.name}`
        );
        console.log(`   Rule ID: ${createdRule.id}\n`);

        migratedCount++;
      } catch (error) {
        console.error(
          `❌ Error migrating field ${field.name}: ${error.message}\n`
        );
        errors.push({
          field: field.name,
          model: field.model.name,
          error: error.message,
        });
      }
    }

    // Summary
    console.log('\n====================================');
    console.log('Migration Summary');
    console.log('====================================');
    console.log(`Total fields processed: ${fieldsWithDependencies.length}`);
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (already migrated): ${skippedCount}`);
    console.log(`❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\nErrors encountered:');
      errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.model}.${err.field}: ${err.error}`);
      });
    }

    console.log('\n✨ Migration completed!\n');
    console.log(
      'NOTE: The old dependsOnFieldId field has been kept for backward compatibility.'
    );
    console.log('You can safely use both systems during transition.\n');
  } catch (error) {
    console.error('\n❌ Fatal error during migration:');
    console.error(error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrateDependencies()
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

module.exports = { migrateDependencies };
