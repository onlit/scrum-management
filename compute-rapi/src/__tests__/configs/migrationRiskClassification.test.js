const {
  SAFE_CONVERSIONS,
  WARNING_CONVERSIONS,
  RISK_CLASSIFICATION,
  isConversionSafe,
  getConversionRisk,
  classifyChange,
} = require('#configs/migrationRiskClassification.js');

describe('migrationRiskClassification', () => {
  describe('SAFE_CONVERSIONS', () => {
    it('should define Int as safely convertible to BigInt, Decimal, Float, String', () => {
      expect(SAFE_CONVERSIONS.Int).toEqual(['BigInt', 'Decimal', 'Float', 'String']);
    });

    it('should define String as safely convertible to Phone, URL, Slug, Email, IPAddress, Text', () => {
      expect(SAFE_CONVERSIONS.String).toContain('Phone');
      expect(SAFE_CONVERSIONS.String).toContain('URL');
      expect(SAFE_CONVERSIONS.String).toContain('Slug');
      expect(SAFE_CONVERSIONS.String).toContain('Email');
      expect(SAFE_CONVERSIONS.String).toContain('IPAddress');
      expect(SAFE_CONVERSIONS.String).toContain('Text');
    });

    it('should define bidirectional conversions for string-based types', () => {
      // Phone, URL, Slug, Email, IPAddress should all be interchangeable
      const stringTypes = ['Phone', 'URL', 'Slug', 'Email', 'IPAddress'];
      for (const fromType of stringTypes) {
        for (const toType of stringTypes) {
          if (fromType !== toType) {
            expect(SAFE_CONVERSIONS[fromType]).toContain(toType);
          }
        }
        // Each should also convert to/from String
        expect(SAFE_CONVERSIONS[fromType]).toContain('String');
      }
    });

    it('should define Text as safely convertible to all string-based types', () => {
      expect(SAFE_CONVERSIONS.Text).toContain('String');
      expect(SAFE_CONVERSIONS.Text).toContain('Phone');
      expect(SAFE_CONVERSIONS.Text).toContain('URL');
    });

    it('should define Float as safely convertible to Decimal, String', () => {
      expect(SAFE_CONVERSIONS.Float).toEqual(['Decimal', 'String']);
    });

    it('should define Boolean as safely convertible to String', () => {
      expect(SAFE_CONVERSIONS.Boolean).toEqual(['String']);
    });
  });

  describe('WARNING_CONVERSIONS', () => {
    it('should define Decimal to Float as warning (precision loss)', () => {
      expect(WARNING_CONVERSIONS.Decimal).toContain('Float');
    });

    it('should define BigInt to Int as warning (overflow possible)', () => {
      expect(WARNING_CONVERSIONS.BigInt).toContain('Int');
    });

    it('should define Text to String as warning (truncation possible)', () => {
      expect(WARNING_CONVERSIONS.Text).toContain('String');
    });
  });

  describe('RISK_CLASSIFICATION', () => {
    it('should have AUTO_FIXABLE category with new_required_field', () => {
      expect(RISK_CLASSIFICATION.AUTO_FIXABLE).toContain('new_required_field');
    });

    it('should have CONFIRM_TO_PROCEED category with type widening changes', () => {
      expect(RISK_CLASSIFICATION.CONFIRM_TO_PROCEED).toContain('type_change_widening');
    });

    it('should have BLOCKING category with destructive changes', () => {
      expect(RISK_CLASSIFICATION.BLOCKING).toContain('drop_table');
      expect(RISK_CLASSIFICATION.BLOCKING).toContain('drop_column');
      expect(RISK_CLASSIFICATION.BLOCKING).toContain('optional_to_required');
    });
  });

  describe('isConversionSafe', () => {
    it('should return true for Int -> BigInt', () => {
      expect(isConversionSafe('Int', 'BigInt')).toBe(true);
    });

    it('should return true for Int -> String', () => {
      expect(isConversionSafe('Int', 'String')).toBe(true);
    });

    it('should return false for String -> Int', () => {
      expect(isConversionSafe('String', 'Int')).toBe(false);
    });

    it('should return true for same type', () => {
      expect(isConversionSafe('String', 'String')).toBe(true);
    });

    it('should return true for String -> Phone', () => {
      expect(isConversionSafe('String', 'Phone')).toBe(true);
    });

    it('should return true for String -> URL', () => {
      expect(isConversionSafe('String', 'URL')).toBe(true);
    });

    it('should return true for String -> Slug', () => {
      expect(isConversionSafe('String', 'Slug')).toBe(true);
    });

    it('should return true for String -> Email', () => {
      expect(isConversionSafe('String', 'Email')).toBe(true);
    });

    it('should return true for String -> IPAddress', () => {
      expect(isConversionSafe('String', 'IPAddress')).toBe(true);
    });

    // Reverse conversions (Type -> String)
    it('should return true for Phone -> String', () => {
      expect(isConversionSafe('Phone', 'String')).toBe(true);
    });

    it('should return true for URL -> String', () => {
      expect(isConversionSafe('URL', 'String')).toBe(true);
    });

    it('should return true for Slug -> String', () => {
      expect(isConversionSafe('Slug', 'String')).toBe(true);
    });

    it('should return true for Email -> String', () => {
      expect(isConversionSafe('Email', 'String')).toBe(true);
    });

    it('should return true for IPAddress -> String', () => {
      expect(isConversionSafe('IPAddress', 'String')).toBe(true);
    });

    // Cross-type conversions
    it('should return true for Phone -> URL', () => {
      expect(isConversionSafe('Phone', 'URL')).toBe(true);
    });

    it('should return true for Email -> Slug', () => {
      expect(isConversionSafe('Email', 'Slug')).toBe(true);
    });
  });

  describe('getConversionRisk', () => {
    it('should return "safe" for allowed conversions', () => {
      expect(getConversionRisk('Int', 'BigInt')).toBe('safe');
    });

    it('should return "warning" for risky conversions', () => {
      expect(getConversionRisk('Decimal', 'Float')).toBe('warning');
    });

    it('should return "blocking" for incompatible conversions', () => {
      expect(getConversionRisk('String', 'Int')).toBe('blocking');
    });

    it('should return "safe" for same type', () => {
      expect(getConversionRisk('String', 'String')).toBe('safe');
    });

    it('should return "safe" for String -> Phone', () => {
      expect(getConversionRisk('String', 'Phone')).toBe('safe');
    });

    it('should return "safe" for String -> URL', () => {
      expect(getConversionRisk('String', 'URL')).toBe('safe');
    });

    it('should return "safe" for String -> Slug', () => {
      expect(getConversionRisk('String', 'Slug')).toBe('safe');
    });

    it('should return "safe" for String -> Email', () => {
      expect(getConversionRisk('String', 'Email')).toBe('safe');
    });

    it('should return "safe" for String -> IPAddress', () => {
      expect(getConversionRisk('String', 'IPAddress')).toBe('safe');
    });

    // Reverse conversions (Type -> String) should also be safe
    it('should return "safe" for Phone -> String', () => {
      expect(getConversionRisk('Phone', 'String')).toBe('safe');
    });

    it('should return "safe" for URL -> String', () => {
      expect(getConversionRisk('URL', 'String')).toBe('safe');
    });

    it('should return "safe" for Slug -> String', () => {
      expect(getConversionRisk('Slug', 'String')).toBe('safe');
    });

    it('should return "safe" for Email -> String', () => {
      expect(getConversionRisk('Email', 'String')).toBe('safe');
    });

    it('should return "safe" for IPAddress -> String', () => {
      expect(getConversionRisk('IPAddress', 'String')).toBe('safe');
    });

    // Cross-type conversions should be safe
    it('should return "safe" for Phone -> Email', () => {
      expect(getConversionRisk('Phone', 'Email')).toBe('safe');
    });

    it('should return "safe" for URL -> Slug', () => {
      expect(getConversionRisk('URL', 'Slug')).toBe('safe');
    });
  });

  describe('classifyChange', () => {
    it('should return AUTO_FIXABLE for new_required_field', () => {
      expect(classifyChange('new_required_field')).toBe('AUTO_FIXABLE');
    });

    it('should return BLOCKING for drop_column', () => {
      expect(classifyChange('drop_column')).toBe('BLOCKING');
    });

    it('should return CONFIRM_TO_PROCEED for type_change_widening', () => {
      expect(classifyChange('type_change_widening')).toBe('CONFIRM_TO_PROCEED');
    });

    it('should return null for unknown change type', () => {
      expect(classifyChange('unknown_change')).toBeNull();
    });
  });
});
