/**
 * Simple template renderer for message templates.
 * Supports {{variable}} syntax with dot notation (e.g., {{user.first_name}}).
 * Options for handling missing variables and escaping.
 */

export interface RenderOptions {
  /** How to handle missing variables: 'empty' (default), 'error', or 'placeholder' */
  missingVar?: 'empty' | 'error' | 'placeholder';
  /** Escape mode: 'none' (default), 'markdown', or 'html' */
  escape?: 'none' | 'markdown' | 'html';
}

/**
 * Renders a template string by replacing {{variable}} placeholders with values from context.
 * @param template The template string with {{variable}} placeholders.
 * @param context An object containing variable values.
 * @param options Options for rendering behavior.
 * @returns The rendered string.
 */
export function renderTemplate(
  template: string,
  context: Record<string, any>,
  options: RenderOptions = {}
): string {
  const { missingVar = 'empty', escape = 'none' } = options;

  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getValueByPath(context, path.trim());
    if (value === undefined) {
      switch (missingVar) {
        case 'error':
          throw new Error(`Missing variable: ${path}`);
        case 'placeholder':
          return match; // Keep {{variable}} as is
        case 'empty':
        default:
          return '';
      }
    }
    const strValue = String(value);
    return escapeValue(strValue, escape);
  });
}

/**
 * Gets a value from an object using dot notation path.
 * @param obj The object to traverse.
 * @param path The dot-separated path (e.g., 'user.first_name').
 * @returns The value at the path, or undefined if not found.
 */
function getValueByPath(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' ? current[key] : undefined;
  }, obj);
}

/**
 * Escapes a string based on the specified mode.
 * @param value The string to escape.
 * @param mode The escape mode.
 * @returns The escaped string.
 */
function escapeValue(value: string, mode: 'none' | 'markdown' | 'html'): string {
  switch (mode) {
    case 'markdown':
      // Basic Markdown escaping: escape *, _, [, ], (, ), ~, `, >, #, +, -, =, |, {, }, ., !
      return value.replace(/([*_[\]()~`>#+-=|{}.!])/g, '\\$1');
    case 'html':
      // Basic HTML escaping
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    case 'none':
    default:
      return value;
  }
}