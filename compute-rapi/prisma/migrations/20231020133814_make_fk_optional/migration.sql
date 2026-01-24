-- DropForeignKey
ALTER TABLE "FieldDefn" DROP CONSTRAINT "FieldDefn_foreignKeyMicroserviceId_fkey";

-- DropForeignKey
ALTER TABLE "FieldDefn" DROP CONSTRAINT "FieldDefn_foreignKeyModelId_fkey";

-- AlterTable
ALTER TABLE "FieldDefn" ALTER COLUMN "foreignKeyMicroserviceId" DROP NOT NULL,
ALTER COLUMN "foreignKeyModelId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "FieldDefn" ADD CONSTRAINT "FieldDefn_foreignKeyModelId_fkey" FOREIGN KEY ("foreignKeyModelId") REFERENCES "ModelDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDefn" ADD CONSTRAINT "FieldDefn_foreignKeyMicroserviceId_fkey" FOREIGN KEY ("foreignKeyMicroserviceId") REFERENCES "Microservice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
