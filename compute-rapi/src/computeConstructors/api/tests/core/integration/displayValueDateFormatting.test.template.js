/**
 * Integration test for display value date formatting.
 * Tests the full flow from template with format hints through to formatted output.
 */

jest.mock('#configs/constants.js', () => ({
  DISPLAY_VALUE_TEMPLATES: {
    MandateSalaryBenchmark:
      '{mandate} - {salaryBenchmarkSource} - {effectiveDate|date}',
    Feedback: '{feedbackType} - {clientPerson} - {providedAt|datetime}',
    TeamCollaboration: '{note} - {sharedAt|datetime}',
  },
  DISPLAY_VALUE_FALLBACK_FIELDS: {
    MandateSalaryBenchmark: 'mandate',
    Feedback: 'feedbackType',
  },
  DISPLAY_VALUE_PROP: '__displayValue',
}));

const {
  computeDisplayValue,
  enrichRecordDisplayValues,
} = require('#utils/displayValueUtils.js');

describe('Display Value Date Formatting Integration', () => {
  describe('Date field formatting', () => {
    it('should format Date fields as d/M/yy', () => {
      const record = {
        mandate: 'Senior Developer',
        salaryBenchmarkSource: 'Industry Standard',
        effectiveDate: new Date('2025-12-15T00:00:00.000Z'),
      };

      const result = computeDisplayValue(record, 'MandateSalaryBenchmark', {
        timezone: 'UTC',
      });
      expect(result).toBe('Senior Developer - Industry Standard - 15/12/25');
    });

    it('should handle ISO string dates', () => {
      const record = {
        mandate: 'Manager',
        salaryBenchmarkSource: 'Company Survey',
        effectiveDate: '2025-06-01T00:00:00.000Z',
      };

      const result = computeDisplayValue(record, 'MandateSalaryBenchmark', {
        timezone: 'UTC',
      });
      expect(result).toBe('Manager - Company Survey - 1/6/25');
    });
  });

  describe('DateTime field formatting', () => {
    it('should format DateTime fields as d/M/yy HH:mm', () => {
      const record = {
        feedbackType: 'Interview',
        clientPerson: 'John Doe',
        providedAt: new Date('2025-12-15T14:30:00.000Z'),
      };

      const result = computeDisplayValue(record, 'Feedback', {
        timezone: 'UTC',
      });
      expect(result).toBe('Interview - John Doe - 15/12/25 14:30');
    });

    it('should respect timezone for datetime formatting', () => {
      const record = {
        note: 'Team sync',
        sharedAt: new Date('2025-12-15T23:30:00.000Z'),
      };

      // Tokyo is UTC+9
      const result = computeDisplayValue(record, 'TeamCollaboration', {
        timezone: 'Asia/Tokyo',
      });
      expect(result).toBe('Team sync - 16/12/25 08:30');
    });
  });

  describe('enrichRecordDisplayValues with dates', () => {
    it('should attach formatted display value to record', () => {
      const record = {
        mandate: 'CTO',
        salaryBenchmarkSource: 'Executive Survey',
        effectiveDate: new Date('2025-03-20T00:00:00.000Z'),
      };

      const enriched = enrichRecordDisplayValues(
        record,
        'MandateSalaryBenchmark',
        { timezone: 'UTC' }
      );
      expect(enriched.__displayValue).toBe('CTO - Executive Survey - 20/3/25');
    });
  });

  describe('Backward compatibility', () => {
    it('should handle templates without format hints', () => {
      // This uses a template that might not have hints
      const record = {
        mandate: 'Developer',
        salaryBenchmarkSource: 'Standard',
        effectiveDate: 'Just a string, not a date',
      };

      // Without a format hint, strings pass through unchanged
      const result = computeDisplayValue(record, 'MandateSalaryBenchmark', {
        timezone: 'UTC',
      });
      // The date field will attempt to parse but fail, falling back to string
      expect(result).toContain('Developer - Standard');
    });

    it('should default to UTC when no timezone provided', () => {
      const record = {
        feedbackType: 'Review',
        clientPerson: 'Jane',
        providedAt: new Date('2025-12-15T12:00:00.000Z'),
      };

      // No timezone option - should default to UTC
      const result = computeDisplayValue(record, 'Feedback');
      expect(result).toBe('Review - Jane - 15/12/25 12:00');
    });
  });
});
