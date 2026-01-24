-- DropIndex
DROP INDEX "public"."Company_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObject_idx";

-- DropIndex
DROP INDEX "public"."Person_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObjectC_idx";

-- AlterTable
ALTER TABLE "public"."Company" ADD COLUMN     "cityId" UUID,
ADD COLUMN     "industryId" UUID,
ADD COLUMN     "stateId" UUID;

-- AlterTable
ALTER TABLE "public"."Person" ADD COLUMN     "cityId" UUID,
ADD COLUMN     "stateId" UUID;

-- CreateIndex
CREATE INDEX "Company_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObject_idx" ON "public"."Company"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt", "ownerId", "countryId", "stateId", "cityId", "industryId");

-- CreateIndex
CREATE INDEX "Person_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObjectC_idx" ON "public"."Person"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt", "countryId", "stateId", "cityId");
