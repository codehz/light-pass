import { type } from "arktype";
import { relations } from "drizzle-orm";
import {
  type ChatConfig as SharedChatConfig,
  type ChatMode,
} from "../../shared/src/contracts";
import { normalizeAnswerConstraints } from "../../shared/src/answerConstraints";
import {
  customType,
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

type Mode = ChatMode;

const timestamp = customType<{ data: Date; driverData: number }>({
  dataType: () => "integer",
  fromDriver: (value) => new Date(value),
  toDriver: (value) => value.getTime(),
});

export const PromptConfig = type({
  text_in_private: "string",
  text_in_group: "string",
});
export type PromptConfig = typeof PromptConfig.infer;

export const AnswerConstraints = type({
  max_length: "number",
  min_lines: "number",
});
export type AnswerConstraints = typeof AnswerConstraints.infer;

export const ChatConfig = type({
  question: "string",
  welcome: "string",
  timeout: "number",
  prompt: PromptConfig,
  response_template: "string",
  answer_constraints: AnswerConstraints,
});
export type ChatConfig = SharedChatConfig;
const $ChatConfig = customType<{ data: ChatConfig; driverData: string }>({
  dataType: () => "text",
  fromDriver: (value) => {
    const result = JSON.parse(value);
    const base =
      typeof result === "object" && result !== null
        ? result
        : ({} as Record<string, unknown>);
    const legacyConstraints =
      "answer_constraints" in base &&
      typeof base.answer_constraints === "object" &&
      base.answer_constraints !== null
        ? base.answer_constraints
        : null;
    const normalized = {
      ...base,
      answer_constraints: normalizeAnswerConstraints(
        legacyConstraints as Partial<SharedChatConfig["answer_constraints"]> | null,
      ),
    };
    const verified = ChatConfig(normalized);
    if (verified instanceof type.errors) {
      throw new Error("Invalid prompt config");
    }
    if (
      verified.answer_constraints.max_length < 1 ||
      verified.answer_constraints.min_lines < 1
    ) {
      throw new Error("Invalid answer constraints");
    }
    return verified;
  },
  toDriver: (value) => JSON.stringify(value),
});

export const Chat = sqliteTable("chats", {
  id: integer().primaryKey(),
  config: $ChatConfig(),
  mode: text().$type<Mode>().default("FORM"),
});

export const ChatPermission = sqliteTable("chat-permissions", {
  id: integer().primaryKey(),
});

export const ChatRelations = relations(Chat, ({ one, many }) => ({
  HasPermission: one(ChatPermission, {
    fields: [Chat.id],
    references: [ChatPermission.id],
  }),
  Admins: many(ChatAdmin),
  JoinRequests: many(JoinRequest),
  JoinResponses: many(JoinResponse),
}));

export const ChatAdmin = sqliteTable(
  "chat-admins",
  {
    chat: integer().notNull(),
    user: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.chat, t.user] })],
);

export const ChatAdminRelations = relations(ChatAdmin, ({ one }) => ({
  Chat: one(Chat, { fields: [ChatAdmin.chat], references: [Chat.id] }),
}));

export const JoinRequest = sqliteTable(
  "join-requests",
  {
    chat: integer().notNull(),
    user: integer().notNull(),
    userChatId: integer().notNull(),
    userBio: text(),
    date: timestamp().notNull(),
    deadline: timestamp().notNull(),
    workflowId: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.chat, t.user] })],
);

export const JoinRequestRelation = relations(JoinRequest, ({ one }) => ({
  Chat: one(Chat, { fields: [JoinRequest.chat], references: [Chat.id] }),
  Response: one(JoinResponse, {
    fields: [JoinRequest.chat, JoinRequest.user],
    references: [JoinResponse.chat, JoinResponse.user],
  }),
}));

export const JoinResponse = sqliteTable(
  "join-responses",
  {
    chat: integer(),
    user: integer(),
    question: text().notNull(),
    answer: text().notNull(),
    details: text().notNull(),
    date: timestamp().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.chat, t.user] }),
    foreignKey({
      columns: [t.chat, t.user],
      foreignColumns: [JoinRequest.chat, JoinRequest.user],
    }).onDelete("cascade"),
  ],
);

export const JoinResponseRelation = relations(JoinResponse, ({ one }) => ({
  Chat: one(Chat, { fields: [JoinResponse.chat], references: [Chat.id] }),
}));
