import { describe, expect, it } from "bun:test";
import {
  decideAlarm,
  decideReset,
  pickLatestTask,
  scheduleAtLeastNow,
  shouldScheduleOnNotify,
} from "../src/services/LooperState";

describe("looper state", () => {
  it("picks latest task by updatedAt", () => {
    const latest = pickLatestTask([
      { user: 1, updatedAt: 1000 },
      { user: 2, updatedAt: 2000 },
      { user: 3, updatedAt: 1500 },
    ]);
    expect(latest?.user).toBe(2);
  });

  it("schedules at least now", () => {
    expect(scheduleAtLeastNow(100, undefined)).toBe(100);
    expect(scheduleAtLeastNow(100, 50)).toBe(100);
    expect(scheduleAtLeastNow(100, 150)).toBe(150);
  });

  it("schedules notify when latest user differs from current", () => {
    expect(shouldScheduleOnNotify(undefined, 1)).toBe(true);
    expect(shouldScheduleOnNotify(1, 2)).toBe(true);
    expect(shouldScheduleOnNotify(1, 1)).toBe(false);
  });

  it("decides alarm cleanup when no task exists", () => {
    expect(
      decideAlarm({
        latestUser: undefined,
        lastUser: 1,
        now: 1000,
        nextAllowedAt: 2000,
      }),
    ).toEqual({ action: "cleanup" });
  });

  it("decides alarm keep when latest is already visible", () => {
    expect(
      decideAlarm({
        latestUser: 1,
        lastUser: 1,
        now: 1000,
        nextAllowedAt: 2000,
      }),
    ).toEqual({ action: "keep" });
  });

  it("decides alarm reschedule when interval has not elapsed", () => {
    expect(
      decideAlarm({
        latestUser: 2,
        lastUser: 1,
        now: 1000,
        nextAllowedAt: 2000,
      }),
    ).toEqual({ action: "reschedule", at: 2000 });
  });

  it("decides alarm send when interval elapsed", () => {
    expect(
      decideAlarm({
        latestUser: 2,
        lastUser: 1,
        now: 2500,
        nextAllowedAt: 2000,
      }),
    ).toEqual({ action: "send" });
  });

  it("decides reset cleanup when no remaining tasks", () => {
    expect(
      decideReset({
        latestUser: undefined,
        lastUser: 1,
        resetUser: 1,
        now: 1000,
        nextAllowedAt: 2000,
      }),
    ).toEqual({ action: "cleanup" });
  });

  it("decides reset reschedule when current visible user is reset", () => {
    expect(
      decideReset({
        latestUser: 2,
        lastUser: 1,
        resetUser: 1,
        now: 1000,
        nextAllowedAt: 2000,
      }),
    ).toEqual({ action: "reschedule", at: 2000 });
  });

  it("decides reset reschedule when no visible message exists", () => {
    expect(
      decideReset({
        latestUser: 2,
        lastUser: undefined,
        resetUser: 1,
        now: 1000,
        nextAllowedAt: undefined,
      }),
    ).toEqual({ action: "reschedule", at: 1000 });
  });

  it("decides reset keep when latest still matches current visible user", () => {
    expect(
      decideReset({
        latestUser: 2,
        lastUser: 2,
        resetUser: 1,
        now: 1000,
        nextAllowedAt: 2000,
      }),
    ).toEqual({ action: "keep" });
  });
});
