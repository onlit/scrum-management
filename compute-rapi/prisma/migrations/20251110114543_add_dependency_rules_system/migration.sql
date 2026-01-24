-- CreateEnum
CREATE TYPE "DependencyActionType" AS ENUM ('Show', 'Hide', 'Require', 'Optional', 'Enable', 'Disable');

-- CreateEnum
CREATE TYPE "DependencyConditionOperator" AS ENUM ('Equals', 'NotEquals', 'In', 'NotIn', 'IsSet', 'IsNotSet');

-- CreateEnum
CREATE TYPE "DependencyLogicOperator" AS ENUM ('And', 'Or');

-- CreateEnum
CREATE TYPE "GroupRequirementType" AS ENUM ('AtLeastOne', 'ExactlyOne', 'All', 'None');

-- CreateTable
CREATE TABLE "FieldGroup" (
    "id" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "label" VARCHAR(200),
    "description" TEXT,
    "requirementType" "GroupRequirementType" NOT NULL DEFAULT 'AtLeastOne',
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

    CONSTRAINT "FieldGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldDependencyRule" (
    "id" UUID NOT NULL,
    "targetFieldId" UUID NOT NULL,
    "action" "DependencyActionType" NOT NULL,
    "logicOperator" "DependencyLogicOperator" NOT NULL DEFAULT 'And',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "fieldGroupId" UUID,
    "description" TEXT,
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

    CONSTRAINT "FieldDependencyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldDependencyCondition" (
    "id" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "sourceFieldId" UUID NOT NULL,
    "operator" "DependencyConditionOperator" NOT NULL,
    "compareValue" JSONB,
    "client" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),

    CONSTRAINT "FieldDependencyCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FieldGroup_modelId_idx" ON "FieldGroup"("modelId");

-- CreateIndex
CREATE INDEX "FieldGroup_client_idx" ON "FieldGroup"("client");

-- CreateIndex
CREATE INDEX "FieldGroup_deleted_idx" ON "FieldGroup"("deleted");

-- CreateIndex
CREATE INDEX "FieldDependencyRule_targetFieldId_idx" ON "FieldDependencyRule"("targetFieldId");

-- CreateIndex
CREATE INDEX "FieldDependencyRule_fieldGroupId_idx" ON "FieldDependencyRule"("fieldGroupId");

-- CreateIndex
CREATE INDEX "FieldDependencyRule_client_idx" ON "FieldDependencyRule"("client");

-- CreateIndex
CREATE INDEX "FieldDependencyRule_deleted_idx" ON "FieldDependencyRule"("deleted");

-- CreateIndex
CREATE INDEX "FieldDependencyCondition_ruleId_idx" ON "FieldDependencyCondition"("ruleId");

-- CreateIndex
CREATE INDEX "FieldDependencyCondition_sourceFieldId_idx" ON "FieldDependencyCondition"("sourceFieldId");

-- AddForeignKey
ALTER TABLE "FieldGroup" ADD CONSTRAINT "FieldGroup_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelDefn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDependencyRule" ADD CONSTRAINT "FieldDependencyRule_targetFieldId_fkey" FOREIGN KEY ("targetFieldId") REFERENCES "FieldDefn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDependencyRule" ADD CONSTRAINT "FieldDependencyRule_fieldGroupId_fkey" FOREIGN KEY ("fieldGroupId") REFERENCES "FieldGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDependencyCondition" ADD CONSTRAINT "FieldDependencyCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "FieldDependencyRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDependencyCondition" ADD CONSTRAINT "FieldDependencyCondition_sourceFieldId_fkey" FOREIGN KEY ("sourceFieldId") REFERENCES "FieldDefn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
