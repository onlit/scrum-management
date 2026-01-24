-- CreateEnum
CREATE TYPE "DeploymentState" AS ENUM ('Development', 'Production');

-- AlterTable
ALTER TABLE "Microservice" ADD COLUMN     "deploymentState" "DeploymentState" DEFAULT 'Development';
