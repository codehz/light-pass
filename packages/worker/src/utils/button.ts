import type { AdminAction } from "../../../shared/src/contracts";

export function withOpenAppButton(botname: string) {
  return {
    inline_keyboard: [
      [{ text: "启动小程序", url: `https://t.me/${botname}?startapp` }],
    ],
  };
}

const AdminActionCode = {
  "approved by admin": "ap",
  "declined by admin": "dc",
  "banned by admin": "bn",
} as const satisfies Record<AdminAction["type"], string>;

const AdminActionFromCode = {
  ap: "approved by admin",
  dc: "declined by admin",
  bn: "banned by admin",
} as const satisfies Record<string, AdminAction["type"]>;

const ADMIN_ACTION_PREFIX = "lp_admin";

export function encodeAdminActionCallbackData(
  chat: number,
  user: number,
  action: AdminAction["type"],
) {
  return `${ADMIN_ACTION_PREFIX}:${chat}:${user}:${AdminActionCode[action]}`;
}

export function decodeAdminActionCallbackData(data: string): {
  chat: number;
  user: number;
  action: AdminAction;
} | null {
  const [prefix, chat, user, actionCode] = data.split(":");
  if (prefix !== ADMIN_ACTION_PREFIX) return null;

  const chatId = Number(chat);
  const userId = Number(user);
  const actionType = AdminActionFromCode[actionCode as keyof typeof AdminActionFromCode];
  if (!Number.isSafeInteger(chatId) || !Number.isSafeInteger(userId) || !actionType) {
    return null;
  }

  return {
    chat: chatId,
    user: userId,
    action: { type: actionType },
  };
}

export function withAnswerActionButtons(
  botname: string,
  chat: number,
  user: number,
) {
  return {
    inline_keyboard: [
      [
        {
          text: "通过",
          callback_data: encodeAdminActionCallbackData(
            chat,
            user,
            "approved by admin",
          ),
        },
        {
          text: "拒绝",
          callback_data: encodeAdminActionCallbackData(
            chat,
            user,
            "declined by admin",
          ),
        },
        {
          text: "封禁",
          callback_data: encodeAdminActionCallbackData(chat, user, "banned by admin"),
        },
      ],
      [{ text: "启动小程序", url: `https://t.me/${botname}?startapp` }],
    ],
  };
}
