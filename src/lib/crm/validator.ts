import type { CrmField } from './types';

export interface ValidationResult {
  valid: boolean;
  data: Record<string, unknown>;
  errors: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate and coerce a CRM record payload against its collection's field schema.
 *
 * @param fields Collection field definitions
 * @param input Raw input data object
 * @param options.partial When true (for PATCH/update), missing required fields are allowed
 * @param options.strict When true, unknown keys not in `fields` are stripped
 */
export function validateCrmRecordData(
  fields: CrmField[],
  input: Record<string, unknown>,
  options: { partial?: boolean; strict?: boolean } = {},
): ValidationResult {
  const { partial = false, strict = false } = options;
  const errors: string[] = [];
  const sanitized: Record<string, unknown> = {};
  const fieldMap = new Map(fields.map((f) => [f.key, f]));

  // 1. Validate / coerce defined fields
  for (const field of fields) {
    const hasKey = Object.prototype.hasOwnProperty.call(input, field.key);
    let rawVal = hasKey ? input[field.key] : undefined;

    if (!hasKey || rawVal === undefined || rawVal === null || rawVal === '') {
      if (!partial && field.default_value !== undefined && field.default_value !== null) {
        rawVal = field.default_value;
      } else {
        if (!partial && field.is_required) {
          errors.push(`Field "${field.label || field.key}" is required.`);
        }
        if (hasKey && rawVal === null) {
          sanitized[field.key] = null;
        }
        continue;
      }
    }

    switch (field.field_type) {
      case 'text':
      case 'phone':
      case 'relation': {
        sanitized[field.key] = String(rawVal).trim();
        break;
      }
      case 'email': {
        const str = String(rawVal).trim();
        if (!EMAIL_RE.test(str)) {
          errors.push(`Field "${field.label || field.key}" must be a valid email address.`);
        } else {
          sanitized[field.key] = str;
        }
        break;
      }
      case 'url': {
        const str = String(rawVal).trim();
        try {
          const parsed = new URL(str);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            errors.push(`Field "${field.label || field.key}" must be an http/https URL.`);
          } else {
            sanitized[field.key] = str;
          }
        } catch {
          errors.push(`Field "${field.label || field.key}" must be a valid URL.`);
        }
        break;
      }
      case 'number': {
        const num = typeof rawVal === 'number' ? rawVal : Number(String(rawVal).trim());
        if (!Number.isFinite(num)) {
          errors.push(`Field "${field.label || field.key}" must be a valid number.`);
        } else {
          sanitized[field.key] = num;
        }
        break;
      }
      case 'boolean': {
        if (typeof rawVal === 'boolean') {
          sanitized[field.key] = rawVal;
        } else if (rawVal === 'true' || rawVal === '1' || rawVal === 1) {
          sanitized[field.key] = true;
        } else if (rawVal === 'false' || rawVal === '0' || rawVal === 0) {
          sanitized[field.key] = false;
        } else {
          errors.push(`Field "${field.label || field.key}" must be a boolean.`);
        }
        break;
      }
      case 'date': {
        const str = String(rawVal).trim();
        if (DATE_RE.test(str)) {
          sanitized[field.key] = str;
        } else {
          const d = new Date(str);
          if (Number.isNaN(d.getTime())) {
            errors.push(`Field "${field.label || field.key}" must be a valid date (YYYY-MM-DD).`);
          } else {
            sanitized[field.key] = d.toISOString().slice(0, 10);
          }
        }
        break;
      }
      case 'datetime': {
        const str = String(rawVal).trim();
        const d = new Date(str);
        if (Number.isNaN(d.getTime())) {
          errors.push(`Field "${field.label || field.key}" must be a valid datetime.`);
        } else {
          sanitized[field.key] = d.toISOString();
        }
        break;
      }
      case 'select': {
        const str = String(rawVal).trim();
        if (Array.isArray(field.options) && field.options.length > 0 && !field.options.includes(str)) {
          errors.push(
            `Field "${field.label || field.key}" must be one of: ${field.options.join(', ')}.`,
          );
        } else {
          sanitized[field.key] = str;
        }
        break;
      }
      case 'json': {
        if (typeof rawVal === 'string') {
          try {
            sanitized[field.key] = JSON.parse(rawVal);
          } catch {
            errors.push(`Field "${field.label || field.key}" must be valid JSON.`);
          }
        } else {
          sanitized[field.key] = rawVal;
        }
        break;
      }
      default: {
        sanitized[field.key] = rawVal;
      }
    }
  }

  // 2. Preserve extra keys if not strict (e.g. ad-hoc flow variables)
  if (!strict) {
    for (const [k, v] of Object.entries(input)) {
      if (!fieldMap.has(k) && k !== '__proto__' && k !== 'constructor' && k !== 'prototype') {
        sanitized[k] = v;
      }
    }
  }

  return {
    valid: errors.length === 0,
    data: sanitized,
    errors,
  };
}
