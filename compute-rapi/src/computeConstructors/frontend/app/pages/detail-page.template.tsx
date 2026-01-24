import withProtectedV2 from '@ps/shared-core/config/withProtectedV2';
import { @gen{MODEL_NAME|Pascal}DetailCore } from '@/core/pages/@gen{MODEL_NAME|kebab}';
import { @gen{MODEL_NAME|Pascal}Detail as @gen{MODEL_NAME|Pascal}DetailForm } from '@ps/entity-core/@gen{MICROSERVICE_SLUG}';

export const getServerSideProps = withProtectedV2(async () => {
  return {
    props: {},
  };
});

export default function @gen{MODEL_NAME|Pascal}Detail() {
  return (
    <@gen{MODEL_NAME|Pascal}DetailCore
      DetailFormComponent={@gen{MODEL_NAME|Pascal}DetailForm}
    />
  );
}
