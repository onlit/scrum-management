const { getDisplayValueField, DISPLAY_VALUE_PROP } = require('#utils/api/commonUtils.js');

describe('getDisplayValueField', () => {
  test('should return the standard display value property', () => {
    const result = getDisplayValueField();

    expect(result).toEqual({
      displayValueField: DISPLAY_VALUE_PROP,
      type: 'String',
    });
  });

  test('should return __displayValue as the field name', () => {
    const result = getDisplayValueField();

    expect(result.displayValueField).toBe('__displayValue');
    expect(result.type).toBe('String');
  });

  test('should work with any arguments (function ignores parameters)', () => {
    const foreignKeyModel = {
      name: 'Person',
      displayValue: {
        name: 'firstName',
        dataType: 'String',
        isForeignKey: false,
      },
    };

    const result = getDisplayValueField(foreignKeyModel, [], {});

    expect(result).toEqual({
      displayValueField: DISPLAY_VALUE_PROP,
      type: 'String',
    });
  });
});
