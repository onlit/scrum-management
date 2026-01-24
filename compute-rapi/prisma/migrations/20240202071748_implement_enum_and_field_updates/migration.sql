/*
  Warnings:

  - You are about to drop the column `alias` on the `FieldDefn` table. All the data in the column will be lost.
  - You are about to drop the column `isPrimaryKey` on the `FieldDefn` table. All the data in the column will be lost.
  - You are about to drop the column `alias` on the `ModelDefn` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "FieldTypes" ADD VALUE 'Enum';

-- AlterTable
ALTER TABLE "FieldDefn" DROP COLUMN "alias",
DROP COLUMN "isPrimaryKey",
ADD COLUMN     "enumDefnId" UUID,
ADD COLUMN     "maxLength" INTEGER,
ADD COLUMN     "minLength" INTEGER;

-- AlterTable
ALTER TABLE "ModelDefn" DROP COLUMN "alias";

-- CreateTable
CREATE TABLE "EnumDefn" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "tags" TEXT,
    "microserviceId" UUID NOT NULL,
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

    CONSTRAINT "EnumDefn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnumValue" (
    "id" UUID NOT NULL,
    "value" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "tags" TEXT,
    "enumDefnId" UUID NOT NULL,
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

    CONSTRAINT "EnumValue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FieldDefn" ADD CONSTRAINT "FieldDefn_enumDefnId_fkey" FOREIGN KEY ("enumDefnId") REFERENCES "EnumDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnumDefn" ADD CONSTRAINT "EnumDefn_microserviceId_fkey" FOREIGN KEY ("microserviceId") REFERENCES "Microservice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnumValue" ADD CONSTRAINT "EnumValue_enumDefnId_fkey" FOREIGN KEY ("enumDefnId") REFERENCES "EnumDefn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
