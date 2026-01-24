-- CreateEnum
CREATE TYPE "ForeignKeyTarget" AS ENUM ('Internal', 'External');

-- AlterTable
ALTER TABLE "FieldDefn" ADD COLUMN     "externalDisplayValue" VARCHAR(200),
ADD COLUMN     "externalMicroserviceId" UUID,
ADD COLUMN     "externalModelId" UUID,
ADD COLUMN     "foreignKeyTarget" "ForeignKeyTarget" NOT NULL DEFAULT 'Internal';
