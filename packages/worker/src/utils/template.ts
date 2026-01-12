/**
 * Simple template renderer for message templates.
 * Supports {{variable}} syntax with dot notation (e.g., {{user.first_name}}).
 * Options for handling missing variables and escaping.
 */

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
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmed = path.trim();
    const raw = trimmed.startsWith("@");
    const quota = trimmed.startsWith(">");
    const value = getValueByPath(context, trimmed.replace(/^[@>]/, ""));
    if (value === undefined) {
      return "";
    }
    const strValue = String(value);
    if (raw) {
      return strValue
    }
    const escaped = escapeValue(strValue);
    if (quota) {
      return `**>${escaped.replace(/\n/g, "\n>")}\n`;
    }
    return escaped;
  });
}

/**
 * Gets a value from an object using dot notation path.
 * @param obj The object to traverse.
 * @param path The dot-separated path (e.g., 'user.first_name').
 * @returns The value at the path, or undefined if not found.
 */
function getValueByPath(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => {
    return current && typeof current === "object" ? current[key] : undefined;
  }, obj);
}

/**
 * Escapes a string based on the specified mode.
 * @param value The string to escape.
 * @param mode The escape mode.
 * @returns The escaped string.
 */
export function escapeValue(value: string): string {
  // Basic Markdown escaping: escape *, _, [, ], (, ), ~, `, >, #, +, -, =, |, {, }, ., !
  return value.replace(/([*_[\]()~`>#+-=|{}.!])/g, "\\$1");
}
