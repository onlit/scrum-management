import React from 'react';
import withProtectedV2 from '@ps/shared-core/config/withProtectedV2';
import { Typography, Box, Grid2 } from '@mui/material';
import FunnelChart, { IFunnelChart } from '@ps/shared-core/ui/FunnelChart';
import PageTitle from '@ps/shared-core/ui/PageTitle';

export const getServerSideProps = withProtectedV2(async () => {
  return {
    props: {},
  };
});

const charts: IFunnelChart[] = [
  // @gen:CHARTS_DATA
];

export default function Dashboard() {
  return (
    <Box>
      <PageTitle title='Dashboard' />
      <Typography
        sx={{
          fontWeight: '600',
          fontSize: '1.6rem',
        }}
      >
        Dashboard
      </Typography>

      <Grid2 container spacing={9} sx={{ pt: '16px' }}>
        {charts
          .filter(({ label, host, slug }) => label && host && slug)
          .map(({ label, host, slug }) => (
            <Grid2 key={slug} size={6}>
              <FunnelChart label={label} host={host} slug={slug} />
            </Grid2>
          ))}
      </Grid2>
    </Box>
  );
}
