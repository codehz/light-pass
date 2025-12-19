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

/**
 * 验证用户加入群组请求的工作流参数
 */
export type VerifyUserParams = {
  chat: number; // 群组 ID
  user: number; // 用户 ID
  userChatId: number; // 用户 chat ID (用于发送消息)
  config: ChatConfig; // 群组配置
  deadline: number; // 截止时间戳
};

/**
 * 管理员操作类型
 */
export const AdminAction = type({ type: "'approved by admin'" })
  .or({ type: "'declined by admin'" })
  .or({ type: "'banned by admin'" });

export type AdminAction = typeof AdminAction.infer;

/**
 * VerifyUser 工作流类，用于处理 Telegram 群组加入请求的验证流程
 * 该工作流管理用户回答问题、管理员审批以及超时处理
 */
export class VerifyUser extends WorkflowEntrypoint<Env, VerifyUserParams> {
  /**
   * 执行验证工作流的主要方法
   * @param event 工作流事件，包含参数
   * @param step 工作流步骤工具
   */
  async run(
    event: Readonly<WorkflowEvent<VerifyUserParams>>,
    step: WorkflowStep,
  ) {
    // 从 BOT_TOKEN 中提取机器人 ID，用于创建 Durable Object ID
    const botId = this.env.BOT_TOKEN.split(":")[0];
    // 创建 Backend Durable Object 的 ID 和实例，用于数据操作
    const id: DurableObjectId = this.env.BACKEND.idFromName(botId);
    const Backend = this.env.BACKEND.get(id);
    // 发送消息给用户（包装步骤），包含重试逻辑
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
              // 向用户私聊发送提示消息，并附加打开 Mini App 的按钮
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
    // 通知群组循环器，发送通知消息到群组
    await step.do("Notify chat loop", async () => {
      const id = this.env.LOOPER.idFromName(`${event.payload.chat}`);
      await this.env.LOOPER.get(id).notify(
        event.payload.chat,
        event.payload.config.prompt.text_in_group,
        event.payload.user,
      );
    });
    let groupMessageId: number | undefined = undefined;
    try {
      // 等待管理员操作事件
      const adminAction = step.waitForEvent<AdminAction>(
        "Wait for admin action",
        { type: "admin_action" },
      );
      // 等待用户回答、超时或管理员操作
      const waitResult = await step.do("Wait for user action or timeout", () =>
        Promise.race([
          // 等待用户回答事件
          step
            .waitForEvent<{
              answer: string;
              details: string;
              question: string;
            }>("Wait for user answer", {
              type: "user_answer",
            })
            .then(({ payload: answer }) => ({ answer })),
          // 等待超时
          step
            .sleepUntil("User answer timeout", event.payload.deadline)
            .then((timeout) => ({ timeout })),
          // 等待管理员操作
          adminAction.then((action) => ({ action })),
        ]),
      );
      // 如果超时，拒绝用户加入请求
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
      // 如果用户回答了，通知群组
      if ("answer" in waitResult) {
        groupMessageId = await step.do("Notify user answered", async () => {
          try {
            // 获取用户名称
            const name = await Backend.getChatTitle(event.payload.user);
            // 发送用户回答到群组
            const sent = await api.sendMessage(this.env.BOT_TOKEN, {
              chat_id: event.payload.chat,
              text: `用户${name}回答：\n${waitResult.answer.answer}`,
              reply_markup: withOpenAppButton(this.env.BOT_USERNAME),
            });
            return sent.message_id;
          } catch (e) {
            console.error("failed to notify user answer to group", e);
          }
        });
      }
      // 获取管理员操作结果
      const approvedResult = await adminAction;
      // 根据管理员操作类型处理
      switch (approvedResult.payload.type) {
        case "approved by admin":
          // 批准用户加入
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
          // 发送欢迎消息到群组
          await step.do("Send message to group", async () => {
            await api.sendMessage(this.env.BOT_TOKEN, {
              chat_id: event.payload.chat,
              text: event.payload.config.welcome,
            });
          });
          break;
        case "declined by admin":
          // 拒绝用户加入
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
          break;
        case "banned by admin":
          // 拒绝并封禁用户
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
          break;
      }
    } finally {
      // 清理步骤：无论结果如何都要执行
      // 重置循环器状态
      await step.do("Reset looper", async () => {
        const id = this.env.LOOPER.idFromName(`${event.payload.chat}`);
        await this.env.LOOPER.get(id).reset(
          event.payload.chat,
          event.payload.user,
        );
      });
      // 从数据库中移除加入请求
      await step.do("Reset request", async () => {
        await Backend.removeJoinRequest(event.payload.chat, event.payload.user);
      });
      // 如果有群组消息，删除它
      if (groupMessageId) {
        await step.do("Delete group message", async () => {
          try {
            await api.deleteMessage(this.env.BOT_TOKEN, {
              chat_id: event.payload.chat,
              message_id: groupMessageId!,
            });
          } catch (e) {
            console.error("failed to delete group message", e);
          }
        });
      }
    }
  }
}
