import { HttpError } from './errors.js';

interface IntegerOptions {
  field?: string;
  min?: number;
  max?: number;
  defaultValue?: number;
}

interface StringOptions {
  field?: string;
  min?: number;
  max: number;
  required?: boolean;
}

interface UrlOptions {
  field?: string;
  max?: number;
  required?: boolean;
  allowedHosts?: readonly string[];
}

export function integerValue(
  value: unknown,
  {
    field = 'value',
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
    defaultValue,
  }: IntegerOptions = {},
): number {
  if ((value === undefined || value === null || value === '') && defaultValue !== undefined) {
    return defaultValue;
  }

  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^-?\d+$/.test(value)
      ? Number(value)
      : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `${field} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function positiveId(value: unknown, field = 'id'): number {
  return integerValue(value, { field, min: 1 });
}

export function booleanValue(value: unknown, field: string): boolean {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  throw new HttpError(400, `${field} must be true or false`);
}

export function stringValue(
  value: unknown,
  { field = 'value', min = 0, max, required = true }: StringOptions,
): string {
  if (value === undefined || value === null) {
    if (!required) return '';
    throw new HttpError(400, `${field} is required`);
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} must be a string`);
  }

  const normalized = value.trim();
  if ((required && normalized.length === 0) || normalized.length < min || normalized.length > max) {
    throw new HttpError(400, `${field} must contain between ${Math.max(min, required ? 1 : 0)} and ${max} characters`);
  }
  return normalized;
}

export function httpUrl(
  value: unknown,
  {
    field = 'url',
    max = 2048,
    required = false,
    allowedHosts,
  }: UrlOptions = {},
): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required`);
    return null;
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} must be a URL`);
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > max) {
    throw new HttpError(400, `${field} must be at most ${max} characters`);
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new HttpError(400, `${field} must be a valid absolute URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new HttpError(400, `${field} must be an HTTP(S) URL without credentials`);
  }
  if (allowedHosts && !allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
    throw new HttpError(400, `${field} must use an approved host`);
  }
  return parsed.toString();
}
