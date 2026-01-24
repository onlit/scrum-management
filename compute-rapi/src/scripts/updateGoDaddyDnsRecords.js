const axios = require('axios');
const { convertToSlug } = require('#utils/shared/stringUtils.js');
const setupKubernetesIngress = require('#scripts/setupKubernetesIngress.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');

const updateDNSRecords = withErrorHandling(
  async ({ msName, microserviceId, user, traceId = null }) => {
    const url = 'https://api.godaddy.com/v1/domains/pullstream.com/records';
    const subdomainIP = '140.228.72.7';
    const slug = convertToSlug(msName);
    const payload = [
      { type: 'A', name: `sandbox.${slug}`, data: subdomainIP, ttl: 600 },
      // { type: 'A', name: `${slug}.staging`, data: subdomainIP, ttl: 600 },
      { type: 'A', name: slug, data: subdomainIP, ttl: 600 },
    ];
    if (!process.env.GODADDY_API_KEY) {
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Missing GODADDY_API_KEY environment variable',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'update_dns_records_env',
          details: { traceId },
        }
      );
    }
    const apiKey = process.env.GODADDY_API_KEY.trim();
    const headers = {
      Authorization: `sso-key ${apiKey}`,
      'Content-Type': 'application/json',
    };
    try {
      const response = await axios.patch(url, payload, { headers });
      logWithTrace(
        'DNS Records updated successfully',
        { traceId },
        { response: response.data }
      );
      setTimeout(async () => {
        await setupKubernetesIngress({
          microserviceSlug: slug,
          microserviceId,
          user,
          traceId,
        });
      }, 100000);
    } catch (error) {
      const errorCode = error?.response?.data?.code;
      if (errorCode === 'DUPLICATE_RECORD') {
        logWithTrace('Duplicate record error treated as success', { traceId });
        setTimeout(async () => {
          await setupKubernetesIngress({
            microserviceSlug: slug,
            microserviceId,
            user,
            traceId,
          });
        }, 100000);
      } else {
        logWithTrace(
          'Error updating DNS Records',
          { traceId },
          { error: error?.response?.data ?? error?.message }
        );
        throw createStandardError(
          ERROR_TYPES.INTERNAL,
          'Error updating DNS Records',
          {
            severity: ERROR_SEVERITY.HIGH,
            context: 'update_dns_records',
            details: {
              traceId,
              error: error?.response?.data ?? error?.message,
            },
            originalError: error,
          }
        );
      }
    }
  },
  'update_dns_records'
);

module.exports = updateDNSRecords;
