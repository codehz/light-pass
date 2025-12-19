import { describe, expect, it } from "bun:test";
import { renderTemplate } from "../src/utils/template";

describe("renderTemplate", () => {
  const context = {
    user: {
      first_name: "John",
      last_name: "Doe",
      username: "johndoe",
      display_name: "John Doe",
    },
    chat: {
      id: 123,
      title: "Test Group",
    },
    request: {
      deadline: 1700000000000,
      date: 1690000000000,
    },
    meta: {
      deadline_formatted: "2023-11-15 00:00:00",
      bot_username: "testbot",
    },
  };

  it("renders basic variables", () => {
    const template = "Hello {{user.first_name}}!";
    const result = renderTemplate(template, context);
    expect(result).toBe("Hello John!");
  });

  it("renders nested variables", () => {
    const template = "Welcome to {{chat.title}}, {{user.display_name}}!";
    const result = renderTemplate(template, context);
    expect(result).toBe("Welcome to Test Group, John Doe!");
  });

  it("handles missing variables with default (empty)", () => {
    const template = "Hello {{user.missing}}!";
    const result = renderTemplate(template, context);
    expect(result).toBe("Hello !");
  });

  it("handles missing variables with placeholder", () => {
    const template = "Hello {{user.missing}}!";
    const result = renderTemplate(template, context, { missingVar: "placeholder" });
    expect(result).toBe("Hello {{user.missing}}!");
  });

  it("throws error for missing variables when configured", () => {
    const template = "Hello {{user.missing}}!";
    expect(() => renderTemplate(template, context, { missingVar: "error" })).toThrow("Missing variable: user.missing");
  });

  it("handles numbers and dates", () => {
    const template = "Chat ID: {{chat.id}}, Deadline: {{meta.deadline_formatted}}";
    const result = renderTemplate(template, context);
    expect(result).toBe("Chat ID: 123, Deadline: 2023-11-15 00:00:00");
  });

  it("ignores extra whitespace in placeholders", () => {
    const template = "Hello {{ user.first_name }}!";
    const result = renderTemplate(template, context);
    expect(result).toBe("Hello John!");
  });

  it("handles empty template", () => {
    const result = renderTemplate("", context);
    expect(result).toBe("");
  });

  it("handles template without placeholders", () => {
    const template = "Static message";
    const result = renderTemplate(template, context);
    expect(result).toBe("Static message");
  });
});