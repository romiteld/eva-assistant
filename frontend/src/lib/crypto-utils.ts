/**
 * Cross-runtime crypto utilities that work in both Edge Runtime and Node.js
 */

/**
 * Generate a random token that works in both Edge Runtime and Node.js
 * @param bytes Number of random bytes to generate
 * @returns Hex-encoded random string
 */
export function generateRandomToken(bytes: number = 32): string {
  // Use Web Crypto API which is available in both Edge Runtime and modern Node.js
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  
  // Convert to hex string
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a secure random string of specified length
 * @param length Length of the random string
 * @returns Random string containing alphanumeric characters
 */
export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  
  return Array.from(values)
    .map(x => chars[x % chars.length])
    .join('');
}

/**
 * Generate a UUID v4
 * @returns UUID v4 string
 */
export function generateUUID(): string {
  // Use Web Crypto API if available
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback implementation
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  const values = new Uint8Array(16);
  crypto.getRandomValues(values);
  
  let i = 0;
  return template.replace(/[xy]/g, (c) => {
    const r = values[i++] & 0x0f;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}