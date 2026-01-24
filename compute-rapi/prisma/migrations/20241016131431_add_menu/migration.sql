/*
  Warnings:

  - You are about to drop the column `showInDrawer` on the `ModelDefn` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FieldDefn" ADD COLUMN     "isEditable" BOOLEAN,
ADD COLUMN     "showInDetailCard" BOOLEAN;

-- AlterTable
ALTER TABLE "ModelDefn" DROP COLUMN "showInDrawer";

-- CreateTable
CREATE TABLE "Menu" (
    "id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "parentMenuId" UUID,
    "microserviceId" UUID NOT NULL,
    "tags" TEXT,
    "everyoneCanSeeIt" BOOLEAN NOT NULL DEFAULT false,
    "anonymousCanSeeIt" BOOLEAN NOT NULL DEFAULT false,
    "everyoneInObjectCompanyCanSeeIt" BOOLEAN NOT NULL DEFAULT true,
    "onlyTheseRolesCanSeeIt" JSONB,
    "onlyTheseUsersCanSeeIt" JSONB,
    "client" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_parentMenuId_fkey" FOREIGN KEY ("parentMenuId") REFERENCES "Menu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_microserviceId_fkey" FOREIGN KEY ("microserviceId") REFERENCES "Microservice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
