import { type } from "arktype";
import { DurableObject } from "cloudflare:workers";
import { api } from "./api";
import { withOpenAppButton } from "./utils/button";

const Task = type({
  chat: "number",
  text: "string",
  user: "number",
});

const Last = type({
  chat: "number",
  message: "number",
  user: "number",
});

export class Looper extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }
  async notify(chat: number, text: string, user: number) {
    await this.ctx.storage.transaction(async (tx) => {
      await tx.put("task", { chat, text, user });
      await tx.put(`user:${user}`, {});
      const alarm = await tx.getAlarm();
      if (alarm == null) {
        await tx.setAlarm(new Date());
      }
    });
  }
  async reset(chat: number, user: number) {
    await this.ctx.storage.transaction(async (tx) => {
      await tx.delete(`user:${user}`);
      const map = await tx.list({ prefix: "user:" });
      if (map.size === 0) {
        await tx.deleteAlarm();
        await this.#deleteOldMessage(tx, await tx.get("last"));
      }
    });
  }
  async #deleteOldMessage(tx: DurableObjectTransaction, last: unknown) {
    if (Last.allows(last)) {
      try {
        console.log("delete old message", last);
        await api
          .deleteMessage(this.env.BOT_TOKEN, {
            chat_id: last.chat,
            message_id: last.message,
          })
          .catch(console.error);
        return last;
      } finally {
        await tx.delete("last");
      }
    } else {
      console.log("invalid last message", last);
      return undefined;
    }
  }
  async #sendMessage(
    chat: number,
    tx: DurableObjectTransaction,
    user: number,
    text: string,
  ) {
    console.log("send message", chat, user, text);
    const message = await api.sendMessage(this.env.BOT_TOKEN, {
      chat_id: chat,
      text,
      reply_markup: withOpenAppButton(this.env.BOT_USERNAME),
    });
    console.log("sent message", message);
    await tx.put("last", {
      chat,
      message: message.message_id,
      user,
    });
  }
  async alarm(): Promise<void> {
    await this.ctx.storage.transaction(async (tx) => {
      const last = await this.#deleteOldMessage(tx, await tx.get("last"));
      const task = await tx.get("task");
      console.log({ last, task });
      if (!Task.allows(task) || last?.user === task.user) {
        console.log("no task or last message is from same user");
        return;
      }
      await this.#sendMessage(task.chat, tx, task.user, task.text);
      await tx.setAlarm(Date.now() + 1000 * 10);
    });
  }
}
