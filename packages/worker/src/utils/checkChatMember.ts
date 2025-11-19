import { ChatMember } from "@telegraf/types";

export function checkChatMember(member: ChatMember) {
  return (
    member.status === "creator" ||
    (member.status === "administrator" && member.can_invite_users)
  );
}