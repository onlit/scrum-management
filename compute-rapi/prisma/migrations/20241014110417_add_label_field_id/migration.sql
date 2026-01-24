-- AlterTable
ALTER TABLE "ModelDefn" ADD COLUMN     "labelFieldId" UUID;

-- AddForeignKey
ALTER TABLE "ModelDefn" ADD CONSTRAINT "ModelDefn_labelFieldId_fkey" FOREIGN KEY ("labelFieldId") REFERENCES "FieldDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
