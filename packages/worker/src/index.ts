import { Update } from "@telegraf/types";
import { type } from "arktype";
import type { RpcRequest } from "../../shared/src/contracts";
import type { Backend } from "./Backend";
import { WorkersCacheStorage } from "workers-cache-storage";
import { api, direct } from "./api";
import { ChatConfig } from "./db";
import { withOpenAppButton } from "./utils/button";
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
      return new Response("OK");
    }
  }

  return new Response("OK");
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
    return new Response(JSON.stringify({ ok: false, error: `${e}` }), {
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
