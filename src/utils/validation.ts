export function validateStringParam(
  value: unknown,
  paramName: string,
  maxLength = 1000,
  pattern?: RegExp,
): string {
  if (value === null || value === undefined) {
    throw new Error(`${paramName} is required`);
  }
  const str = String(value).trim();
  if (str.length === 0) {
    throw new Error(`${paramName} is required`);
  }
  if (str.length > maxLength) {
    throw new Error(`${paramName} exceeds maximum length of ${maxLength}`);
  }
  if (pattern && !pattern.test(str)) {
    throw new Error(`${paramName} contains invalid characters`);
  }
  return str;
}

export function validateHexParam(
  value: unknown,
  paramName: string,
  expectedLength = 6,
): string {
  const str = validateStringParam(value, paramName, expectedLength);
  const hex = str.toLowerCase();
  if (!/^[0-9a-f]+$/.test(hex) || hex.length !== expectedLength) {
    throw new Error(`${paramName} must be a valid hex string of length ${expectedLength}`);
  }
  return hex;
}

export function validateNumberParam(
  value: unknown,
  paramName: string,
  min: number,
  max: number,
  clamp = false,
  defaultValue?: number,
): number {
  if (value === null || value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`${paramName} is required`);
  }
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    throw new Error(`${paramName} must be a valid number`);
  }
  if (clamp) {
    return Math.min(Math.max(Math.round(num), min), max);
  }
  if (num < min || num > max) {
    throw new Error(`${paramName} must be between ${min} and ${max}`);
  }
  return Math.round(num);
}

export const SUBREDDIT_PATTERN = /^[a-zA-Z0-9_]{2,21}$/;
export const TWITTER_HANDLE_PATTERN = /^[a-zA-Z0-9_]{1,15}$/;
export const SLUG_PATTERN = /^[a-zA-Z0-9._-]+$/;

export function sanitizeTextContent(text: string, maxLength = 2000): string {
  return text
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}
