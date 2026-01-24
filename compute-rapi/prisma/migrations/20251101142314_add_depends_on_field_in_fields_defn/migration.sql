-- AlterTable
ALTER TABLE "FieldDefn" ADD COLUMN     "dependsOnFieldId" UUID;

-- AddForeignKey
ALTER TABLE "FieldDefn" ADD CONSTRAINT "FieldDefn_dependsOnFieldId_fkey" FOREIGN KEY ("dependsOnFieldId") REFERENCES "FieldDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
