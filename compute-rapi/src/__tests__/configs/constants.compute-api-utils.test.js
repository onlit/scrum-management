/**
 * Tests for COMPUTE_API_UTILS constant synchronization
 *
 * These tests ensure that every utility template file in the computeConstructors
 * directory has a corresponding entry in COMPUTE_API_UTILS, preventing runtime
 * errors in generated microservices due to missing utility files.
 */

const fs = require('fs');
const path = require('path');
const {
  COMPUTE_API_UTILS,
  COMPUTE_API_SECURITY_UTILS,
} = require('#configs/constants.js');

const UTILS_TEMPLATE_DIR = path.join(
  __dirname,
  '../../computeConstructors/api/utils'
);

const SECURITY_UTILS_TEMPLATE_DIR = path.join(UTILS_TEMPLATE_DIR, 'security');

describe('COMPUTE_API_UTILS synchronization', () => {
  let templateFiles;
  let securityTemplateFiles;

  beforeAll(() => {
    // Get all .template.js files in the utils directory (excluding subdirectories)
    templateFiles = fs
      .readdirSync(UTILS_TEMPLATE_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.template.js'))
      .map((dirent) => dirent.name.replace('.template.js', ''));

    // Get all .template.js files in the security subdirectory
    securityTemplateFiles = fs
      .readdirSync(SECURITY_UTILS_TEMPLATE_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.template.js'))
      .map((dirent) => dirent.name.replace('.template.js', ''));
  });

  it('should have an entry for every utility template file', () => {
    const missingFromConstant = templateFiles.filter(
      (name) => !COMPUTE_API_UTILS.includes(name)
    );

    expect(missingFromConstant).toEqual([]);
  });

  it('should not have extra entries without corresponding template files', () => {
    const extraInConstant = COMPUTE_API_UTILS.filter(
      (name) => !templateFiles.includes(name)
    );

    expect(extraInConstant).toEqual([]);
  });

  it('should have an entry for every security utility template file', () => {
    const missingFromConstant = securityTemplateFiles.filter(
      (name) => !COMPUTE_API_SECURITY_UTILS.includes(name)
    );

    expect(missingFromConstant).toEqual([]);
  });

  it('should not have extra security entries without corresponding template files', () => {
    const extraInConstant = COMPUTE_API_SECURITY_UTILS.filter(
      (name) => !securityTemplateFiles.includes(name)
    );

    expect(extraInConstant).toEqual([]);
  });
});
