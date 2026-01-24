jest.mock('#configs/constants.js', () => ({
  DISPLAY_VALUE_TEMPLATES: {
    TestModel: '{name} - {effectiveDate|date}',
    TestModelDateTime: '{name} - {createdAt|datetime}',
  },
  DISPLAY_VALUE_FALLBACK_FIELDS: {
    TestModel: 'name',
    DateTimeFallbackModel: 'classificationTimestamp',
    DateTimeFallbackModelWithOffset: 'updatedAt',
  },
  DISPLAY_VALUE_PROP: '__displayValue',
}));

const {
  computeDisplayValue,
  enrichRecordDisplayValues,
  attachNestedDisplayValues,
} = require('#utils/displayValueUtils.js');

describe('computeDisplayValue with timezone', () => {
  it('should format date fields using provided timezone', () => {
    const record = {
      name: 'Test',
      effectiveDate: new Date('2025-12-15T00:00:00.000Z'),
    };
    const result = computeDisplayValue(record, 'TestModel', {
      timezone: 'UTC',
    });
    expect(result).toBe('Test - 15/12/25');
  });

  it('should format datetime fields using provided timezone', () => {
    const record = {
      name: 'Test',
      createdAt: new Date('2025-12-15T14:30:00.000Z'),
    };
    const result = computeDisplayValue(record, 'TestModelDateTime', {
      timezone: 'UTC',
    });
    expect(result).toBe('Test - 15/12/25 14:30');
  });
});

describe('enrichRecordDisplayValues with timezone', () => {
  it('should pass timezone to nested computeDisplayValue calls', () => {
    const record = {
      name: 'Test',
      effectiveDate: new Date('2025-12-15T00:00:00.000Z'),
    };
    const result = enrichRecordDisplayValues(record, 'TestModel', {
      timezone: 'UTC',
    });
    expect(result.__displayValue).toBe('Test - 15/12/25');
  });
});

describe('computeDisplayValue with ISO datetime fallback fields', () => {
  it('should format ISO datetime string fallback with UTC timezone', () => {
    const record = {
      classificationTimestamp: '2026-01-19T09:27:29.000Z',
    };
    const result = computeDisplayValue(record, 'DateTimeFallbackModel', {
      timezone: 'UTC',
    });
    expect(result).toBe('19/1/26 09:27');
  });

  it('should format ISO datetime string fallback with user timezone', () => {
    const record = {
      classificationTimestamp: '2026-01-19T09:27:29.000Z',
    };
    const result = computeDisplayValue(record, 'DateTimeFallbackModel', {
      timezone: 'Asia/Kolkata',
    });
    // UTC 09:27 + 5:30 = 14:57 IST
    expect(result).toBe('19/1/26 14:57');
  });

  it('should format ISO datetime string with timezone offset', () => {
    const record = {
      updatedAt: '2026-01-19T14:57:29+05:30',
    };
    const result = computeDisplayValue(record, 'DateTimeFallbackModelWithOffset', {
      timezone: 'UTC',
    });
    // 14:57 IST - 5:30 = 09:27 UTC
    expect(result).toBe('19/1/26 09:27');
  });

  it('should return non-date strings as-is', () => {
    const record = {
      classificationTimestamp: 'not-a-date',
    };
    const result = computeDisplayValue(record, 'DateTimeFallbackModel', {
      timezone: 'UTC',
    });
    expect(result).toBe('not-a-date');
  });

  it('should return UUID strings as-is (not mistaken for dates)', () => {
    const record = {
      classificationTimestamp: 'f65b7e59-3733-4122-992f-1e38c887761c',
    };
    const result = computeDisplayValue(record, 'DateTimeFallbackModel', {
      timezone: 'UTC',
    });
    expect(result).toBe('f65b7e59-3733-4122-992f-1e38c887761c');
  });
});
