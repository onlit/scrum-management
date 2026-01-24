import React, { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { toast } from 'react-toastify';
import withProtectedV2 from '@ps/shared-core/config/withProtectedV2';
import { @gen{MODEL_NAME|Pascal}ListCore } from '@/core/pages/@gen{MODEL_NAME|kebab}';
import {
  @gen{MODEL_NAME|Pascal}Create,
  @gen{MODEL_NAME|camel}Columns,
  @gen{MODEL_NAME|camel}DataMapper,
} from '@ps/entity-core/@gen{MICROSERVICE_SLUG}';
import BulkAddReminder from '@ps/entity-core/calendar/forms/BulkAddReminder/BulkAddReminder';
import {
  REMINDER_ENTITY_MICROSERVICES,
  REMINDER_ENTITY_MODELS,
} from '@ps/shared-core/config/apps/calendar/constants';

export const getServerSideProps = withProtectedV2(async () => {
  return {
    props: {},
  };
});

export default function @gen{MODEL_NAME|Pascal}List() {
  const [bulkReminderOpen, setBulkReminderOpen] = useState(false);
  const [bulkCtx, setBulkCtx] = useState<{ ids: string[]; search: string }>({
    ids: [],
    search: '',
  });

  return (
    <@gen{MODEL_NAME|Pascal}ListCore
      CreateFormComponent={@gen{MODEL_NAME|Pascal}Create}
      columns={@gen{MODEL_NAME|camel}Columns}
      renderRow={@gen{MODEL_NAME|camel}DataMapper}
      additionalBulkActions={[
        {
          key: 'addReminder',
          label: 'Add reminder',
          icon: <CalendarPlus size={14} style={{ marginRight: 8 }} />,
          onClick: ({ selectedIds, searchTerm }) => {
            setBulkCtx({ ids: selectedIds, search: searchTerm });
            setBulkReminderOpen(true);
          },
        },
      ]}
    >
      <BulkAddReminder
        entityMicroservice={REMINDER_ENTITY_MICROSERVICES.@gen{MICROSERVICE_NAME}}
        entityModel={REMINDER_ENTITY_MODELS.@gen{MODEL_NAME}}
        open={bulkReminderOpen}
        setOpen={setBulkReminderOpen}
        selectedIds={bulkCtx.ids}
        searchTerm={bulkCtx.search}
        onSuccess={() => {
          toast.success('Reminder(s) created');
        }}
      />
    </@gen{MODEL_NAME|Pascal}ListCore>
  );
}
