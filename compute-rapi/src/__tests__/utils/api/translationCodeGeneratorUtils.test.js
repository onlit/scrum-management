const prisma = require('#configs/prisma.js');
const redlock = require('#configs/redlock.js');
const {
  generateUniqueCode,
  isValidCodeFormat,
  generateUniqueCodeWithLock,
} = require('#utils/api/translationCodeGeneratorUtils.js');

jest.mock('#configs/prisma.js', () => ({
  translation: {
    findFirst: jest.fn(),
  },
}));

jest.mock('#configs/redlock.js', () => ({
  acquire: jest.fn(),
}));

describe('translationCodeGeneratorUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isValidCodeFormat', () => {
    it('returns true for valid XXXX-XXX format', () => {
      expect(isValidCodeFormat('ABCD-123')).toBe(true);
      expect(isValidCodeFormat('1234-ABC')).toBe(true);
      expect(isValidCodeFormat('A1B2-C3D')).toBe(true);
    });

    it('returns false for invalid formats', () => {
      expect(isValidCodeFormat('ABC-1234')).toBe(false);
      expect(isValidCodeFormat('ABCDE-12')).toBe(false);
      expect(isValidCodeFormat('abcd-123')).toBe(false);
      expect(isValidCodeFormat('ABCD123')).toBe(false);
      expect(isValidCodeFormat('')).toBe(false);
      expect(isValidCodeFormat(null)).toBe(false);
      expect(isValidCodeFormat(undefined)).toBe(false);
    });
  });

  describe('generateUniqueCode', () => {
    it('generates code in XXXX-XXX format', async () => {
      prisma.translation.findFirst.mockResolvedValue(null);

      const code = await generateUniqueCode(prisma, 'client-uuid');

      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{3}$/);
    });

    it('retries on collision until unique', async () => {
      prisma.translation.findFirst
        .mockResolvedValueOnce({ id: 'existing-1' })
        .mockResolvedValueOnce({ id: 'existing-2' })
        .mockResolvedValueOnce(null);

      const code = await generateUniqueCode(prisma, 'client-uuid');

      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{3}$/);
      expect(prisma.translation.findFirst).toHaveBeenCalledTimes(3);
    });

    it('throws after max attempts exceeded', async () => {
      prisma.translation.findFirst.mockResolvedValue({ id: 'always-exists' });

      await expect(generateUniqueCode(prisma, 'client-uuid')).rejects.toThrow(
        'Failed to generate unique translation code'
      );
    });
  });

  describe('generateUniqueCodeWithLock', () => {
    it('acquires distributed lock before generating', async () => {
      const mockLock = {
        release: jest.fn().mockResolvedValue(undefined),
      };
      redlock.acquire.mockResolvedValue(mockLock);
      prisma.translation.findFirst.mockResolvedValue(null);

      const code = await generateUniqueCodeWithLock(prisma, 'client-uuid');

      expect(redlock.acquire).toHaveBeenCalledWith(
        ['lock:translation-code:client-uuid'],
        expect.any(Number)
      );
      expect(mockLock.release).toHaveBeenCalled();
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{3}$/);
    });

    it('releases lock even on error', async () => {
      const mockLock = {
        release: jest.fn().mockResolvedValue(undefined),
      };
      redlock.acquire.mockResolvedValue(mockLock);
      prisma.translation.findFirst.mockRejectedValue(new Error('DB error'));

      await expect(
        generateUniqueCodeWithLock(prisma, 'client-uuid')
      ).rejects.toThrow('DB error');

      expect(mockLock.release).toHaveBeenCalled();
    });
  });
});
