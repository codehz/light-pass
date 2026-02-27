import { ChatFullInfo, ChatJoinRequest } from "@telegraf/types";
import { DurableObject } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { drizzle, DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { nanoid } from "nanoid";
import type { AdminAction, RpcStatus } from "../../shared/src/contracts";
import { WorkersCacheStorage } from "workers-cache-storage";
import { api, BotError } from "./api";
import * as schema from "./db";
import migrations from "./migrations/migrations";
import {
  clearJoinResponse,
  deleteJoinRequest,
  findChatById,
  findJoinRequest,
  findJoinRequestWithChat,
  findLatestPendingJoinRequest,
  insertJoinResponse,
  upsertJoinRequest,
} from "./services/JoinRequestRepository";
import {
  handleJoinRequestByMode,
  orchestrateFormJoinRequest,
} from "./services/JoinRequestFlow";
import { projectUserStatus } from "./services/StatusProjector";
import { VerificationCoordinator } from "./services/VerificationCoordinator";
import { getChatInviteLink, getChatTitle } from "./utils/chat";
import { checkChatMember } from "./utils/checkChatMember";
import { createEncryptor, type Encryptor } from "./utils/encrypt";
import { escapeValue, renderTemplate } from "./utils/template";

export class Backend extends DurableObject<Env> {
  #db: DrizzleSqliteDODatabase<typeof schema>;
  #encryptor!: Encryptor;
  static ChatCache = WorkersCacheStorage.json<ChatFullInfo>("chat");
  static EncryptCache = WorkersCacheStorage.text("encrypt");

  static {
    this.ChatCache.defaultTtl = 86400;
    this.EncryptCache.defaultTtl = 86400;
  }

  async #getChat(chat_id: number): Promise<ChatFullInfo | null> {
    try {
      return await Backend.ChatCache.wrap(
        `${chat_id}`,
        async () => await api.getChat(this.env.BOT_TOKEN, { chat_id }),
      );
    } catch (e) {
      const error = e as Error;
      if (error.message.includes("Forbidden")) {
        console.warn(
          `Bot kicked from chat ${chat_id}, cleaning up admin records`,
        );
        await this.#db
          .delete(schema.ChatAdmin)
          .where(eq(schema.ChatAdmin.chat, chat_id))
          .catch((err) =>
            console.error("Failed to clean up admin records", err),
          );
        return null;
      }
      throw e;
    }
  }

  async #encrypt(text: string) {
    return await Backend.EncryptCache.wrap(text, async () =>
      this.#encryptor.encrypt(text),
    );
  }

  async #handlePassJoinRequest(
    request: ChatJoinRequest,
    config: schema.ChatConfig,
  ) {
    try {
      await api.approveChatJoinRequest(this.env.BOT_TOKEN, {
        chat_id: request.chat.id,
        user_id: request.from.id,
      });
    } catch (e) {
      if (e instanceof BotError) {
        if (e.message.includes("USER_ALREADY_PARTICIPANT")) return;
        if (e.code === 400) return;
      }
      throw e;
    }

    const fullChat = await this.#getChat(request.chat.id).catch(() => null);
    const chatTitle = fullChat ? getChatTitle(fullChat) : request.chat.title;
    const userDisplayName =
      [request.from.first_name, request.from.last_name]
        .filter(Boolean)
        .join(" ") || request.from.username || `${request.from.id}`;
    const deadline = Date.now() + config.timeout * 1000;
    const context = {
      user: {
        ref: request.from.username
          ? `@${request.from.username}`
          : `[${escapeValue(userDisplayName)}](tg://user?id=${request.from.id})`,
        id: request.from.id,
        first_name: request.from.first_name || "",
        last_name: request.from.last_name || "",
        username: request.from.username || "",
        display_name: userDisplayName,
        bio: request.bio || "",
      },
      chat: {
        ref: `[${escapeValue(chatTitle)}](https://t.me/c/${request.chat.id})`,
        id: request.chat.id,
        title: chatTitle,
        question: config.question,
      },
      request: {
        deadline,
        date: Date.now(),
      },
      meta: {
        deadline_formatted: new Date(deadline).toLocaleString("zh-CN"),
        bot_username: this.env.BOT_USERNAME,
      },
      response: {
        answer: "(自动通过，无需回答)",
        details: "(none)",
      },
    };

    const renderedWelcome = renderTemplate(config.welcome, context).trim();
    const groupWelcomeText =
      renderedWelcome || `欢迎 ${userDisplayName} 加入「${chatTitle}」`;

    await api
      .sendMessage(this.env.BOT_TOKEN, {
        chat_id: request.chat.id,
        text: groupWelcomeText,
        parse_mode: renderedWelcome ? "MarkdownV2" : undefined,
      })
      .catch((e) => console.error("failed to send pass welcome to group", e));

    const inviteLink =
      fullChat?.type === "supergroup" ? getChatInviteLink(fullChat) : undefined;
    await api
      .sendMessage(this.env.BOT_TOKEN, {
        chat_id: request.user_chat_id,
        text: `你加入「${chatTitle}」的申请已自动通过。`,
        reply_markup: inviteLink
          ? {
              inline_keyboard: [[{ text: "进入群组", url: inviteLink }]],
            }
          : undefined,
      })
      .catch((e) => console.error("failed to send pass welcome to user", e));
  }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#db = drizzle(this.ctx.storage, { logger: false, schema });
    ctx.blockConcurrencyWhile(async () => {
      await migrate(this.#db, migrations);
      this.#encryptor = await createEncryptor(this.env.WEBHOOK_SECRET);
    });
  }

  async updateChatPermission(chat: number, permission: boolean) {
    if (!permission) {
      await this.#db
        .delete(schema.ChatPermission)
        .where(eq(schema.ChatPermission.id, chat));
      return;
    }
    await this.#db
      .insert(schema.ChatPermission)
      .values({ id: chat })
      .onConflictDoNothing();
    const admins = await api.getChatAdministrators(this.env.BOT_TOKEN, {
      chat_id: chat,
    });
    await this.#db.transaction(async (tx) => {
      await tx.delete(schema.ChatAdmin).where(eq(schema.ChatAdmin.chat, chat));
      for (const admin of admins) {
        if (checkChatMember(admin)) {
          await tx.insert(schema.ChatAdmin).values({
            chat,
            user: admin.user.id,
          });
          console.log(
            "add admins: " + JSON.stringify({ chat, user: admin.user.id }),
          );
        }
      }
    });
  }

  async handleChatJoinRequest(request: ChatJoinRequest) {
    const chat = await findChatById(this.#db, request.chat.id);
    const verification = new VerificationCoordinator(this.env.VERIFY);
    await handleJoinRequestByMode(request, chat ?? null, {
      onPass: async (passRequest, config) => {
        await this.#handlePassJoinRequest(passRequest, config);
      },
      onForm: async (formRequest, formChat) => {
        await this.#db.transaction(async (tx) => {
          await orchestrateFormJoinRequest(formRequest, formChat, {
            createWorkflowId: () => nanoid(),
            now: () => new Date(),
            clearJoinResponse: (joinChat, user) =>
              clearJoinResponse(tx, joinChat, user),
            findExistingJoinRequest: async (joinChat, user) =>
              (await findJoinRequest(tx, joinChat, user)) ?? null,
            terminateExistingWorkflow: (workflowId) =>
              verification.terminate(workflowId),
            upsertJoinRequest: async (payload) => {
              await upsertJoinRequest(tx, payload);
            },
            createWorkflow: (workflowId, params) =>
              verification.create(workflowId, params),
          });
        });
      },
    });
  }

  async addAdmin(chat: number, user: number) {
    await this.#db
      .insert(schema.ChatAdmin)
      .values({ chat, user })
      .onConflictDoNothing();
  }

  async removeAdmin(chat: number, user: number) {
    await this.#db
      .delete(schema.ChatAdmin)
      .where(
        and(eq(schema.ChatAdmin.chat, chat), eq(schema.ChatAdmin.user, user)),
      );
  }

  async checkChatAdmin(chat: number, user: number) {
    const record = await this.#db.query.ChatAdmin.findFirst({
      where: and(
        eq(schema.ChatAdmin.chat, chat),
        eq(schema.ChatAdmin.user, user),
      ),
    });
    return !!record;
  }

  async getChatInfo(chat: number) {
    const fullChat = await this.#getChat(chat);
    return fullChat;
  }

  async getChatConfig(chat: number) {
    const record = await this.#db.query.Chat.findFirst({
      where: eq(schema.Chat.id, chat),
    });
    return record?.config ?? null;
  }

  async getUserStatus(user: number): Promise<RpcStatus> {
    return await projectUserStatus(this.#db, user, {
      getChat: (chatId) => this.#getChat(chatId),
      encrypt: (text) => this.#encrypt(text),
      encryptNoCache: (text) => this.#encryptor.encrypt(text),
    });
  }

  async getLatestPendingJoinRequest(user: number) {
    const pending = await findLatestPendingJoinRequest(this.#db, user);
    if (!pending) return null;
    try {
      const full = await this.#getChat(pending.Chat.id);
      return {
        id: pending.Chat.id,
        title: full ? getChatTitle(full) : "unknown",
      };
    } catch (e) {
      return {
        id: pending.Chat.id,
        title: `unknown (${e})`,
      };
    }
  }

  async updateChatConfig(
    chat: number,
    config: schema.ChatConfig,
  ): Promise<void> {
    await this.#db
      .insert(schema.Chat)
      .values({ id: chat, config })
      .onConflictDoUpdate({
        set: { config },
        target: [schema.Chat.id],
      })
      .execute();
  }

  async removeJoinRequest(chat: number, user: number) {
    await deleteJoinRequest(this.#db, chat, user);
  }

  async handleUserAnswered(
    chat: number,
    user: number,
    answer: string,
    details: string,
  ) {
    const verification = new VerificationCoordinator(this.env.VERIFY);
    await this.#db.transaction(async (tx) => {
      const found = await findJoinRequestWithChat(tx, chat, user);
      if (!found?.Chat.config) {
        console.error("invalid join request", found);
        await deleteJoinRequest(tx, chat, user);
        return;
      }
      try {
        await insertJoinResponse(tx, {
          chat,
          user,
          answer,
          date: new Date(),
          details,
          question: found.Chat.config.question,
        });
        await verification.sendUserAnswer(found.workflowId, {
          answer,
          details,
          question: found.Chat.config.question,
        });
      } catch (e) {
        console.error("failed to send user answer", e);
      }
    });
  }

  async handleAdminAction(chat: number, user: number, action: AdminAction) {
    const found = await findJoinRequestWithChat(this.#db, chat, user);
    const verification = new VerificationCoordinator(this.env.VERIFY);
    try {
      if (!found?.Chat.config) {
        console.error("invalid join request", found);
        throw new Error("invalid join request");
      }
      await verification.sendAdminAction(found.workflowId, action);
    } catch (e) {
      console.error("failed to send admin action", e);
      throw e;
    } finally {
      await deleteJoinRequest(this.#db, chat, user);
    }
  }
}
