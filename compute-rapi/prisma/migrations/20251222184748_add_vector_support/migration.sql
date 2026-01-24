-- CreateEnum
CREATE TYPE "VectorDistanceMetric" AS ENUM ('Cosine', 'L2', 'InnerProduct');

-- CreateEnum
CREATE TYPE "VectorIndexType" AS ENUM ('HNSW', 'IVFFlat', 'None');

-- AlterEnum
ALTER TYPE "FieldTypes" ADD VALUE 'Vector';

-- AlterTable
ALTER TABLE "FieldDefn" ADD COLUMN     "vectorDimension" INTEGER,
ADD COLUMN     "vectorDistanceMetric" "VectorDistanceMetric" DEFAULT 'Cosine',
ADD COLUMN     "vectorIndexType" "VectorIndexType" DEFAULT 'HNSW';

-- CreateTable
CREATE TABLE "VectorIndexConfig" (
    "id" UUID NOT NULL,
    "hnswM" INTEGER DEFAULT 16,
    "hnswEfConstruct" INTEGER DEFAULT 64,
    "ivfLists" INTEGER DEFAULT 100,
    "fieldDefnId" UUID NOT NULL,
    "client" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),

    CONSTRAINT "VectorIndexConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VectorIndexConfig_fieldDefnId_idx" ON "VectorIndexConfig"("fieldDefnId");

-- CreateIndex
CREATE INDEX "VectorIndexConfig_client_idx" ON "VectorIndexConfig"("client");

-- CreateIndex
CREATE INDEX "VectorIndexConfig_deleted_idx" ON "VectorIndexConfig"("deleted");

-- AddForeignKey
ALTER TABLE "VectorIndexConfig" ADD CONSTRAINT "VectorIndexConfig_fieldDefnId_fkey" FOREIGN KEY ("fieldDefnId") REFERENCES "FieldDefn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
