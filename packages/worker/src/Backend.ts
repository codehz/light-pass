import { ChatFullInfo, ChatJoinRequest, type Chat } from "@telegraf/types";
import { DurableObject } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { drizzle, DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { nanoid } from "nanoid";
import { WorkersCacheStorage } from "workers-cache-storage";
import { api } from "./api";
import * as schema from "./db";
import migrations from "./migrations/migrations";
import { checkChatMember } from "./utils/checkChatMember";
import { createEncryptor, type Encryptor } from "./utils/encrypt";
import { AdminAction, VerifyUserParams } from "./VerifyUser";
import { getChatTitle } from "./utils/chat";

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
      // Bot 被踢出群 - 清理相应的 admin 记录
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
      // 其他错误继续抛出
      throw e;
    }
  }
  async #encrypt(text: string) {
    return await Backend.EncryptCache.wrap(text, async () =>
      this.#encryptor.encrypt(text),
    );
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
    await this.#db.transaction(async (tx) => {
      const chat = await tx.query.Chat.findFirst({
        where: eq(schema.Chat.id, request.chat.id),
      });
      if (!chat || !chat.config || chat.mode === "IGNORE") return;
      const workflowId = nanoid();
      await tx
        .delete(schema.JoinResponse)
        .where(
          and(
            eq(schema.JoinResponse.chat, chat.id),
            eq(schema.JoinResponse.user, request.from.id),
          ),
        );
      const exists = await tx.query.JoinRequest.findFirst({
        where: and(
          eq(schema.JoinRequest.chat, chat.id),
          eq(schema.JoinRequest.user, request.from.id),
        ),
      });
      const deadline = new Date(Date.now() + chat.config.timeout * 1000);
      if (exists) {
        let instance;
        try {
          instance = await this.env.VERIFY.get(exists.workflowId);
          await instance?.terminate().catch(() => {});
        } catch (e) {
          console.warn("failed to terminate existing workflow", e);
        }
        await tx
          .update(schema.JoinRequest)
          .set({
            date: new Date(),
            deadline,
            userChatId: request.user_chat_id,
            userBio: request.bio,
            workflowId,
          })
          .where(
            and(
              eq(schema.JoinRequest.chat, chat.id),
              eq(schema.JoinRequest.user, request.from.id),
            ),
          );
      } else {
        await tx.insert(schema.JoinRequest).values({
          date: new Date(),
          deadline,
          chat: chat.id,
          user: request.from.id,
          userChatId: request.user_chat_id,
          userBio: request.bio,
          workflowId,
        });
      }
      await this.env.VERIFY.create({
        id: workflowId,
        params: {
          chat: chat.id,
          user: request.from.id,
          userChatId: request.user_chat_id,
          config: chat.config,
          deadline: deadline.getTime(),
        } satisfies VerifyUserParams,
      });
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

  async getUserStatus(user: number) {
    const [admins, requests] = await Promise.all([
      this.#db.query.ChatAdmin.findMany({
        where: eq(schema.ChatAdmin.user, user),
        with: {
          Chat: {
            with: {
              JoinRequests: true,
              JoinResponses: true,
            },
          },
        },
      }),
      this.#db.query.JoinRequest.findMany({
        where: eq(schema.JoinRequest.user, user),
        with: {
          Chat: true,
          Response: true,
        },
      }),
    ]);
    return {
      admins: await Promise.all(
        admins.map(async ({ chat, Chat }) => {
          const full = await this.#getChat(chat);
          return {
            id: chat,
            title: full?.type === "supergroup" ? full.title : "unknown",
            photo: full?.photo
              ? await this.#encryptor.encrypt(full.photo.big_file_id)
              : undefined,
            config: Chat?.config,
            requests: Chat
              ? await Promise.all(
                  Chat.JoinRequests.map(
                    async ({ user, userBio, userChatId, date, deadline }) => {
                      try {
                        const full = await this.#getChat(userChatId);
                        return {
                          user,
                          userBio,
                          title: full ? getChatTitle(full) : "unknown",
                          photo: full?.photo
                            ? await this.#encrypt(full.photo.big_file_id)
                            : undefined,
                          date: date.getTime(),
                          deadline: deadline.getTime(),
                        };
                      } catch (e) {
                        return {
                          user,
                          userBio,
                          title: `unknown (${e})`,
                          photo: undefined,
                          date: date.getTime(),
                          deadline: deadline.getTime(),
                        };
                      }
                    },
                  ),
                )
              : [],
            responses:
              Chat?.JoinResponses.map(
                ({ user, date, answer, details, question }) => ({
                  user,
                  date: date.getTime(),
                  answer,
                  details,
                  question,
                }),
              ) ?? [],
          };
        }),
      ),
      requests: await Promise.all(
        requests.map(async ({ Chat, Response }) => {
          try {
            const full = await this.#getChat(Chat.id);
            return {
              id: Chat.id,
              question: Chat.config?.question,
              title: full ? getChatTitle(full) : "unknown",
              photo: full?.photo
                ? await this.#encrypt(full.photo.big_file_id)
                : undefined,
              answered: !!Response,
            };
          } catch (e) {
            return {
              id: Chat.id,
              question: Chat.config?.question,
              title: `unknown (${e})`,
              photo: undefined,
              answered: !!Response,
            };
          }
        }),
      ),
    };
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
    await this.#db
      .delete(schema.JoinRequest)
      .where(
        and(
          eq(schema.JoinRequest.chat, chat),
          eq(schema.JoinRequest.user, user),
        ),
      );
  }

  async handleUserAnswered(
    chat: number,
    user: number,
    answer: string,
    details: string,
  ) {
    await this.#db.transaction(async (tx) => {
      const found = await tx.query.JoinRequest.findFirst({
        where: and(
          eq(schema.JoinRequest.chat, chat),
          eq(schema.JoinRequest.user, user),
        ),
        with: { Chat: true },
      });
      if (!found?.Chat.config) {
        console.error("invalid join request", found);
        await this.removeJoinRequest(chat, user);
        return;
      }
      try {
        await tx.insert(schema.JoinResponse).values({
          chat,
          user,
          answer,
          date: new Date(),
          details,
          question: found.Chat.config.question,
        });
        const workflow = await this.env.VERIFY.get(found.workflowId);
        await workflow.sendEvent({
          type: "user_answer",
          payload: {
            answer,
            details,
            question: found.Chat.config.question,
          },
        });
      } catch (e) {
        console.error("failed to send user answer", e);
      }
    });
  }

  async handleAdminAction(chat: number, user: number, action: AdminAction) {
    const found = await this.#db.query.JoinRequest.findFirst({
      where: and(
        eq(schema.JoinRequest.chat, chat),
        eq(schema.JoinRequest.user, user),
      ),
      with: { Chat: true },
    });
    try {
      if (!found?.Chat.config) {
        console.error("invalid join request", found);
        throw new Error("invalid join request");
      }
      const workflow = await this.env.VERIFY.get(found.workflowId);
      await workflow.sendEvent({ type: "admin_action", payload: action });
    } catch (e) {
      console.error("failed to send admin action", e);
      throw e;
    } finally {
      await this.removeJoinRequest(chat, user);
    }
  }
}
