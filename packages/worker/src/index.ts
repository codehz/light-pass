import { Update } from "@telegraf/types";
import { type } from "arktype";
import { ANSWER_VALIDATION_ERROR_PREFIX } from "../../shared/src/answerConstraints";
import type { RpcRequest } from "../../shared/src/contracts";
import type { Backend } from "./Backend";
import { WorkersCacheStorage } from "workers-cache-storage";
import { api, direct } from "./api";
import { ChatConfig } from "./db";
import {
  decodeAdminActionCallbackData,
  withOpenAppButton,
} from "./utils/button";
import { checkChatMember } from "./utils/checkChatMember";
import { createEncryptor, Encryptor } from "./utils/encrypt";
import { validateTelegramMiniAppData } from "./utils/validateTelegramMiniAppData";
import { AdminActionSchema } from "./VerifyUser";
export { Backend } from "./Backend";
export { Looper } from "./Looper";
export { VerifyUser } from "./VerifyUser";

let verifier: Encryptor | undefined;

export default {
  async fetch(request, env, ctx): Promise<Response> {
    verifier ??= await createEncryptor(env.WEBHOOK_SECRET);
    const pathname = new URL(request.url).pathname;
    const backend = getBackend(env);

    if (pathname === `/webhook`) {
      return await handleWebhookRequest(request, env, backend);
    }

    if (pathname === "/rpc") {
      return await handleRpcRequest(request, env, backend);
    }

    if (pathname.startsWith("/file/")) {
      return await handleFileRequest(pathname, env, verifier);
    }

    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env, any>;

function getBackend(env: Env) {
  const botId = env.BOT_TOKEN.split(":")[0];
  const id: DurableObjectId = env.BACKEND.idFromName(botId);
  return env.BACKEND.get(id);
}

async function handleWebhookRequest(
  request: Request,
  env: Env,
  backend: DurableObjectStub<Backend>,
) {
  if (request.method !== "POST") {
    return new Response("not found", { status: 404 });
  }
  if (
    request.headers.get("X-Telegram-Bot-Api-Secret-Token") !==
    env.WEBHOOK_SECRET
  ) {
    return new Response("bad request", { status: 400 });
  }

  const update = (await request.json()) as Update;
  console.log(update);

  if ("chat_join_request" in update) {
    if (update.chat_join_request.chat.type === "supergroup") {
      await backend.handleChatJoinRequest(update.chat_join_request);
    }
    return new Response("OK");
  }

  if ("my_chat_member" in update) {
    if (update.my_chat_member.chat.type === "supergroup") {
      await backend.updateChatPermission(
        update.my_chat_member.chat.id,
        checkChatMember(update.my_chat_member.new_chat_member),
      );
    }
    return new Response("OK");
  }

  if ("chat_member" in update) {
    if (update.chat_member.chat.type === "supergroup") {
      if (checkChatMember(update.chat_member.new_chat_member)) {
        await backend.addAdmin(
          update.chat_member.chat.id,
          update.chat_member.new_chat_member.user.id,
        );
      } else if (
        checkChatMember(update.chat_member.old_chat_member) &&
        !checkChatMember(update.chat_member.new_chat_member)
      ) {
        await backend.removeAdmin(
          update.chat_member.chat.id,
          update.chat_member.new_chat_member.user.id,
        );
      }
    }
    return new Response("OK");
  }

  if ("callback_query" in update) {
    const query = update.callback_query;
    if (!("data" in query) || !query.data) return new Response("OK");

    const action = decodeAdminActionCallbackData(query.data);
    if (!action) return new Response("OK");

    if (query.message?.chat.id && query.message.chat.id !== action.chat) {
      await api
        .answerCallbackQuery(env.BOT_TOKEN, {
          callback_query_id: query.id,
          text: "无效操作",
          show_alert: true,
        })
        .catch((e) => console.error("failed to answer callback query", e));
      return new Response("OK");
    }

    let isAdmin = false;
    try {
      const member = await api.getChatMember(env.BOT_TOKEN, {
        chat_id: action.chat,
        user_id: query.from.id,
      });
      isAdmin = checkChatMember(member);
      if (isAdmin) {
        await backend.addAdmin(action.chat, query.from.id);
      } else {
        await backend.removeAdmin(action.chat, query.from.id);
      }
    } catch (e) {
      console.error("failed to verify admin identity", e);
    }

    if (!isAdmin) {
      await api
        .answerCallbackQuery(env.BOT_TOKEN, {
          callback_query_id: query.id,
          text: "仅群管理员可执行该操作",
          show_alert: true,
        })
        .catch((e) => console.error("failed to answer callback query", e));
      return new Response("OK");
    }

    try {
      await backend.handleAdminAction(action.chat, action.user, action.action);
      await api.answerCallbackQuery(env.BOT_TOKEN, {
        callback_query_id: query.id,
        text: formatActionSuccessText(action.action.type),
      });
      if (query.message?.message_id) {
        await api
          .editMessageReplyMarkup(env.BOT_TOKEN, {
            chat_id: action.chat,
            message_id: query.message.message_id,
            reply_markup: withOpenAppButton(env.BOT_USERNAME),
          })
          .catch((e) =>
            console.error("failed to reset callback action buttons", e),
          );
      }
    } catch (e) {
      console.error("failed to process callback admin action", e);
      await api
        .answerCallbackQuery(env.BOT_TOKEN, {
          callback_query_id: query.id,
          text: `${e}`.includes("invalid join request")
            ? "该请求已处理或已过期"
            : "操作失败，请稍后重试",
          show_alert: true,
        })
        .catch((error) => console.error("failed to answer callback query", error));
    }
    return new Response("OK");
  }

  if ("message" in update) {
    if (update.message.chat.type !== "private" || !("text" in update.message)) {
      return new Response("OK");
    }

    const userId = update.message.from?.id;
    const messageText = update.message.text;

    if (messageText.startsWith("/start")) {
      return direct.sendMessage({
        chat_id: update.message.chat.id,
        text: "请点击下方按钮启动小程序",
        reply_markup: withOpenAppButton(env.BOT_USERNAME),
      });
    }

    if (!userId) return new Response("OK");

    try {
      const pending = await backend.getLatestPendingJoinRequest(userId);
      if (!pending) {
        return direct.sendMessage({
          chat_id: update.message.chat.id,
          text: "当前暂无待处理的加群请求，或请求已过期。",
          reply_markup: withOpenAppButton(env.BOT_USERNAME),
        });
      }

      await backend.handleUserAnswered(
        pending.id,
        userId,
        messageText,
        JSON.stringify({
          method: "direct_message",
          chat_id: update.message.chat.id,
        }),
      );

      return direct.sendMessage({
        chat_id: update.message.chat.id,
        text: `✅ 你申请加入「${pending.title}」的回答已收到，请等待管理员审核。`,
        reply_markup: withOpenAppButton(env.BOT_USERNAME),
      });
    } catch (e) {
      console.error("Error processing direct message answer", e);
      const answerValidationMessage = unwrapAnswerValidationMessage(e);
      if (answerValidationMessage) {
        return direct.sendMessage({
          chat_id: update.message.chat.id,
          text: answerValidationMessage,
        });
      }
      return direct.sendMessage({
        chat_id: update.message.chat.id,
        text: "提交失败，请稍后重试。",
      });
    }
  }

  return new Response("OK");
}

function formatActionSuccessText(
  action: "approved by admin" | "declined by admin" | "banned by admin",
) {
  switch (action) {
    case "approved by admin":
      return "已通过该入群请求";
    case "declined by admin":
      return "已拒绝该入群请求";
    case "banned by admin":
      return "已封禁并拒绝该入群请求";
  }
}

async function handleRpcRequest(
  request: Request,
  env: Env,
  backend: DurableObjectStub<Backend>,
) {
  if (request.method !== "POST") {
    return new Response("bad request", { status: 400 });
  }

  const initDataRaw = request.headers.get("X-Telegram-InitData");
  if (!initDataRaw) {
    return new Response("bad request", { status: 400 });
  }

  const initData = await validateTelegramMiniAppData(initDataRaw, env.BOT_TOKEN);
  if (!initData) {
    return new Response("forbidden", { status: 403 });
  }

  const rpcBody = await request.json();
  if (!RpcMethods.allows(rpcBody)) {
    return new Response("bad request: failed to parse request body", {
      status: 400,
    });
  }

  const rpc = rpcBody as RpcRequest;
  console.log(rpc);

  try {
    switch (rpc.method) {
      case "status":
        return buildResponse(await backend.getUserStatus(initData.user.id));
      case "updateChatConfig":
        if (!(await backend.checkChatAdmin(rpc.params.chat, initData.user.id))) {
          throw new Error("permission denied");
        }
        return buildResponse(
          await backend.updateChatConfig(rpc.params.chat, rpc.params.config),
        );
      case "answer":
        return buildResponse(
          await backend.handleUserAnswered(
            rpc.params.chat,
            initData.user.id,
            rpc.params.answer,
            JSON.stringify({
              headers: [...request.headers],
              cf: request.cf,
            }),
          ),
        );
      case "adminAction":
        return buildResponse(
          await backend.handleAdminAction(
            rpc.params.chat,
            rpc.params.user,
            rpc.params.action,
          ),
        );
      default:
        throw new Error(`unknown method: ${(rpc as { method: string }).method}`);
    }
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: stringifyError(e) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
}

async function handleFileRequest(
  pathname: string,
  env: Env,
  localVerifier: Encryptor,
) {
  const hashed_file_id = pathname.substring("/file/".length);
  let path;
  try {
    const file_id = await localVerifier.decrypt(hashed_file_id);
    path = await FileCache.wrap(file_id, async () => {
      const file = await api.getFile(env.BOT_TOKEN, { file_id });
      if (!file.file_path) throw new Error("file too big");
      return file.file_path;
    });
  } catch {
    return new Response("bad request", { status: 400 });
  }

  let response = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${path}`, {
    cf: { cacheTtl: 7200, cacheEverything: true },
  });

  if (response.status === 200) {
    response = new Response(response.body, response);
    response.headers.set("Cache-Control", "max-age=7200");
  }

  return response;
}

function buildResponse(result: unknown) {
  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const FileCache = WorkersCacheStorage.text("file");
FileCache.defaultTtl = 3600;

const RpcMethods = type({
  method: "'status'",
})
  .or({
    method: "'updateChatConfig'",
    params: { chat: "number", config: ChatConfig },
  })
  .or({
    method: "'answer'",
    params: { chat: "number", answer: "string" },
  })
  .or({
    method: "'adminAction'",
    params: { chat: "number", user: "number", action: AdminActionSchema },
  });

function stringifyError(error: unknown): string {
  return unwrapAnswerValidationMessage(error) ?? rawErrorMessage(error);
}

function unwrapAnswerValidationMessage(error: unknown): string | null {
  const message = rawErrorMessage(error);
  const index = message.indexOf(ANSWER_VALIDATION_ERROR_PREFIX);
  if (index < 0) {
    return null;
  }
  return message.slice(index + ANSWER_VALIDATION_ERROR_PREFIX.length);
}

function rawErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
