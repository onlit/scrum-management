-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "errorContext" VARCHAR(200),
ADD COLUMN     "errorDetails" JSONB,
ADD COLUMN     "errorPhase" VARCHAR(50),
ADD COLUMN     "errorType" VARCHAR(50),
ADD COLUMN     "processingStartedAt" TIMESTAMP(3),
ADD COLUMN     "queuePosition" INTEGER,
ADD COLUMN     "queuedAt" TIMESTAMP(3),
ADD COLUMN     "requestTraceId" VARCHAR(100);
