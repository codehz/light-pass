import { type } from "arktype";
import { DurableObject } from "cloudflare:workers";
import { api } from "./api";
import {
  decideAlarm,
  decideReset,
  pickLatestTask,
  scheduleAtLeastNow,
  shouldScheduleOnNotify,
} from "./services/LooperState";
import { withOpenAppButton } from "./utils/button";

const MIN_NOTIFY_INTERVAL_MS = 10_000;
const SEND_RETRY_MS = 5_000;
const STATE_VERSION = 2;
const TASK_PREFIX = "task:";
const LEGACY_USER_PREFIX = "user:";
const KEY_LAST = "last";
const KEY_NEXT_ALLOWED_AT = "nextAllowedAt";
const KEY_STATE_VERSION = "stateVersion";

const Task = type({
  chat: "number",
  text: "string",
  user: "number",
  updatedAt: "number",
});
type Task = typeof Task.infer;

const Last = type({
  chat: "number",
  message: "number",
  user: "number",
});
type Last = typeof Last.infer;

export class Looper extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async notify(chat: number, text: string, user: number): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async () => {
      await this.#ensureStateVersion();
      const now = Date.now();
      const key = this.#taskKey(user);
      const existing = await this.ctx.storage.get(key);
      if (Task.allows(existing)) {
        this.#log("keep", {
          reason: "duplicate_task",
          latestUser: user,
          lastUser: (await this.#readLast())?.user,
          taskCount: (await this.#listTasks()).length,
        });
        return;
      }

      await this.ctx.storage.put(key, {
        chat,
        text,
        user,
        updatedAt: now,
      } satisfies Task);

