/* Minimal assertions around the canonical display value property */

const { DISPLAY_VALUE_PROP } = require('../utils/api/commonUtils.js');

describe('__displayValue constant', () => {
  test('should equal the reserved prop name', () => {
    expect(DISPLAY_VALUE_PROP).toBe('__displayValue');
  });
});
