import { and, eq } from "drizzle-orm";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import * as schema from "../db";
import { pickLatestPendingRequest } from "./JoinRequestFlow";

export type DbExecutor = Pick<
  DrizzleSqliteDODatabase<typeof schema>,
  "query" | "insert" | "update" | "delete"
>;

export async function findChatById(db: DbExecutor, chatId: number) {
  return await db.query.Chat.findFirst({
    where: eq(schema.Chat.id, chatId),
  });
}

export async function clearJoinResponse(
  db: DbExecutor,
  chat: number,
  user: number,
) {
  await db
    .delete(schema.JoinResponse)
    .where(
      and(eq(schema.JoinResponse.chat, chat), eq(schema.JoinResponse.user, user)),
    );
}

export async function findJoinRequest(
  db: DbExecutor,
  chat: number,
  user: number,
) {
  return await db.query.JoinRequest.findFirst({
    where: and(eq(schema.JoinRequest.chat, chat), eq(schema.JoinRequest.user, user)),
  });
}

export async function upsertJoinRequest(
  db: DbExecutor,
  payload: {
    chat: number;
    user: number;
    userChatId: number;
    userBio: string | undefined;
    workflowId: string;
    date: Date;
    deadline: Date;
  },
) {
  const exists = await findJoinRequest(db, payload.chat, payload.user);
  if (exists) {
    await db
      .update(schema.JoinRequest)
      .set({
        date: payload.date,
        deadline: payload.deadline,
        userChatId: payload.userChatId,
        userBio: payload.userBio,
        workflowId: payload.workflowId,
      })
      .where(
        and(
          eq(schema.JoinRequest.chat, payload.chat),
          eq(schema.JoinRequest.user, payload.user),
        ),
      );
    return exists;
  }

  await db.insert(schema.JoinRequest).values(payload);
  return null;
}

export async function deleteJoinRequest(
  db: DbExecutor,
  chat: number,
  user: number,
) {
  await db
    .delete(schema.JoinRequest)
    .where(
      and(eq(schema.JoinRequest.chat, chat), eq(schema.JoinRequest.user, user)),
    );
}

export async function findJoinRequestWithChat(
  db: DbExecutor,
  chat: number,
  user: number,
) {
  return await db.query.JoinRequest.findFirst({
    where: and(eq(schema.JoinRequest.chat, chat), eq(schema.JoinRequest.user, user)),
    with: { Chat: true },
  });
}

export async function insertJoinResponse(
  db: DbExecutor,
  payload: {
    chat: number;
    user: number;
    answer: string;
    date: Date;
    details: string;
    question: string;
  },
) {
  await db.insert(schema.JoinResponse).values(payload);
}

export async function findLatestPendingJoinRequest(
  db: DbExecutor,
  user: number,
) {
  const requests = await db.query.JoinRequest.findMany({
    where: eq(schema.JoinRequest.user, user),
    with: {
      Chat: true,
      Response: true,
    },
  });

  return pickLatestPendingRequest(requests);
}
