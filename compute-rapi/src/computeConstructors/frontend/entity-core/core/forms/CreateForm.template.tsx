import { useMemo } from 'react';
import {
  Box,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography
} from '@mui/material';
import useAxios from '@ps/shared-core/hooks/useAxios';
import { X } from 'lucide-react';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { Formik, Form, useFormikContext } from 'formik';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import { useAppSelector } from '@ps/redux-core/hooks';
import { selectProfile } from '@ps/redux-core/profileSlice';
import { getFetcherConfig } from '@ps/shared-core/config/authUtils';
import Grid from '@mui/material/Grid2';
import HelpfulHintIcon from '@ps/shared-core/ui/HelpfulHintIcon';
import { getFormattedLabelValue } from '@ps/shared-core/config/generalUtils';
import { useFormErrorHandler } from '@ps/shared-core/ui/FormErrorHandler';
import { COLORS } from '@ps/shared-core/config/constants';
import { PrimaryButton, SecondaryButton } from '@ps/shared-core/ui/Buttons';
import { getRoute } from '@ps/entity-core/routes';
import { getValidationSchema } from '@ps/entity-core/validationSchemas';

// @gen:IMPORTS

// Get validation schema from registry
const @gen{MODEL_NAME|camel}Schema = getValidationSchema('@gen{MICROSERVICE_SLUG}/@gen{MODEL_NAME|camel}');

// Dependency rules for this model
const dependencyRules: DependencyRule[] = @gen{DEPENDENCY_RULES_JSON};

// Define the shape of the form values object
export interface @gen{MODEL_NAME|Pascal}CreateFormValues {
  // @gen:FORM_VALUES_INTERFACE
}

// Define the prop types for the @gen{MODEL_NAME|Pascal}Create component
interface @gen{MODEL_NAME|Pascal}CreateProps {
  open: boolean; // Controls whether the dialog is open
  setOpen: (newValue: boolean) => void; // Function to set the open state
  onSave?: (data: any) => void;
  overrideInitialValues: Partial<@gen{MODEL_NAME|Pascal}CreateFormValues>;
  disabledFields?: string[];
  queryClient: QueryClient;
}

const dialogActionStyles = {
  display: 'flex',
  justifyContent: 'center',
  gap: 1.5,
  py: 2,
  backgroundColor: COLORS.backgroundAlt,
};

// Initial values for the form fields
export const defaultFormValues: @gen{MODEL_NAME|Pascal}CreateFormValues = {
  // @gen:FORM_INITIAL_VALUES
};

// Defining the validation schema using Yup for each field in the form
export const validationSchema = Yup.object().shape({
  ...@gen{MODEL_NAME|camel}Schema,
});

// Extracted form content component to properly use hooks at top level
interface @gen{MODEL_NAME|Pascal}CreateFormContentProps {
  disabledFields: string[];
  queryClient: QueryClient;
}

function @gen{MODEL_NAME|Pascal}CreateFormContent({
  disabledFields,
  queryClient,
}: @gen{MODEL_NAME|Pascal}CreateFormContentProps) {
  const { setFieldValue, values } = useFormikContext<@gen{MODEL_NAME|Pascal}CreateFormValues>();
  // Evaluate dependency rules based on current form values
  const fieldStates = useDependencyRules(values, dependencyRules);

  return (
    <Box sx={{ px: 6, py: 4 }}>
      <Grid container spacing={3}>
        @gen{FORM_FIELDS}
      </Grid>
    </Box>
  );
}

function FormActionButtons({ handleClose }: { handleClose: () => void }) {
  const { isSubmitting } = useFormikContext();
  return (
    <DialogActions sx={dialogActionStyles}>
      <SecondaryButton onClick={handleClose}>
        Cancel
      </SecondaryButton>
      <PrimaryButton type='submit' disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save'}
      </PrimaryButton>
    </DialogActions>
  );
}

export default function @gen{MODEL_NAME|Pascal}Create({
  open,
  setOpen,
  onSave,
  overrideInitialValues,
  disabledFields = [],
  queryClient,
}: @gen{MODEL_NAME|Pascal}CreateProps) {
  const axios = useAxios();

  const { accessToken } = useAppSelector(selectProfile);
  const formErrorHandler = useFormErrorHandler();

  const mutation = useMutation({
    mutationFn: (newModel: object) => {
      return axios.post(
        getRoute("@gen{MICROSERVICE_SLUG}/get@gen{MODEL_NAME|Pascal}URL")(),
        newModel,
        getFetcherConfig({ token: accessToken }),
      );
    },
  });

  const resolvedInitialValues = useMemo(() => {
    if (overrideInitialValues) {
      return { ...defaultFormValues, ...overrideInitialValues };
    }

    return defaultFormValues;
  }, [overrideInitialValues]);

  // Function to close the dialog
  const handleClose = () => setOpen(false);

  return (
    <Dialog
      fullWidth
      maxWidth='md'
      open={open}
      PaperProps={{
        sx: {
          borderRadius: '8px',
          boxShadow: COLORS.shadowXl,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#94a3b8',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: '#64748b',
            },
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#f1f5f9',
            borderRadius: '4px',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 2,
          position: 'relative',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            component='span'
            sx={{
              fontWeight: 600,
              fontSize: '1rem',
              color: COLORS.text,
            }}
          >
            New @gen{MODEL_LABEL} Entry
          </Typography>
          <HelpfulHintIcon
            helpfulHint={`...`}
            iconSize={16}
          />
        </Box>
        <IconButton
          aria-label='close'
          onClick={handleClose}
          size='small'
          sx={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: COLORS.textMuted,
            '&:hover': {
              backgroundColor: COLORS.hover,
              color: COLORS.text,
            },
          }}
        >
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <Divider />
      <Formik
        initialValues={resolvedInitialValues}
        validationSchema={validationSchema}
        onSubmit={async (
          values,
          { resetForm, setSubmitting, setErrors, setStatus }
        ) => {
          setSubmitting(true);
          setStatus(undefined); // Clear previous status
          try {
            const { @gen{CUSTOM_FIELD_NAMES} ...rest } = values;

            const payload = {
              ...rest,
              // @gen:CUSTOM_ASSIGNMENTS
            };

            const { data } = await mutation.mutateAsync(payload);

            resetForm();
            setOpen(false);
            if (onSave) onSave(data);
            toast.success('Operation Successful');
          } catch (error) {
            formErrorHandler.handleError(error, { setErrors, setStatus });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form noValidate>
          <DialogContent sx={{ p: 0 }}>
            <@gen{MODEL_NAME|Pascal}CreateFormContent
              disabledFields={disabledFields}
              queryClient={queryClient}
            />
          </DialogContent>
          <FormActionButtons handleClose={handleClose} />
        </Form>
      </Formik>
    </Dialog>
  );
}
