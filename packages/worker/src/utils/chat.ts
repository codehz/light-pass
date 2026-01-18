import type { ChatFullInfo } from "@telegraf/types";

export function getChatTitle(chat: ChatFullInfo) {
  switch (chat.type) {
    case "channel":
    case "group":
    case "supergroup":
      return chat.title;
    case "private":
      return chat.first_name + (chat.last_name ? ` ${chat.last_name}` : "");
  }
}

export function getChatInviteLink(chat: ChatFullInfo) {
  if ("invite_link" in chat && chat.invite_link) {
    return chat.invite_link;
  }
  if (chat.username) {
    return `https://t.me/${chat.username}`;
  }
  return undefined;
}
