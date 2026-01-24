const fs = require('fs');
const path = require('path');

/**
 * Tests that verify the template paths referenced in utility files
 * actually exist. This prevents runtime ENOENT errors when the
 * code generator tries to read templates that don't exist.
 */
describe('Template Path References', () => {
  const constructorPath = path.join(
    __dirname,
    '../../../computeConstructors/frontend'
  );

  describe('createFormUtils.js template path', () => {
    it('should reference an existing CreateForm template at entity-core/core/forms/', () => {
      const templatePath = path.join(
        constructorPath,
        'entity-core',
        'core',
        'forms',
        'CreateForm.template.tsx'
      );
      expect(fs.existsSync(templatePath)).toBe(true);
    });
  });

  describe('detailFormUtils.js template path', () => {
    it('should reference an existing DetailForm template at entity-core/core/forms/', () => {
      const templatePath = path.join(
        constructorPath,
        'entity-core',
        'core',
        'forms',
        'DetailForm.template.tsx'
      );
      expect(fs.existsSync(templatePath)).toBe(true);
    });
  });

  describe('formFlowUtils.js template path', () => {
    it('should reference an existing FormFlow template at entity-core/core/forms/', () => {
      const templatePath = path.join(
        constructorPath,
        'entity-core',
        'core',
        'forms',
        'FormFlow.template.tsx'
      );
      expect(fs.existsSync(templatePath)).toBe(true);
    });
  });

  describe('no obsolete uiPackage references', () => {
    it('should not have uiPackage directory (templates moved to entity-core/)', () => {
      const obsoletePath = path.join(constructorPath, 'uiPackage');
      expect(fs.existsSync(obsoletePath)).toBe(false);
    });

    it('createFormUtils.js should not reference uiPackage', () => {
      const utilPath = path.join(
        __dirname,
        '../../../utils/frontend/createFormUtils.js'
      );
      const content = fs.readFileSync(utilPath, 'utf-8');
      expect(content).not.toContain("'uiPackage'");
    });

    it('detailFormUtils.js should not reference uiPackage', () => {
      const utilPath = path.join(
        __dirname,
        '../../../utils/frontend/detailFormUtils.js'
      );
      const content = fs.readFileSync(utilPath, 'utf-8');
      expect(content).not.toContain("'uiPackage'");
    });

    it('formFlowUtils.js should not reference uiPackage', () => {
      const utilPath = path.join(
        __dirname,
        '../../../utils/frontend/formFlowUtils.js'
      );
      const content = fs.readFileSync(utilPath, 'utf-8');
      expect(content).not.toContain("'uiPackage'");
    });
  });
});
