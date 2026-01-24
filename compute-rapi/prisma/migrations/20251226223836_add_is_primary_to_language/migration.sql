-- AlterTable
ALTER TABLE "Language" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Language_client_isPrimary_idx" ON "Language"("client", "isPrimary");

-- Add comment
COMMENT ON COLUMN "Language"."isPrimary" IS 'Marks the primary/default language for bidirectional translation sync. Only one language per client should be primary.';
