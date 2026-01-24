const HOST = process.env.NEXT_PUBLIC_@gen{MS_NAME_UPPER}_HOST;

export const @gen{MS_NAME_CAMEL}Routes = {
  getImportURL: ({ query = '' } = {}) => `${HOST}/api/v1/imports/${query}`,
  getExportURL: ({ query = '' } = {}) => `${HOST}/api/v1/exports/${query}`,
  // @gen:ROUTE_ENTRIES
} as const;

export type @gen{MS_NAME_PASCAL}Routes = typeof @gen{MS_NAME_CAMEL}Routes;
