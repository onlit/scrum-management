-- CreateEnum
CREATE TYPE "WidgetType" AS ENUM ('KpiCard', 'FunnelChart', 'BarChart', 'LineChart', 'AreaChart', 'PieChart', 'DonutChart');

-- CreateEnum
CREATE TYPE "AggregationType" AS ENUM ('Count', 'Sum', 'Average', 'Min', 'Max');

-- CreateEnum
CREATE TYPE "WidgetSize" AS ENUM ('Small', 'Medium', 'Large', 'Full');

-- CreateEnum
CREATE TYPE "DateRangePreset" AS ENUM ('Today', 'Yesterday', 'Last7Days', 'Last30Days', 'ThisMonth', 'LastMonth', 'ThisQuarter', 'ThisYear', 'AllTime');

-- CreateEnum
CREATE TYPE "MetricOutputType" AS ENUM ('Number', 'Currency', 'Percentage', 'Duration');

-- CreateTable
CREATE TABLE "DashboardConfig" (
    "id" UUID NOT NULL,
    "microserviceId" UUID NOT NULL,
    "title" VARCHAR(200),
    "description" TEXT,
    "enableDateFilter" BOOLEAN NOT NULL DEFAULT true,
    "defaultDateRange" "DateRangePreset" NOT NULL DEFAULT 'Last30Days',
    "dateFieldName" VARCHAR(100),
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

    CONSTRAINT "DashboardConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardMetric" (
    "id" UUID NOT NULL,
    "microserviceId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "label" VARCHAR(200),
    "description" TEXT,
    "queryConfig" JSONB NOT NULL,
    "outputType" "MetricOutputType" NOT NULL DEFAULT 'Number',
    "cacheDurationMins" INTEGER DEFAULT 5,
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

    CONSTRAINT "DashboardMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardWidget" (
    "id" UUID NOT NULL,
    "dashboardConfigId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "widgetType" "WidgetType" NOT NULL,
    "size" "WidgetSize" NOT NULL DEFAULT 'Medium',
    "gridColumn" INTEGER NOT NULL DEFAULT 1,
    "gridRow" INTEGER NOT NULL DEFAULT 1,
    "modelId" UUID,
    "metricId" UUID,
    "aggregationType" "AggregationType",
    "aggregateFieldId" UUID,
    "groupByFieldId" UUID,
    "showTrend" BOOLEAN NOT NULL DEFAULT false,
    "trendComparisonDays" INTEGER DEFAULT 7,
    "order" DOUBLE PRECISION,
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

    CONSTRAINT "DashboardWidget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardFilter" (
    "id" UUID NOT NULL,
    "dashboardConfigId" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "fieldId" UUID NOT NULL,
    "label" VARCHAR(200),
    "placeholder" VARCHAR(200),
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" JSONB,
    "order" DOUBLE PRECISION,
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

    CONSTRAINT "DashboardFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WidgetDateConfig" (
    "id" UUID NOT NULL,
    "widgetId" UUID NOT NULL,
    "dateFieldId" UUID NOT NULL,
    "defaultRange" "DateRangePreset" NOT NULL DEFAULT 'Last30Days',
    "ignoreGlobalFilter" BOOLEAN NOT NULL DEFAULT false,
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

    CONSTRAINT "WidgetDateConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DashboardConfig_microserviceId_key" ON "DashboardConfig"("microserviceId");

-- CreateIndex
CREATE INDEX "DashboardConfig_microserviceId_idx" ON "DashboardConfig"("microserviceId");

-- CreateIndex
CREATE INDEX "DashboardConfig_client_idx" ON "DashboardConfig"("client");

-- CreateIndex
CREATE INDEX "DashboardConfig_deleted_idx" ON "DashboardConfig"("deleted");

-- CreateIndex
CREATE INDEX "DashboardMetric_microserviceId_idx" ON "DashboardMetric"("microserviceId");

-- CreateIndex
CREATE INDEX "DashboardMetric_name_idx" ON "DashboardMetric"("name");

-- CreateIndex
CREATE INDEX "DashboardMetric_client_idx" ON "DashboardMetric"("client");

-- CreateIndex
CREATE INDEX "DashboardMetric_deleted_idx" ON "DashboardMetric"("deleted");

-- CreateIndex
CREATE INDEX "DashboardWidget_dashboardConfigId_idx" ON "DashboardWidget"("dashboardConfigId");

-- CreateIndex
CREATE INDEX "DashboardWidget_modelId_idx" ON "DashboardWidget"("modelId");

-- CreateIndex
CREATE INDEX "DashboardWidget_metricId_idx" ON "DashboardWidget"("metricId");

-- CreateIndex
CREATE INDEX "DashboardWidget_gridRow_gridColumn_idx" ON "DashboardWidget"("gridRow", "gridColumn");

-- CreateIndex
CREATE INDEX "DashboardWidget_client_idx" ON "DashboardWidget"("client");

-- CreateIndex
CREATE INDEX "DashboardWidget_deleted_idx" ON "DashboardWidget"("deleted");

-- CreateIndex
CREATE INDEX "DashboardFilter_dashboardConfigId_idx" ON "DashboardFilter"("dashboardConfigId");

-- CreateIndex
CREATE INDEX "DashboardFilter_modelId_idx" ON "DashboardFilter"("modelId");

-- CreateIndex
CREATE INDEX "DashboardFilter_fieldId_idx" ON "DashboardFilter"("fieldId");

-- CreateIndex
CREATE INDEX "DashboardFilter_client_idx" ON "DashboardFilter"("client");

-- CreateIndex
CREATE INDEX "DashboardFilter_deleted_idx" ON "DashboardFilter"("deleted");

-- CreateIndex
CREATE UNIQUE INDEX "WidgetDateConfig_widgetId_key" ON "WidgetDateConfig"("widgetId");

-- CreateIndex
CREATE INDEX "WidgetDateConfig_widgetId_idx" ON "WidgetDateConfig"("widgetId");

-- CreateIndex
CREATE INDEX "WidgetDateConfig_dateFieldId_idx" ON "WidgetDateConfig"("dateFieldId");

-- CreateIndex
CREATE INDEX "WidgetDateConfig_client_idx" ON "WidgetDateConfig"("client");

-- CreateIndex
CREATE INDEX "WidgetDateConfig_deleted_idx" ON "WidgetDateConfig"("deleted");

-- AddForeignKey
ALTER TABLE "DashboardConfig" ADD CONSTRAINT "DashboardConfig_microserviceId_fkey" FOREIGN KEY ("microserviceId") REFERENCES "Microservice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardMetric" ADD CONSTRAINT "DashboardMetric_microserviceId_fkey" FOREIGN KEY ("microserviceId") REFERENCES "Microservice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_dashboardConfigId_fkey" FOREIGN KEY ("dashboardConfigId") REFERENCES "DashboardConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "DashboardMetric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_aggregateFieldId_fkey" FOREIGN KEY ("aggregateFieldId") REFERENCES "FieldDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_groupByFieldId_fkey" FOREIGN KEY ("groupByFieldId") REFERENCES "FieldDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardFilter" ADD CONSTRAINT "DashboardFilter_dashboardConfigId_fkey" FOREIGN KEY ("dashboardConfigId") REFERENCES "DashboardConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardFilter" ADD CONSTRAINT "DashboardFilter_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelDefn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardFilter" ADD CONSTRAINT "DashboardFilter_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FieldDefn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetDateConfig" ADD CONSTRAINT "WidgetDateConfig_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "DashboardWidget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetDateConfig" ADD CONSTRAINT "WidgetDateConfig_dateFieldId_fkey" FOREIGN KEY ("dateFieldId") REFERENCES "FieldDefn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
