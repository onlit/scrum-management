-- CreateEnum
CREATE TYPE "FieldTypes" AS ENUM ('String', 'Int', 'Boolean', 'Json', 'DateTime', 'Date');

-- CreateTable
CREATE TABLE "Microservice" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "tags" TEXT,
    "everyoneCanSeeIt" BOOLEAN NOT NULL DEFAULT false,
    "anonymousCanSeeIt" BOOLEAN NOT NULL DEFAULT false,
    "everyoneInObjectCompanyCanSeeIt" BOOLEAN NOT NULL DEFAULT true,
    "onlyTheseRolesCanSeeIt" JSONB,
    "onlyTheseUsersCanSeeIt" JSONB,
    "client" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),

    CONSTRAINT "Microservice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelDefn" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "tags" TEXT,
    "microserviceId" TEXT NOT NULL,
    "everyoneCanSeeIt" BOOLEAN NOT NULL DEFAULT false,
    "anonymousCanSeeIt" BOOLEAN NOT NULL DEFAULT false,
    "everyoneInObjectCompanyCanSeeIt" BOOLEAN NOT NULL DEFAULT true,
    "onlyTheseRolesCanSeeIt" JSONB,
    "onlyTheseUsersCanSeeIt" JSONB,
    "client" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),

    CONSTRAINT "ModelDefn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldDefn" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "dataType" "FieldTypes" NOT NULL,
    "alias" VARCHAR(200),
    "inTable" BOOLEAN,
    "foreignKey" BOOLEAN,
    "primaryKey" BOOLEAN,
    "isOptional" BOOLEAN,
    "isUnique" BOOLEAN,
    "isIndex" BOOLEAN,
    "defaultValue" TEXT,
    "comment" TEXT,
    "tags" TEXT,
    "modelId" TEXT NOT NULL,
    "everyoneCanSeeIt" BOOLEAN NOT NULL DEFAULT false,
    "anonymousCanSeeIt" BOOLEAN NOT NULL DEFAULT false,
    "everyoneInObjectCompanyCanSeeIt" BOOLEAN NOT NULL DEFAULT true,
    "onlyTheseRolesCanSeeIt" JSONB,
    "onlyTheseUsersCanSeeIt" JSONB,
    "client" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),

    CONSTRAINT "FieldDefn_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ModelDefn" ADD CONSTRAINT "ModelDefn_microserviceId_fkey" FOREIGN KEY ("microserviceId") REFERENCES "Microservice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDefn" ADD CONSTRAINT "FieldDefn_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelDefn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