      const [tasks, last, nextAllowedAt] = await Promise.all([
        this.#listTasks(),
        this.#readLast(),
        this.#readNextAllowedAt(),
      ]);
      const latest = pickLatestTask(tasks);
      if (!latest) {
        return;
      }
      if (!shouldScheduleOnNotify(last?.user, latest.user)) {
        await this.ctx.storage.deleteAlarm();
        this.#log("keep", {
          reason: "already_displaying_latest_user",
          latestUser: latest.user,
          lastUser: last?.user,
          nextAllowedAt,
          taskCount: tasks.length,
        });
        return;
      }

      const alarmAt = await this.#scheduleAlarm(
        scheduleAtLeastNow(now, nextAllowedAt),
      );
      this.#log("reschedule", {
        reason: "notify_new_latest_user",
        latestUser: latest.user,
        lastUser: last?.user,
        nextAllowedAt,
        alarmAt,
        taskCount: tasks.length,
      });
    });
  }

  async reset(chat: number, user: number): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async () => {
      await this.#ensureStateVersion();
      await this.ctx.storage.delete(this.#taskKey(user));

      const [tasks, last, nextAllowedAt] = await Promise.all([
        this.#listTasks(),
        this.#readLast(),
        this.#readNextAllowedAt(),
      ]);
      const latest = pickLatestTask(tasks);
      const now = Date.now();
      const decision = decideReset({
        latestUser: latest?.user,
        lastUser: last?.user,
        resetUser: user,
        now,
        nextAllowedAt,
      });

      if (decision.action === "cleanup") {
        await this.ctx.storage.deleteAlarm();
        if (last) {
          await this.#deleteMessage(last);
        }
        await this.ctx.storage.delete(KEY_LAST);
        await this.ctx.storage.delete(KEY_NEXT_ALLOWED_AT);
        this.#log("cleanup", {
          reason: "all_tasks_removed_by_reset",
          chat,
          latestUser: latest?.user,
          lastUser: last?.user,
          nextAllowedAt,
          taskCount: tasks.length,
        });
        return;
      }

      if (decision.action === "keep") {
        await this.ctx.storage.deleteAlarm();
        this.#log("keep", {
          reason: "latest_matches_current_after_reset",
          latestUser: latest?.user,
          lastUser: last?.user,
          nextAllowedAt,
          taskCount: tasks.length,
        });
        return;
      }

      const alarmAt = await this.#scheduleAlarm(decision.at);
      this.#log("reschedule", {
        reason:
          last?.user === user
            ? "current_user_reset_switch_pending"
            : "latest_differs_from_current_after_reset",
        latestUser: latest?.user,
        lastUser: last?.user,
        nextAllowedAt,
        alarmAt,
        taskCount: tasks.length,
      });
    });
  }

  async alarm(): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async () => {
      await this.#ensureStateVersion();
      const [tasks, last, nextAllowedAt] = await Promise.all([
        this.#listTasks(),
        this.#readLast(),
        this.#readNextAllowedAt(),
      ]);
      const latest = pickLatestTask(tasks);
      const now = Date.now();
      const decision = decideAlarm({
        latestUser: latest?.user,
        lastUser: last?.user,
        now,
        nextAllowedAt,
      });

      if (decision.action === "cleanup") {
        await this.ctx.storage.deleteAlarm();
        if (last) {
          await this.#deleteMessage(last);
        }
        await this.ctx.storage.delete(KEY_LAST);
        await this.ctx.storage.delete(KEY_NEXT_ALLOWED_AT);
        this.#log("cleanup", {
          latestUser: undefined,
          lastUser: last?.user,
          nextAllowedAt,
          taskCount: tasks.length,
        });
        return;
      }

      if (decision.action === "keep") {
        await this.ctx.storage.deleteAlarm();
        this.#log("keep", {
          reason: "latest_already_visible",
          latestUser: latest?.user,
          lastUser: last?.user,
          nextAllowedAt,
          taskCount: tasks.length,
        });
        return;
      }

      if (decision.action === "reschedule") {
        const alarmAt = await this.#scheduleAlarm(decision.at);
        this.#log("reschedule", {
          reason: "respect_min_interval",
          latestUser: latest?.user,
          lastUser: last?.user,
          nextAllowedAt,
          alarmAt,
          taskCount: tasks.length,
        });
        return;
      }

      if (!latest) {
        return;
      }

      try {
        const message = await api.sendMessage(this.env.BOT_TOKEN, {
          chat_id: latest.chat,
          text: latest.text,
          parse_mode: "MarkdownV2",
          reply_markup: withOpenAppButton(this.env.BOT_USERNAME),
        });
        const next = Date.now() + MIN_NOTIFY_INTERVAL_MS;
        await this.ctx.storage.put(KEY_LAST, {
          chat: latest.chat,
          message: message.message_id,
          user: latest.user,
        } satisfies Last);
        await this.ctx.storage.put(KEY_NEXT_ALLOWED_AT, next);
        await this.ctx.storage.deleteAlarm();
        if (last) {
          await this.#deleteMessage(last);
        }
        this.#log("send", {
          latestUser: latest.user,
          lastUser: last?.user,
          nextAllowedAt: next,
          taskCount: tasks.length,
        });
      } catch (error) {
        const alarmAt = await this.#scheduleAlarm(Date.now() + SEND_RETRY_MS);
        console.error("looper send failed", {
          error,
          user: latest.user,
          chat: latest.chat,
        });
        this.#log("retry", {
          latestUser: latest.user,
          lastUser: last?.user,
          nextAllowedAt,
          alarmAt,
          taskCount: tasks.length,
        });
      }
    });
  }

  async #ensureStateVersion() {
    const stateVersion = this.#toNumber(await this.ctx.storage.get(KEY_STATE_VERSION));
    if (stateVersion === STATE_VERSION || (stateVersion != null && stateVersion > STATE_VERSION)) {
      return;
    }

    const legacyTask = await this.ctx.storage.get("task");
    const legacyUsers = await this.ctx.storage.list({ prefix: LEGACY_USER_PREFIX });
    const hasLegacy = legacyTask != null || legacyUsers.size > 0;
    if (hasLegacy) {
      await this.ctx.storage.delete("task");
      for (const key of legacyUsers.keys()) {
        await this.ctx.storage.delete(key);
      }

      const last = await this.#readLast();
      if (last) {
        await this.#deleteMessage(last);
      }
      await this.ctx.storage.delete(KEY_LAST);
      await this.ctx.storage.delete(KEY_NEXT_ALLOWED_AT);
      await this.ctx.storage.deleteAlarm();
      console.warn("looper migrated from legacy state", {
        legacyUserCount: legacyUsers.size,
      });
    }

    await this.ctx.storage.put(KEY_STATE_VERSION, STATE_VERSION);
  }

  async #listTasks(): Promise<Task[]> {
    const map = await this.ctx.storage.list({ prefix: TASK_PREFIX });
    const tasks: Task[] = [];
    for (const [key, raw] of map) {
      if (Task.allows(raw)) {
        tasks.push(raw);
      } else {
        console.warn("looper invalid task payload, deleting", { key, raw });
        await this.ctx.storage.delete(key);
      }
    }
    return tasks;
  }

  async #readLast(): Promise<Last | undefined> {
    const last = await this.ctx.storage.get(KEY_LAST);
    if (Last.allows(last)) {
      return last;
    }
    if (last != null) {
      console.warn("looper invalid last payload, deleting", { last });
      await this.ctx.storage.delete(KEY_LAST);
    }
    return undefined;
  }

  async #readNextAllowedAt(): Promise<number | undefined> {
    const raw = await this.ctx.storage.get(KEY_NEXT_ALLOWED_AT);
    const value = this.#toNumber(raw);
    if (value == null) {
      if (raw != null) {
        console.warn("looper invalid nextAllowedAt payload, deleting", { raw });
        await this.ctx.storage.delete(KEY_NEXT_ALLOWED_AT);
      }
      return undefined;
    }
    return value;
  }

  async #scheduleAlarm(at: number): Promise<number> {
    const expected = Math.max(Date.now(), Math.floor(at));
    const current = this.#toNumber(await this.ctx.storage.getAlarm());
    if (current == null || current > expected) {
      await this.ctx.storage.setAlarm(expected);
      return expected;
    }
    return current;
  }

  async #deleteMessage(last: Last): Promise<void> {
    try {
      await api.deleteMessage(this.env.BOT_TOKEN, {
        chat_id: last.chat,
        message_id: last.message,
      });
    } catch (error) {
      console.error("looper delete failed", {
        error,
        chat: last.chat,
        message: last.message,
        user: last.user,
      });
    }
  }

  #taskKey(user: number) {
    return `${TASK_PREFIX}${user}`;
  }

  #toNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    return undefined;
  }

  #log(
    action: "send" | "keep" | "reschedule" | "cleanup" | "retry",
    payload: {
      chat?: number;
      latestUser?: number;
      lastUser?: number;
      nextAllowedAt?: number;
      alarmAt?: number;
      taskCount: number;
      reason?: string;
    },
  ) {
    console.log("looper", {
      action,
      ...payload,
    });
  }
}
