import { type } from "arktype";
import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { api, BotError } from "./api";
import { ChatConfig } from "./db";
import { withOpenAppButton } from "./utils/button";

export type VerifyUserParams = {
  chat: number;
  user: number;
  userChatId: number;
  config: ChatConfig;
  deadline: Date;
};

export const AdminAction = type({ type: "'approved by admin'" })
  .or({ type: "'declined by admin'" })
  .or({ type: "'banned by admin'" });

export type AdminAction = typeof AdminAction.infer;

export class VerifyUser extends WorkflowEntrypoint<Env, VerifyUserParams> {
  async run(
    event: Readonly<WorkflowEvent<VerifyUserParams>>,
    step: WorkflowStep,
  ) {
    const botId = this.env.BOT_TOKEN.split(":")[0];
    const id: DurableObjectId = this.env.BACKEND.idFromName(botId);
    const Backend = this.env.BACKEND.get(id);
    await step.do("Send message to user (wrapper)", async () => {
      try {
        await step.do(
          "Send message to user",
          {
            retries: {
              delay: `1 seconds`,
              limit: 5,
              backoff: "linear",
            },
          },
          async () => {
            try {
              await api.sendMessage(this.env.BOT_TOKEN, {
                chat_id: event.payload.userChatId,
                text: event.payload.config.prompt.text_in_private,
                reply_markup: withOpenAppButton(this.env.BOT_USERNAME),
              });
            } catch (e) {
              if (e instanceof BotError && e.retry_after == null) {
                throw new NonRetryableError(e.message);
              }
              throw e;
            }
          },
        );
      } catch (e) {
        console.error("failed to send message to user", e);
      }
    });
    await step.do("Notify chat loop", async () => {
      const id = this.env.LOOPER.idFromName(`${event.payload.chat}`);
      await this.env.LOOPER.get(id).notify(
        event.payload.chat,
        event.payload.config.prompt.text_in_group,
        event.payload.user,
      );
    });
    try {
      const adminAction = step.waitForEvent<AdminAction>(
        "Wait for admin action",
        { type: "admin_action" },
      );
      const waitResult = await step.do("Wait for user action or timeout", () =>
        Promise.race([
          step
            .waitForEvent<{
              answer: string;
              details: string;
              question: string;
            }>("Wait for user answer", {
              type: "user_answer",
            })
            .then(({ payload: answer }) => ({ answer })),
          step
            .sleepUntil("User answer timeout", event.payload.deadline)
            .then((timeout) => ({ timeout })),
          adminAction.then((action) => ({ action })),
        ]),
      );
      if ("timeout" in waitResult) {
        await step.do("Decline user on timeout", async () => {
          try {
            await api.declineChatJoinRequest(this.env.BOT_TOKEN, {
              chat_id: event.payload.chat,
              user_id: event.payload.user,
            });
          } catch (e) {
            if (e instanceof BotError && e.code === 400)
              throw new NonRetryableError(e.message);
            throw e;
          }
        });
        return;
      }
      if ("answer" in waitResult) {
        await step.do("Notify user answered", async () => {
          try {
            const name = await Backend.getChatTitle(event.payload.user);
            await api.sendMessage(this.env.BOT_TOKEN, {
              chat_id: event.payload.chat,
              text: `用户${name}回答：\n${waitResult.answer.answer}`,
              reply_markup: withOpenAppButton(this.env.BOT_USERNAME),
            });
          } catch {}
        });
      }
      const approvedResult = await adminAction;
      switch (approvedResult.payload.type) {
        case "approved by admin":
          await step.do("Approve user", async () => {
            try {
              await api.approveChatJoinRequest(this.env.BOT_TOKEN, {
                chat_id: event.payload.chat,
                user_id: event.payload.user,
              });
            } catch (e) {
              if (e instanceof BotError) {
                if (e.message.includes("USER_ALREADY_PARTICIPANT")) return;
                if (e.code === 400) throw new NonRetryableError(e.message);
              }
              throw e;
            }
          });
          await step.do("Send message to group", async () => {
            await api.sendMessage(this.env.BOT_TOKEN, {
              chat_id: event.payload.chat,
              text: event.payload.config.welcome,
            });
          });
          return;
        case "declined by admin":
          await step.do("Decline user", async () => {
            try {
              await api.declineChatJoinRequest(this.env.BOT_TOKEN, {
                chat_id: event.payload.chat,
                user_id: event.payload.user,
              });
            } catch (e) {
              if (e instanceof BotError && e.code === 400)
                throw new NonRetryableError(e.message);
              throw e;
            }
          });
          return;
        case "banned by admin":
          await step.do("Decline user", async () => {
            try {
              await api.declineChatJoinRequest(this.env.BOT_TOKEN, {
                chat_id: event.payload.chat,
                user_id: event.payload.user,
              });
            } catch (e) {
              if (e instanceof BotError && e.code === 400)
                throw new NonRetryableError(e.message);
              throw e;
            }
          });
          await step.do("Ban user", async () => {
            try {
              await api.banChatMember(this.env.BOT_TOKEN, {
                chat_id: event.payload.chat,
                user_id: event.payload.user,
              });
            } catch (e) {
              if (e instanceof BotError && e.code === 400)
                throw new NonRetryableError(e.message);
              throw e;
            }
          });
          return;
      }
    } finally {
      await step.do("Reset looper", async () => {
        const id = this.env.LOOPER.idFromName(`${event.payload.chat}`);
        await this.env.LOOPER.get(id).reset(
          event.payload.chat,
          event.payload.user,
        );
      });
      await step.do("Reset request", async () => {
        await Backend.removeJoinRequest(event.payload.chat, event.payload.user);
      });
    }
  }
}
