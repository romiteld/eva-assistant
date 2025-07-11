import { generateRandomToken, generateRandomString, generateUUID } from './crypto-utils';

describe('Crypto Utils', () => {
  describe('generateRandomToken', () => {
    it('should generate a hex string of correct length', () => {
      const token = generateRandomToken(32);
      expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it('should generate different tokens each time', () => {
      const token1 = generateRandomToken(32);
      const token2 = generateRandomToken(32);
      expect(token1).not.toBe(token2);
    });

    it('should handle different byte lengths', () => {
      const token16 = generateRandomToken(16);
      const token8 = generateRandomToken(8);
      expect(token16).toHaveLength(32);
      expect(token8).toHaveLength(16);
    });
  });

  describe('generateRandomString', () => {
    it('should generate alphanumeric string of correct length', () => {
      const str = generateRandomString(32);
      expect(str).toHaveLength(32);
      expect(/^[A-Za-z0-9]+$/.test(str)).toBe(true);
    });

    it('should generate different strings each time', () => {
      const str1 = generateRandomString(32);
      const str2 = generateRandomString(32);
      expect(str1).not.toBe(str2);
    });
  });

  describe('generateUUID', () => {
    it('should generate valid UUID v4', () => {
      const uuid = generateUUID();
      // Basic UUID format check
      expect(uuid).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i);
    });

    it('should generate different UUIDs each time', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });
});