-- AlterTable
ALTER TABLE "FieldDefn" ADD COLUMN     "isClickableLink" BOOLEAN,
ADD COLUMN     "isMultiline" BOOLEAN,
ADD COLUMN     "order" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ModelDefn" ADD COLUMN     "showInDrawer" BOOLEAN;
