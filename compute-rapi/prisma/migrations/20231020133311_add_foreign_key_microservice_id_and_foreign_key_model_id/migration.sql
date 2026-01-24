-- AlterTable
ALTER TABLE "FieldDefn" ADD COLUMN     "foreignKeyMicroserviceId" UUID,
ADD COLUMN     "foreignKeyModelId" UUID;
