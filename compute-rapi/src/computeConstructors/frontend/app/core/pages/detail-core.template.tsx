'use client';

import React, { ReactNode, useMemo, useState } from 'react';
import Grid from '@mui/material/Grid2';
import { useRouter } from 'next/router';
import { Box } from '@mui/material';
import { CalendarPlus } from 'lucide-react';
import { toast } from 'react-toastify';
import useAxios from '@ps/shared-core/hooks/useAxios';
import DetailCard from '@ps/shared-core/ui/DetailCard';
import DataTableV2 from '@ps/shared-core/ui/DataTableV2';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFetcherConfig } from '@ps/shared-core/config/authUtils';
import { useAppSelector } from '@ps/redux-core/hooks';
import { selectProfile } from '@ps/redux-core/profileSlice';
import { getRoute } from '@ps/entity-core/routes';
import ScrollableTabs from '@ps/shared-core/ui/ScrollableTabs';
import PageHeader from '@ps/shared-core/ui/PageHeader';
import ErrorPage from '@ps/shared-core/ui/ErrorPage';
import PageTitle from '@ps/shared-core/ui/PageTitle';
import { PrimaryButton } from '@ps/shared-core/ui/Buttons';
import BulkAddReminder from '@ps/entity-core/calendar/forms/BulkAddReminder/BulkAddReminder';
import actionReminderColumns from '@ps/entity-core/calendar/configs/tableColumns/actionReminderColumns';
import actionReminderDataMapper from '@ps/entity-core/calendar/configs/dataMappers/actionReminderDataMapper';
import {
  REMINDER_ENTITY_MICROSERVICES,
  REMINDER_ENTITY_MODELS,
  REMINDER_TYPES,
} from '@ps/shared-core/config/apps/calendar/constants';
// @gen:IMPORTS

export interface TabConfig {
  key: string;
  label: string;
  content: ReactNode;
}

export interface HeaderAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

export interface @gen{MODEL_NAME|Pascal}DetailCoreProps {
  DetailFormComponent: React.ComponentType<any>;
  additionalTabs?: TabConfig[];
  hiddenTabs?: string[];
  additionalHeaderActions?: HeaderAction[];
  children?: ReactNode;
}

export function @gen{MODEL_NAME|Pascal}DetailCore({
  DetailFormComponent,
  additionalTabs = [],
  hiddenTabs = [],
  additionalHeaderActions = [],
  children,
}: @gen{MODEL_NAME|Pascal}DetailCoreProps) {
  const router = useRouter();
  const axios = useAxios();
  const queryClient = useQueryClient();
  const { accessToken } = useAppSelector(selectProfile);

  const recordId = router?.query?.id as string;
  const [inaSearchTerm, setInaSearchTerm] = useState('');
  const [bulkReminderOpen, setBulkReminderOpen] = useState(false);

  const {
    isPending,
    isError,
    data: recordData,
  } = useQuery({
    queryKey: ['@gen{MODEL_NAME|kebab}-detail', recordId],
    queryFn: async () => {
      const { data } = await axios.get(
        getRoute('@gen{MICROSERVICE_SLUG}/get@gen{MODEL_NAME|Pascal}URL')({
          query: String(recordId),
        }),
        getFetcherConfig({ token: accessToken })
      );
      return data;
    },
    enabled: !!accessToken,
  });

  const recordDisplayValue = useMemo(() => {
    if (isError) return 'Error';
    if (!recordData) return '';
    return @gen{DISPLAY_VALUE_PATH};
  }, [recordData, isError]);

  const isBreadcrumbLoading = isPending || (!recordData && !isError);

  const baseTabs: TabConfig[] = useMemo(
    () => [
      {
        key: 'inas',
        label: 'INAs',
        content: (
          <DataTableV2
            alternateStyling
            title=""
            helpfulHint=""
            key="actionRemindersListPage"
            queryKey={['@gen{MODEL_NAME|kebab}-action-reminders-list-page']}
            recordUrl={getRoute('calendar/getActionRemindersURL')}
            columns={actionReminderColumns}
            renderRow={actionReminderDataMapper}
            appendSlashToDetailRequests
            additionalQueryParams={{
              entity_microservice:
                REMINDER_ENTITY_MICROSERVICES.@gen{MICROSERVICE_NAME|UPPER_SNAKE},
              entity: REMINDER_ENTITY_MODELS.@gen{MODEL_NAME|UPPER_SNAKE},
              entity_id: recordId ?? '',
              reminder_type: REMINDER_TYPES.INA,
            }}
            externalSearchState={{
              searchTerm: inaSearchTerm,
              onSearchChange: setInaSearchTerm,
            }}
          />
        ),
      },
      // @gen:RELATED_TABS
    ],
    [@gen{BASETABS_DEPS}]
  );

  const tabs = useMemo(() => {
    const allTabs = [...baseTabs, ...additionalTabs];
    if (hiddenTabs.length === 0) return allTabs;
    return allTabs.filter((tab) => !hiddenTabs.includes(tab.key));
  }, [baseTabs, additionalTabs, hiddenTabs]);

  if (isError) {
    return (
      <ErrorPage
        variant="fetchError"
        title="Failed to load @gen{MODEL_LABEL} Entry"
        description="We couldn't retrieve this @gen{MODEL_LABEL} Entry's information. Please try again or go back to the @gen{MODEL_LABEL} list."
        showHomeButton={false}
        showBackButton
        backHref="/@gen{MODEL_NAME|kebab}"
        backLabel="Back to @gen{MODEL_LABEL}"
      />
    );
  }

  return (
    <Box>
      <PageTitle title={`@gen{MODEL_LABEL}`} />

      <PageHeader
        breadcrumbs={[
          { label: '@gen{MODEL_LABEL}', href: `/@gen{MODEL_NAME|kebab}` },
          { label: recordDisplayValue, isLoading: isBreadcrumbLoading },
        ]}
        actions={
          <>
            <PrimaryButton
              startIcon={<CalendarPlus size={14} />}
              onClick={() => setBulkReminderOpen(true)}
            >
              Add INA
            </PrimaryButton>
            {additionalHeaderActions.map((action, index) => (
              <PrimaryButton
                key={index}
                startIcon={action.icon}
                onClick={action.onClick}
              >
                {action.label}
              </PrimaryButton>
            ))}
          </>
        }
      />

      {children}

      <BulkAddReminder
        entityMicroservice={REMINDER_ENTITY_MICROSERVICES.@gen{MICROSERVICE_NAME|UPPER_SNAKE}}
        entityModel={REMINDER_ENTITY_MODELS.@gen{MODEL_NAME|UPPER_SNAKE}}
        open={bulkReminderOpen}
        setOpen={setBulkReminderOpen}
        entityLabel={recordDisplayValue}
        selectedIds={recordId ? [recordId] : []}
        searchTerm={''}
        onSuccess={() => {
          toast.success('Reminder created');
          queryClient.invalidateQueries({
            queryKey: ['dataTable', '@gen{MODEL_NAME|kebab}-action-reminders-list-page'],
          });
        }}
      />

      <Grid container spacing={3}>
        <Grid size={3.5}>
          <DetailCard
            title={`About this @gen{MODEL_LABEL} Entry`}
            isLoading={isPending}
            FormComponent={() => (
              <DetailFormComponent
                recordData={recordData}
                queryClient={queryClient}
              />
            )}
          />
        </Grid>
        <Grid size={8.5}>
          {tabs?.length > 0 && (
            <ScrollableTabs tabs={tabs} maxHeight="77.5vh" minHeight="77.5vh" />
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

export default @gen{MODEL_NAME|Pascal}DetailCore;
