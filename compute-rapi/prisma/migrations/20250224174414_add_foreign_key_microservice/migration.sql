-- AlterTable
ALTER TABLE "FieldDefn" ADD COLUMN     "foreignKeyMicroserviceId" UUID;

-- AddForeignKey
ALTER TABLE "FieldDefn" ADD CONSTRAINT "FieldDefn_foreignKeyMicroserviceId_fkey" FOREIGN KEY ("foreignKeyMicroserviceId") REFERENCES "Microservice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
