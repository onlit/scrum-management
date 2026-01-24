import { parseBackendDateTime } from '@ps/shared-core/config/dateUtils';

const renderRow = (row: any) => ({
  id: row?.id,
  // @gen:KEYS
  color: row?.color,
  updatedAt: parseBackendDateTime(row?.updatedAt),
  createdAt: parseBackendDateTime(row?.createdAt),
});

export default renderRow;
