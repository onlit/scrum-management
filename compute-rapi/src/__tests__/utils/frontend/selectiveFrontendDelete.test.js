const path = require('path');
const fs = require('fs-extra');
const { selectiveFrontendDelete } = require('#src/utils/frontend/selectiveFrontendDelete');

describe('selectiveFrontendDelete', () => {
  const testDir = path.join(__dirname, 'test-frontend-app');

  beforeEach(async () => {
    await fs.ensureDir(testDir);
    // Create core directory (should be deleted)
    await fs.ensureDir(path.join(testDir, 'src/core/forms'));
    await fs.writeFile(path.join(testDir, 'src/core/forms/UserCreate.tsx'), 'export default {}');
    // Create domain directory (should be preserved)
    await fs.ensureDir(path.join(testDir, 'src/domain/forms'));
    await fs.writeFile(path.join(testDir, 'src/domain/forms/CustomForm.tsx'), 'export default {}');
    // Create domain interceptor (should be preserved)
    await fs.ensureDir(path.join(testDir, 'src/domain/interceptors'));
    await fs.writeFile(path.join(testDir, 'src/domain/interceptors/user.interceptor.tsx'), 'export default {}');
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('should delete core directory contents', async () => {
    await selectiveFrontendDelete(testDir);
    const coreExists = await fs.pathExists(path.join(testDir, 'src/core/forms/UserCreate.tsx'));
    expect(coreExists).toBe(false);
  });

  it('should preserve domain directory contents', async () => {
    await selectiveFrontendDelete(testDir);
    const domainFormExists = await fs.pathExists(path.join(testDir, 'src/domain/forms/CustomForm.tsx'));
    const interceptorExists = await fs.pathExists(path.join(testDir, 'src/domain/interceptors/user.interceptor.tsx'));
    expect(domainFormExists).toBe(true);
    expect(interceptorExists).toBe(true);
  });

  it('should preserve protected files', async () => {
    await fs.writeFile(path.join(testDir, '.env'), 'SECRET=123');
    await selectiveFrontendDelete(testDir);
    const envExists = await fs.pathExists(path.join(testDir, '.env'));
    expect(envExists).toBe(true);
  });
});
