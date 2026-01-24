-- CreateIndex
CREATE INDEX "Microservice_name_idx" ON "Microservice"("name");

-- CreateIndex
CREATE INDEX "Microservice_client_idx" ON "Microservice"("client");

-- CreateIndex
CREATE INDEX "Microservice_createdAt_idx" ON "Microservice"("createdAt");

-- CreateIndex
CREATE INDEX "Microservice_deleted_idx" ON "Microservice"("deleted");

-- CreateIndex
CREATE INDEX "ModelDefn_name_idx" ON "ModelDefn"("name");

-- CreateIndex
CREATE INDEX "ModelDefn_microserviceId_idx" ON "ModelDefn"("microserviceId");

-- CreateIndex
CREATE INDEX "ModelDefn_client_idx" ON "ModelDefn"("client");

-- CreateIndex
CREATE INDEX "ModelDefn_createdAt_idx" ON "ModelDefn"("createdAt");

-- CreateIndex
CREATE INDEX "ModelDefn_deleted_idx" ON "ModelDefn"("deleted");
