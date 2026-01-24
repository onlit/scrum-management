/*
  Warnings:

  - You are about to drop the `Menu` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Menu" DROP CONSTRAINT "Menu_microserviceId_fkey";

-- DropForeignKey
ALTER TABLE "Menu" DROP CONSTRAINT "Menu_parentMenuId_fkey";

-- DropTable
DROP TABLE "Menu";

-- CreateTable
CREATE TABLE "MenuDefn" (
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

    CONSTRAINT "MenuDefn_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MenuDefn" ADD CONSTRAINT "MenuDefn_parentMenuId_fkey" FOREIGN KEY ("parentMenuId") REFERENCES "MenuDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuDefn" ADD CONSTRAINT "MenuDefn_microserviceId_fkey" FOREIGN KEY ("microserviceId") REFERENCES "Microservice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
