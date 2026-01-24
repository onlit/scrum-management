-- AlterTable
ALTER TABLE "FieldDefn" ALTER COLUMN "helpfulHintTranslationCode" DROP NOT NULL,
ALTER COLUMN "labelTranslationCode" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ModelDefn" ALTER COLUMN "helpfulHintTranslationCode" DROP NOT NULL,
ALTER COLUMN "labelTranslationCode" DROP NOT NULL;
