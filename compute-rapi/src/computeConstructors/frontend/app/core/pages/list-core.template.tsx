'use client';

import React, { ReactNode } from 'react';
import DataTableV2 from '@ps/shared-core/ui/DataTableV2';
import PageTitle from '@ps/shared-core/ui/PageTitle';
import { getRoute } from '@ps/entity-core/routes';
import { ColumnConfig } from '@ps/shared-core/ui/DataTableV2/TableColumns';

export interface BulkAction {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: (ctx: { selectedIds: string[]; searchTerm: string }) => void;
}

export interface @gen{MODEL_NAME|Pascal}ListCoreProps {
  CreateFormComponent: React.ComponentType<any>;
  columns: ColumnConfig[];
  renderRow: (row: any) => any;
  additionalBulkActions?: BulkAction[];
  children?: ReactNode;
}

export function @gen{MODEL_NAME|Pascal}ListCore({
  CreateFormComponent,
  columns,
  renderRow,
  additionalBulkActions = [],
  children,
}: @gen{MODEL_NAME|Pascal}ListCoreProps) {
  return (
    <>
      <PageTitle title={`@gen{MODEL_LABEL}`} />

      {children}

      <DataTableV2
        title={`@gen{MODEL_LABEL}`}
        helpfulHint={`@gen{MODEL_HINT}`}
        queryKey={['@gen{MODEL_NAME|camel}ListPage']}
        recordUrl={getRoute('@gen{MICROSERVICE_SLUG}/get@gen{MODEL_NAME|Pascal}URL')}
        CreateFormComponent={CreateFormComponent}
        columns={columns}
        renderRow={renderRow}
        importExportUrls={{
          import: getRoute('@gen{MICROSERVICE_SLUG}/getImportURL')({ query: '@gen{MODEL_NAME|camel}' }),
          export: getRoute('@gen{MICROSERVICE_SLUG}/getExportURL')({ query: '@gen{MODEL_NAME|camel}' }),
        }}
        importModel={`@gen{MODEL_NAME|camel}`}
        enableBulkVisibility={true}
        enableColorPicker={true}
        bulkActions={additionalBulkActions}
      />
    </>
  );
}

export default @gen{MODEL_NAME|Pascal}ListCore;
