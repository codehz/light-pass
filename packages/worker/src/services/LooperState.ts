export type LooperTaskLike = {
  user: number;
  updatedAt: number;
};

export type AlarmDecision =
  | { action: "cleanup" }
  | { action: "keep" }
  | { action: "reschedule"; at: number }
  | { action: "send" };

export type ResetDecision =
  | { action: "cleanup" }
  | { action: "keep" }
  | { action: "reschedule"; at: number };

export function pickLatestTask<T extends LooperTaskLike>(
  tasks: readonly T[],
): T | undefined {
  let latest: T | undefined;
  for (const task of tasks) {
    if (!latest || task.updatedAt > latest.updatedAt) {
      latest = task;
    }
  }
  return latest;
}

export function scheduleAtLeastNow(
  now: number,
  nextAllowedAt: number | undefined,
): number {
  return Math.max(now, nextAllowedAt ?? now);
}

export function shouldScheduleOnNotify(
  lastUser: number | undefined,
  latestUser: number,
) {
  return lastUser == null || lastUser !== latestUser;
}

export function decideAlarm(params: {
  latestUser: number | undefined;
  lastUser: number | undefined;
  now: number;
  nextAllowedAt: number | undefined;
}): AlarmDecision {
  const { latestUser, lastUser, now, nextAllowedAt } = params;
  if (latestUser == null) {
    return { action: "cleanup" };
  }
  if (lastUser === latestUser) {
    return { action: "keep" };
  }
  if (nextAllowedAt != null && now < nextAllowedAt) {
    return { action: "reschedule", at: nextAllowedAt };
  }
  return { action: "send" };
}

export function decideReset(params: {
  latestUser: number | undefined;
  lastUser: number | undefined;
  resetUser: number;
  now: number;
  nextAllowedAt: number | undefined;
}): ResetDecision {
  const { latestUser, lastUser, resetUser, now, nextAllowedAt } = params;
  if (latestUser == null) {
    return { action: "cleanup" };
  }
  if (lastUser === resetUser) {
    return {
      action: "reschedule",
      at: scheduleAtLeastNow(now, nextAllowedAt),
    };
  }
  if (lastUser == null || latestUser !== lastUser) {
    return {
      action: "reschedule",
      at: scheduleAtLeastNow(now, nextAllowedAt),
    };
  }
  return { action: "keep" };
}
