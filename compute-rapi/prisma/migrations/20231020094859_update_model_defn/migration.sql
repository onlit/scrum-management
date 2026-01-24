/*
  Warnings:

  - The primary key for the `FieldDefn` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Microservice` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ModelDefn` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `FieldDefn` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `modelId` on the `FieldDefn` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Microservice` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `ModelDefn` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `microserviceId` on the `ModelDefn` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
ALTER TYPE "FieldTypes" ADD VALUE 'UUID';

-- DropForeignKey
ALTER TABLE "FieldDefn" DROP CONSTRAINT "FieldDefn_modelId_fkey";

-- DropForeignKey
ALTER TABLE "ModelDefn" DROP CONSTRAINT "ModelDefn_microserviceId_fkey";

-- AlterTable
ALTER TABLE "FieldDefn" DROP CONSTRAINT "FieldDefn_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "modelId",
ADD COLUMN     "modelId" UUID NOT NULL,
ADD CONSTRAINT "FieldDefn_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Microservice" DROP CONSTRAINT "Microservice_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "Microservice_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ModelDefn" DROP CONSTRAINT "ModelDefn_pkey",
ADD COLUMN     "alias" VARCHAR(200),
ADD COLUMN     "parentId" UUID,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "microserviceId",
ADD COLUMN     "microserviceId" UUID NOT NULL,
ADD CONSTRAINT "ModelDefn_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "ModelDefn" ADD CONSTRAINT "ModelDefn_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ModelDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelDefn" ADD CONSTRAINT "ModelDefn_microserviceId_fkey" FOREIGN KEY ("microserviceId") REFERENCES "Microservice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDefn" ADD CONSTRAINT "FieldDefn_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelDefn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
