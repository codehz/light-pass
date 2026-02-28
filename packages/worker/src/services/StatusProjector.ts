import { eq } from "drizzle-orm";
import type { ChatFullInfo } from "@telegraf/types";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import {
  DEFAULT_ANSWER_CONSTRAINTS,
  type RpcStatus,
} from "../../../shared/src/contracts";
import * as schema from "../db";
import { getChatTitle } from "../utils/chat";

type WorkerDb = DrizzleSqliteDODatabase<typeof schema>;

type ProjectorDeps = {
  getChat: (chatId: number) => Promise<ChatFullInfo | null>;
  encrypt: (text: string) => Promise<string>;
  encryptNoCache: (text: string) => Promise<string>;
};

export async function projectUserStatus(
  db: WorkerDb,
  user: number,
  deps: ProjectorDeps,
): Promise<RpcStatus> {
  const [admins, requests] = await Promise.all([
    db.query.ChatAdmin.findMany({
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
    db.query.JoinRequest.findMany({
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
        const full = await deps.getChat(chat);
        return {
          id: chat,
          title: full?.type === "supergroup" ? full.title : "unknown",
          photo: full?.photo
            ? await deps.encryptNoCache(full.photo.big_file_id)
            : undefined,
          config: Chat?.config,
          requests: Chat
            ? await Promise.all(
                Chat.JoinRequests.map(
                  async ({ user, userBio, userChatId, date, deadline }) => {
                    try {
                      const full = await deps.getChat(userChatId);
                      return {
                        user,
                        userBio: userBio ?? "",
                        title: full ? getChatTitle(full) : "unknown",
                        photo: full?.photo
                          ? await deps.encrypt(full.photo.big_file_id)
                          : undefined,
                        date: date.getTime(),
                        deadline: deadline.getTime(),
                      };
                    } catch (e) {
                      return {
                        user,
                        userBio: userBio ?? "",
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
            Chat?.JoinResponses.map(({ user, date, answer, details, question }) => ({
              user: user ?? 0,
              date: date.getTime(),
              answer,
              details,
              question,
            })) ?? [],
        };
      }),
    ),
    requests: await Promise.all(
      requests.map(async ({ Chat, Response }) => {
        try {
          const full = await deps.getChat(Chat.id);
          return {
            id: Chat.id,
            question: Chat.config?.question ?? "",
            answer_constraints:
              Chat.config?.answer_constraints ?? DEFAULT_ANSWER_CONSTRAINTS,
            title: full ? getChatTitle(full) : "unknown",
            photo: full?.photo
              ? await deps.encrypt(full.photo.big_file_id)
              : undefined,
            answered: !!Response,
          };
        } catch (e) {
          return {
            id: Chat.id,
            question: Chat.config?.question ?? "",
            answer_constraints:
              Chat.config?.answer_constraints ?? DEFAULT_ANSWER_CONSTRAINTS,
            title: `unknown (${e})`,
            photo: undefined,
            answered: !!Response,
          };
        }
      }),
    ),
  };
}
