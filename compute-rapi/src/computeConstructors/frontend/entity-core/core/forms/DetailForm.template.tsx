import * as Yup from 'yup';
import { AxiosError } from 'axios';
import { useDispatch } from 'react-redux';
import { useEffect, useMemo, useState } from 'react';
import { Formik, Form, useFormikContext } from 'formik';
import Grid from '@mui/material/Grid2';
import Box from '@mui/material/Box';
import HelpfulHint from '@ps/shared-core/ui/HelpfulHint';
import FormikAutoSave from '@ps/shared-core/ui/FormikAutoSave';
import { QueryClient, useMutation } from '@tanstack/react-query';
import useAxios from '@ps/shared-core/hooks/useAxios';
import { getFetcherConfig } from '@ps/shared-core/config/authUtils';
import { useAppSelector } from '@ps/redux-core/hooks';
import { selectProfile } from '@ps/redux-core/profileSlice';
import {
  ExecutionStatus,
  setExecutionStatus,
} from '@ps/redux-core/operationSlice';
import { toast } from 'react-toastify';
import { getFormattedLabelValue } from '@ps/shared-core/config/generalUtils';
import { parseBackendDateTime } from '@ps/shared-core/config/dateUtils';
import { getRoute } from '@ps/entity-core/routes';
import { getValidationSchema } from '@ps/entity-core/validationSchemas';

// @gen:IMPORTS

// Get validation schema from registry
const @gen{MODEL_NAME|camel}Schema = getValidationSchema('@gen{MICROSERVICE_SLUG}/@gen{MODEL_NAME|camel}');

interface @gen{MODEL_NAME|Pascal}DetailProps {
  recordData: any;
  queryClient: QueryClient;
}

// Dependency rules for this model
const dependencyRules: DependencyRule[] = @gen{DEPENDENCY_RULES_JSON};

const disabledFields: string[] = [];

// Default form values for extension loading
export const defaultFormValues = {};

// Validation schema object
export const validationSchema = Yup.object().shape(@gen{MODEL_NAME|camel}Schema);

// Extracted form content component to properly use hooks at top level
interface @gen{MODEL_NAME|Pascal}DetailFormContentProps {
  queryClient: QueryClient;
  handleSubmit: () => void;
}

function @gen{MODEL_NAME|Pascal}DetailFormContent({
  queryClient,
  handleSubmit,
}: @gen{MODEL_NAME|Pascal}DetailFormContentProps) {
  const { setFieldValue, values } = useFormikContext<Record<string, any>>();
  const fieldStates = useDependencyRules(values, dependencyRules);

  return (
    <Form noValidate>
      <FormikAutoSave
        debounceDelay={1600}
        saveFunction={() => handleSubmit()}
      />

      <Grid container spacing={3}>
        @gen{DETAIL_PAGE_FIELDS}
        <Grid size={12}>
          <FormikDateTimePickerField
            name='createdAt'
            label='Date Created'
            required
            disabled
          />
        </Grid>
      </Grid>
    </Form>
  );
}

export default function @gen{MODEL_NAME|Pascal}Detail({ recordData, queryClient }: @gen{MODEL_NAME|Pascal}DetailProps) {
  const axios = useAxios();

  const dispatch = useDispatch();

  const { accessToken } = useAppSelector(selectProfile);
  const [isUpdating, setUpdating] = useState<ExecutionStatus>('idle');

  const mutation = useMutation({
    mutationFn: (payload: any) => {
      return axios.patch(
        getRoute("@gen{MICROSERVICE_SLUG}/get@gen{MODEL_NAME|Pascal}URL")({
          query: `${recordData?.id}/`,
        }),
        payload,
        getFetcherConfig({ token: accessToken }),
      );
    },
  });

  const setUpdatingToDone = () => {
    setUpdating('done');
    setTimeout(() => {
      setUpdating('idle');
    }, 3000);
  };

  const resolvedInitialValues = useMemo(
    () => ({
      @gen{DETAIL_PAGE_INITIAL_VALUES}
    }),
    [recordData]
  );

  useEffect(() => {
    dispatch(setExecutionStatus(isUpdating));
  }, [isUpdating, dispatch]);

  return (
    <Formik
      initialValues={resolvedInitialValues}
      validationSchema={validationSchema}
      onSubmit={async (values) => {
        try {
          setUpdating('busy');

          const { @gen{CUSTOM_FIELD_NAMES} ...rest } = values;

          const payload = {
            ...rest,
            // @gen:CUSTOM_ASSIGNMENTS
          };

          await mutation.mutateAsync(payload);

          queryClient.invalidateQueries();
          setUpdatingToDone();
        } catch (error) {
          if (error instanceof AxiosError && error?.response) {
            toast.error(error?.response.data?.message);
          } else {
            toast.error('Failed to save changes');
          }
          setUpdating('failed');
        }
      }}
    >
      {({ handleSubmit }) => (
        <@gen{MODEL_NAME|Pascal}DetailFormContent
          queryClient={queryClient}
          handleSubmit={handleSubmit}
        />
      )}
    </Formik>
  );
}
