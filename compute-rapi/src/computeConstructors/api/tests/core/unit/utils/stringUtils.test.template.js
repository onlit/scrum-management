const {
  parseTemplateKey,
  formatDateForDisplay,
  interpolateTemplate,
  FORMAT_HINTS,
} = require('#utils/stringUtils.js');

describe('parseTemplateKey', () => {
  it('should parse key without format hint', () => {
    const result = parseTemplateKey('effectiveDate');
    expect(result).toEqual({ field: 'effectiveDate', formatHint: null });
  });

  it('should parse key with date format hint', () => {
    const result = parseTemplateKey('effectiveDate|date');
    expect(result).toEqual({ field: 'effectiveDate', formatHint: 'date' });
  });

  it('should parse key with datetime format hint', () => {
    const result = parseTemplateKey('providedAt|datetime');
    expect(result).toEqual({ field: 'providedAt', formatHint: 'datetime' });
  });

  it('should ignore invalid format hints', () => {
    const result = parseTemplateKey('field|invalid');
    expect(result).toEqual({ field: 'field', formatHint: null });
  });

  it('should handle whitespace around pipe', () => {
    const result = parseTemplateKey(' effectiveDate | date ');
    expect(result).toEqual({ field: 'effectiveDate', formatHint: 'date' });
  });
});

describe('formatDateForDisplay', () => {
  it('should format date as d/M/yy in UTC', () => {
    const date = new Date('2025-12-15T00:00:00.000Z');
    const result = formatDateForDisplay(date, 'date', 'UTC');
    expect(result).toBe('15/12/25');
  });

  it('should format datetime as d/M/yy HH:mm in UTC', () => {
    const date = new Date('2025-12-15T14:30:00.000Z');
    const result = formatDateForDisplay(date, 'datetime', 'UTC');
    expect(result).toBe('15/12/25 14:30');
  });

  it('should handle timezone conversion', () => {
    const date = new Date('2025-12-15T23:30:00.000Z');
    const result = formatDateForDisplay(date, 'datetime', 'Asia/Tokyo');
    // Tokyo is UTC+9, so 23:30 UTC = 08:30 next day in Tokyo
    expect(result).toBe('16/12/25 08:30');
  });

  it('should default to UTC when timezone is not provided', () => {
    const date = new Date('2025-12-15T14:30:00.000Z');
    const result = formatDateForDisplay(date, 'datetime');
    expect(result).toBe('15/12/25 14:30');
  });

  it('should return empty string for null/undefined', () => {
    expect(formatDateForDisplay(null, 'date')).toBe('');
    expect(formatDateForDisplay(undefined, 'date')).toBe('');
  });

  it('should parse ISO string dates', () => {
    const result = formatDateForDisplay(
      '2025-12-15T14:30:00.000Z',
      'datetime',
      'UTC'
    );
    expect(result).toBe('15/12/25 14:30');
  });
});

describe('interpolateTemplate with format hints', () => {
  it('should format date field with |date hint', () => {
    const template = '{name} - {effectiveDate|date}';
    const record = {
      name: 'Test',
      effectiveDate: new Date('2025-12-15T00:00:00.000Z'),
    };
    const result = interpolateTemplate(template, record, { timezone: 'UTC' });
    expect(result).toBe('Test - 15/12/25');
  });

  it('should format datetime field with |datetime hint', () => {
    const template = '{name} - {providedAt|datetime}';
    const record = {
      name: 'Test',
      providedAt: new Date('2025-12-15T14:30:00.000Z'),
    };
    const result = interpolateTemplate(template, record, { timezone: 'UTC' });
    expect(result).toBe('Test - 15/12/25 14:30');
  });

  it('should leave fields without hints unchanged', () => {
    const template = '{name} - {description}';
    const record = {
      name: 'Test',
      description: 'Some description',
    };
    const result = interpolateTemplate(template, record);
    expect(result).toBe('Test - Some description');
  });

  it('should handle mixed hints in same template', () => {
    const template =
      '{title} from {startDate|date} to {endDate|date} at {createdAt|datetime}';
    const record = {
      title: 'Event',
      startDate: new Date('2025-12-15T00:00:00.000Z'),
      endDate: new Date('2025-12-20T00:00:00.000Z'),
      createdAt: new Date('2025-12-10T09:15:00.000Z'),
    };
    const result = interpolateTemplate(template, record, { timezone: 'UTC' });
    expect(result).toBe('Event from 15/12/25 to 20/12/25 at 10/12/25 09:15');
  });
});
