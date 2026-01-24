-- CreateEnum
CREATE TYPE "FormDefnTypes" AS ENUM ('Create');

-- AlterTable
ALTER TABLE "FieldDefn" ADD COLUMN     "label" TEXT,
ADD COLUMN     "showInTable" BOOLEAN;

-- CreateTable
CREATE TABLE "FormDefn" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "FormDefnTypes" NOT NULL,
    "modelId" UUID NOT NULL,
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

    CONSTRAINT "FormDefn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepDefn" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "formDefnId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
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

    CONSTRAINT "StepDefn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldLayoutDefn" (
    "id" UUID NOT NULL,
    "fieldDefnId" UUID NOT NULL,
    "colSpan" INTEGER NOT NULL,
    "stepDefnId" UUID NOT NULL,
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

    CONSTRAINT "FieldLayoutDefn_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FormDefn" ADD CONSTRAINT "FormDefn_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelDefn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepDefn" ADD CONSTRAINT "StepDefn_formDefnId_fkey" FOREIGN KEY ("formDefnId") REFERENCES "FormDefn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldLayoutDefn" ADD CONSTRAINT "FieldLayoutDefn_fieldDefnId_fkey" FOREIGN KEY ("fieldDefnId") REFERENCES "FieldDefn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldLayoutDefn" ADD CONSTRAINT "FieldLayoutDefn_stepDefnId_fkey" FOREIGN KEY ("stepDefnId") REFERENCES "StepDefn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
