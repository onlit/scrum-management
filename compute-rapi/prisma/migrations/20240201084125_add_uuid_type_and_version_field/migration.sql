/*
  Warnings:

  - Changed the type of `client` on the `Block` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdBy` on the `Block` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `updatedBy` on the `Block` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `client` on the `BlockGroup` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdBy` on the `BlockGroup` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `updatedBy` on the `BlockGroup` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `client` on the `FieldDefn` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdBy` on the `FieldDefn` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `updatedBy` on the `FieldDefn` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `client` on the `Instance` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdBy` on the `Instance` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `updatedBy` on the `Instance` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `client` on the `InstanceLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdBy` on the `InstanceLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `updatedBy` on the `InstanceLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `version` to the `Microservice` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `client` on the `Microservice` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdBy` on the `Microservice` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `updatedBy` on the `Microservice` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `client` on the `ModelDefn` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdBy` on the `ModelDefn` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `updatedBy` on the `ModelDefn` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Block" DROP COLUMN "client",
ADD COLUMN     "client" UUID NOT NULL,
DROP COLUMN "createdBy",
ADD COLUMN     "createdBy" UUID NOT NULL,
DROP COLUMN "updatedBy",
ADD COLUMN     "updatedBy" UUID NOT NULL;

-- AlterTable
ALTER TABLE "BlockGroup" DROP COLUMN "client",
ADD COLUMN     "client" UUID NOT NULL,
DROP COLUMN "createdBy",
ADD COLUMN     "createdBy" UUID NOT NULL,
DROP COLUMN "updatedBy",
ADD COLUMN     "updatedBy" UUID NOT NULL;

-- AlterTable
ALTER TABLE "FieldDefn" DROP COLUMN "client",
ADD COLUMN     "client" UUID NOT NULL,
DROP COLUMN "createdBy",
ADD COLUMN     "createdBy" UUID NOT NULL,
DROP COLUMN "updatedBy",
ADD COLUMN     "updatedBy" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Instance" DROP COLUMN "client",
ADD COLUMN     "client" UUID NOT NULL,
DROP COLUMN "createdBy",
ADD COLUMN     "createdBy" UUID NOT NULL,
DROP COLUMN "updatedBy",
ADD COLUMN     "updatedBy" UUID NOT NULL;

-- AlterTable
ALTER TABLE "InstanceLog" DROP COLUMN "client",
ADD COLUMN     "client" UUID NOT NULL,
DROP COLUMN "createdBy",
ADD COLUMN     "createdBy" UUID NOT NULL,
DROP COLUMN "updatedBy",
ADD COLUMN     "updatedBy" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Microservice" ADD COLUMN     "version" VARCHAR(50) NOT NULL,
DROP COLUMN "client",
ADD COLUMN     "client" UUID NOT NULL,
DROP COLUMN "createdBy",
ADD COLUMN     "createdBy" UUID NOT NULL,
DROP COLUMN "updatedBy",
ADD COLUMN     "updatedBy" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ModelDefn" DROP COLUMN "client",
ADD COLUMN     "client" UUID NOT NULL,
DROP COLUMN "createdBy",
ADD COLUMN     "createdBy" UUID NOT NULL,
DROP COLUMN "updatedBy",
ADD COLUMN     "updatedBy" UUID NOT NULL;
