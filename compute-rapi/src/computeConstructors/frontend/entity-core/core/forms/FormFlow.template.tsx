import { useState } from 'react';
import { toast } from 'react-toastify';
import Accordion from '@ps/shared-core/ui/Accordion';
import { Box } from '@mui/material';
import withProtectedV2 from '@ps/shared-core/config/withProtectedV2';
import NavigationBreadcrumb from '@ps/shared-core/ui/NavigationBreadcrumb';
import { Container } from '@mui/material';
import { Formik, Form, useFormikContext } from 'formik';
import { getFormattedLabelValue } from '@ps/shared-core/config/generalUtils';
import Grid from '@mui/material/Grid2';
import StepNavigation from '@ps/shared-core/ui/StepNavigation';
import useAxios from '@ps/shared-core/hooks/useAxios';
import { getFetcherConfig } from '@ps/shared-core/config/authUtils';
import { useAppSelector } from '@ps/redux-core/hooks';
import { selectProfile } from '@ps/redux-core/profileSlice';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import * as Yup from 'yup';
import { @gen{MODEL_NAME|camel}DefaultFormValues as defaultFormValues } from '@ps/entity-core/@gen{MICROSERVICE_SLUG}';
import { getRoute } from '@ps/entity-core/routes';
import { getValidationSchema } from '@ps/entity-core/validationSchemas';
// @gen:IMPORTS

// Get validation schema from registry
const @gen{MODEL_NAME|camel}Schema = getValidationSchema('@gen{MICROSERVICE_SLUG}/@gen{MODEL_NAME|camel}');
const validationSchema = Yup.object().shape({
  ...@gen{MODEL_NAME|camel}Schema,
  // @gen:FORM_FLOW_VALIDATION_FIELDS
});

export const getServerSideProps = withProtectedV2(async () => {
  return {
    props: {},
  };
});

// Dependency rules for this model
const dependencyRules: DependencyRule[] = @gen{DEPENDENCY_RULES_JSON};

const @gen{MODEL_NAME_CAMEL_ITEMS} = [
  // @gen:NAVIGATION_ITEMS
];

// Define which fields belong to each step for validation
const stepValidationFields: Record<number, string[]> = {
  // @gen:STEP_VALIDATION_FIELDS
};

export default function @gen{MODEL_NAME_START_CASE_CREATE_FORM_FLOW}() {
  const [currentStep, setCurrentStep] = useState(0);
  const queryClient = useQueryClient();
  const axios = useAxios();
  const { accessToken } = useAppSelector(selectProfile);

  // @gen:STEP_FIELD_COMPONENTS

  const stepFields = [
    // @gen:STEP_FIELDS
  ];

  const mutation = useMutation({
    mutationFn: (@gen{MODEL_NAME_START_CASE_VAR}: object) => {
      return axios.post(
        getRoute('@gen{MICROSERVICE_SLUG}/get@gen{MODEL_NAME|Pascal}URL')(),
        @gen{MODEL_NAME_START_CASE_VAR},
        getFetcherConfig({ token: accessToken })
      );
    },
  });

  // Function to move to the previous step
  const goToPreviousStep = () => setCurrentStep((prevStep) => prevStep - 1);

  // Function to move to the next step
  const goToNextStep = () => setCurrentStep((prevStep) => prevStep + 1);

  return (
    <div>
      <NavigationBreadcrumb
        title="Create @gen{MODEL_LABEL}"
        items={@gen{MODEL_NAME_CAMEL_ITEMS}}
      />

      <Formik
        initialValues={defaultFormValues}
        validationSchema={validationSchema}
        onSubmit={async (values, { resetForm, setSubmitting }) => {
          setSubmitting(true);
          try {
            const { @gen{CUSTOM_FIELD_NAMES_DESTRUCTURE} ...rest } = values;

            const payload = {
              ...rest,
              // @gen:CUSTOM_ASSIGNMENTS
            };

            await mutation.mutateAsync(payload);

            resetForm();
            setCurrentStep(-1);
            toast.success('Operation Successful');
          } catch (error) {
            console.log(error);
            toast.error('Failed to save changes');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ isSubmitting }) => (
          <Form noValidate>
            <Container maxWidth={false}>
              {@gen{MODEL_NAME_CAMEL_ITEMS}.map(({ label }, index) => (
                <Accordion
                  key={label}
                  label={label}
                  open={currentStep === index}
                  setOpen={() => setCurrentStep(index)}
                >
                  <Box sx={{ py: 1.5 }}>
                    {stepFields[currentStep]}

                    <StepNavigation
                      currentStep={currentStep}
                      totalSteps={@gen{MODEL_NAME_CAMEL_ITEMS}.length}
                      stepValidationFields={stepValidationFields}
                      goToNextStep={goToNextStep}
                      goToPreviousStep={goToPreviousStep}
                      isSubmitting={isSubmitting}
                    />
                  </Box>
                </Accordion>
              ))}
            </Container>
          </Form>
        )}
      </Formik>
    </div>
  );
}
