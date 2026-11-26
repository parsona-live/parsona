/**
 * Safe, predictable template variable resolver for Flow Engine 2.0.
 *
 * Requirements:
 * - Allowlisted namespaces and keys: vars.*, contact.*, conversation.*, message.*, ai.*, context.*
 * - Protect against prototype pollution (__proto__, constructor, prototype).
 * - No method calls, no JS eval, no SQL expressions.
 * - Support filter pipeline, e.g.:
 *     {{ contact.name | default:"there" }}
 *     {{ vars.service | uppercase }}
 *     {{ message.text | trim }}
 * - Safe null / undefined handling.
 */

const BLOCKED_PROPERTIES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'valueOf',
  'toString',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
]);

const ALLOWED_NAMESPACES = new Set([
  'vars',
  'contact',
  'conversation',
  'message',
  'ai',
  'context',
  'system',
]);

export interface InterpolationOptions {
  /** If true, leave unmatched {{ variable }} tokens intact. Default is false (renders empty string or default filter). */
  preserveUnmatched?: boolean;
}

/**
 * Safely traverses a path on an object without prototype leakage.
 */
function safeGet(target: unknown, pathParts: string[]): unknown {
  let current: unknown = target;

  for (const part of pathParts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    if (BLOCKED_PROPERTIES.has(part)) {
      return undefined;
    }
    // Prevent traversing non-plain objects or functions
    if (typeof (current as Record<string, unknown>)[part] === 'function') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Resolves a variable token against the provided variables scope.
 */
function resolvePath(rawKey: string, vars: Record<string, unknown>): unknown {
  if (!rawKey || BLOCKED_PROPERTIES.has(rawKey)) {
    return undefined;
  }

  // 1. Direct match in vars (e.g. "name", "vars.name", "contact.phone", "message.text")
  if (vars[rawKey] !== undefined && vars[rawKey] !== null) {
    return vars[rawKey];
  }

  // 1b. Built-in dynamic date/time tokens
  if (rawKey === 'current_date' || rawKey === 'today' || rawKey === 'system.current_date') {
    return new Date().toISOString().slice(0, 10);
  }
  if (rawKey === 'current_datetime' || rawKey === 'now' || rawKey === 'system.current_datetime') {
    return new Date().toISOString();
  }

  // 2. If starts with "vars.", check without prefix
  if (rawKey.startsWith('vars.')) {
    const stripped = rawKey.slice(5);
    if (!BLOCKED_PROPERTIES.has(stripped) && vars[stripped] !== undefined && vars[stripped] !== null) {
      return vars[stripped];
    }
  } else {
    // Also check with "vars." prefix if key was plain
    const prefixed = `vars.${rawKey}`;
    if (vars[prefixed] !== undefined && vars[prefixed] !== null) {
      return vars[prefixed];
    }
  }

  // 3. Dot-separated path traversal
  if (rawKey.includes('.')) {
    const parts = rawKey.split('.');
    for (const p of parts) {
      if (BLOCKED_PROPERTIES.has(p)) return undefined;
    }

    const [root, ...rest] = parts;

    // Check if root is in allowed namespaces
    if (ALLOWED_NAMESPACES.has(root)) {
      // Look up within vars[root] object if it exists
      const rootObj = vars[root];
      if (rootObj && typeof rootObj === 'object') {
        const val = safeGet(rootObj, rest);
        if (val !== undefined && val !== null) {
          return val;
        }
      }

      // If root is 'vars', check vars directly for the rest of path
      if (root === 'vars') {
        const val = safeGet(vars, rest);
        if (val !== undefined && val !== null) {
          return val;
        }
      }
    }

    // Try general safeGet across root object
    const generalVal = safeGet(vars, parts);
    if (generalVal !== undefined && generalVal !== null) {
      return generalVal;
    }
  }

  return undefined;
}

/**
 * Parses and applies a chain of pipes/filters to a resolved value.
 * Example filter: default:"there" | uppercase
 */
function applyFilters(value: unknown, filterExpression: string | undefined): unknown {
  if (!filterExpression) {
    return value;
  }

  const filters = filterExpression.split('|').map((f) => f.trim()).filter(Boolean);
  let result = value;

  for (const filter of filters) {
    if (filter.startsWith('default:')) {
      const rawArg = filter.slice(8).trim();
      // Remove surrounding quotes if present: "text" or 'text'
      const fallback = rawArg.replace(/^["']|["']$/g, '');
      if (
        result === undefined ||
        result === null ||
        result === '' ||
        (typeof result === 'string' && result.trim() === '')
      ) {
        result = fallback;
      }
    } else if (filter === 'uppercase') {
      if (result !== undefined && result !== null) {
        result = String(result).toUpperCase();
      }
    } else if (filter === 'lowercase') {
      if (result !== undefined && result !== null) {
        result = String(result).toLowerCase();
      }
    } else if (filter === 'trim') {
      if (result !== undefined && result !== null) {
        result = String(result).trim();
      }
    }
  }

  return result;
}

/**
 * Safely interpolates template strings containing {{ var.path | filter }}.
 */
export function safeInterpolate(
  template: string,
  vars: Record<string, unknown> = {},
  options: InterpolationOptions = {},
): string {
  if (!template || typeof template !== 'string') return '';

  // Pattern matches: {{ path }} or {{ path | filter1 | filter2 }}
  const regex = /\{\{\s*([a-zA-Z0-9_.]+)(?:\s*\|\s*([^}]+))?\s*\}\}/g;

  return template.replace(regex, (fullMatch, rawKey, filterExpr) => {
    // Prevent prototype traversal
    if (BLOCKED_PROPERTIES.has(rawKey)) {
      return options.preserveUnmatched ? fullMatch : '';
    }

    const resolved = resolvePath(rawKey, vars);
    const filtered = applyFilters(resolved, filterExpr);

    if (filtered !== undefined && filtered !== null) {
      if (typeof filtered === 'object') {
        try {
          return JSON.stringify(filtered);
        } catch {
          return '';
        }
      }
      return String(filtered);
    }

    return options.preserveUnmatched ? fullMatch : '';
  });
}
