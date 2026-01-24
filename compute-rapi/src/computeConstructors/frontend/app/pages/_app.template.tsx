import React, { useMemo } from 'react';
import Head from 'next/head';
import { AppProps } from 'next/app';
import { Provider } from 'react-redux';
import { AppCacheProvider } from '@mui/material-nextjs/v15-pagesRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getThemeByLocale } from '@ps/shared-core/config/theme';
import AdminLayout, {
  DrawerRouteUrls,
  UserAccountMenuRouteUrls,
} from '@ps/shared-core/ui/AdminLayout';
import { getRoute } from '@ps/entity-core/routes';
import { useRouter } from 'next/router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureReduxCore } from '@ps/redux-core/config';
import { store } from '@ps/redux-core/store';
import { ToastContainer, ToastContainerProps } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  ADMIN_LOGO,
  COLORS,
  LOCAL_COOKIE_NAME,
  DEFAULT_QUERY_CLIENT_OPTIONS,
  TOAST_CONTAINER_PROPS,
} from '@ps/shared-core/config/constants';
import { fetchTranslations } from '@ps/shared-core/config/translationUtils';
import { Box, CircularProgress } from '@mui/material';
import useAuth from '@ps/shared-core/hooks/useAuth';
import { fontClasses } from '@ps/shared-core/config/fonts';
import { useAppSelector } from '@ps/redux-core/hooks';
import { useRouteProgress } from '@ps/shared-core/hooks/useRouteProgress';
import TopRouteProgressBar from '@ps/shared-core/ui/TopRouteProgressBar';
import { AppConfigProvider } from '@ps/shared-core/ui/AppConfigContext';
import { selectLanguage } from '@ps/redux-core/languageSlice';
import { selectProfile } from '@ps/redux-core/profileSlice';

// Configure redux-core before store is used
configureReduxCore({
  adminLogo: ADMIN_LOGO,
  brandColor: COLORS.primary,
  localeCookieName: LOCAL_COOKIE_NAME,
  fetchTranslations,
  getTranslationsApiUrl: (langCode: string, namespace: string) =>
    getRoute('compute/getTranslationsByLangCodeURL')({ langCode, namespace }),
});

const APP_NAME = '@gen{APP_NAME}';

const noAdminLayoutRoutes = ['/404'];

// Route URLs for AdminLayout components (dependency injection to avoid circular imports)
const drawerRouteUrls: DrawerRouteUrls = {
  booksUrl: getRoute('wiki/getBooksURL')(),
  chaptersUrl: getRoute('wiki/getChaptersURL')(),
  calendarAccountsUrl: getRoute('calendar/getCalendarAccountsURL')(),
  imapAccountsUrl: getRoute('communication/getImapAccountsURL')(),
};

const drawerMenusUrl = getRoute('system-django/getUserDrawMenusURL')();

const userAccountMenuRouteUrls: UserAccountMenuRouteUrls = {
  languagesUrl: getRoute('compute/getLanguageURL')(),
  requestDaysOffUrls: {
    dayOffUrl: getRoute('hr/getDayOffURL')(),
    dayOffTypeUrl: getRoute('hr/getDayOffTypeURL'),
  },
};

const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_OPTIONS);

function App(props: AppProps) {
  const router = useRouter();
  const { isRouteLoading, routeProgress } = useRouteProgress();
  const locale = useAppSelector(selectLanguage);
  const { favicon, adminLogo } = useAppSelector(selectProfile);

  const { Component, pageProps } = props;
  const { isProtected, domain } = pageProps;

  const theme = useMemo(() => getThemeByLocale(locale.currentLocale), [locale]);

  const useAdminLayout = !noAdminLayoutRoutes.includes(router.pathname);
  const { isUserInfoInitialized } = useAuth(domain, isProtected);

  const isLoading = !isUserInfoInitialized && isProtected;

  return (
    <AppCacheProvider {...props}>
      <Head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
        {favicon && <link rel="icon" href={`${favicon}?obi=true`} />}
        <title>{`${APP_NAME} | ${adminLogo || 'Admin'}`}</title>
      </Head>
      <div className={fontClasses}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <TopRouteProgressBar
            isActive={isRouteLoading}
            progress={routeProgress}
          />
          {isLoading ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                textAlign: 'center',
              }}
            >
              <Box>
                <CircularProgress />
              </Box>
            </Box>
          ) : (
            <QueryClientProvider client={queryClient}>
              <AppConfigProvider appName={APP_NAME}>
                {useAdminLayout ? (
                  <AdminLayout
                    drawerRouteUrls={drawerRouteUrls}
                    userAccountMenuRouteUrls={userAccountMenuRouteUrls}
                    drawerMenusUrl={drawerMenusUrl}
                  >
                    <Component {...pageProps} />
                  </AdminLayout>
                ) : (
                  <Component {...pageProps} />
                )}
                <ToastContainer
                  {...(TOAST_CONTAINER_PROPS as ToastContainerProps)}
                />
              </AppConfigProvider>
            </QueryClientProvider>
          )}
        </ThemeProvider>
      </div>
    </AppCacheProvider>
  );
}

export default function AppWrapper(props: AppProps) {
  return (
    <Provider store={store}>
      <App {...props} />
    </Provider>
  );
}
