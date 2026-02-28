import { describe, expect, it, mock } from "bun:test";
import type { ChatJoinRequest } from "@telegraf/types";
import type { ChatConfig } from "../../shared/src/contracts";
import {
  handleJoinRequestByMode,
  orchestrateFormJoinRequest,
  pickLatestPendingRequest,
  resolveJoinRequestMode,
} from "../src/services/JoinRequestFlow";

const config: ChatConfig = {
  question: "why",
  welcome: "welcome",
  timeout: 600,
  prompt: {
    text_in_private: "private",
    text_in_group: "group",
  },
  response_template: "resp",
  answer_constraints: {
    max_length: 500,
    min_lines: 1,
  },
};

function buildRequest(): ChatJoinRequest {
  return {
    chat: {
      id: -10001,
      type: "supergroup",
      title: "Test Chat",
    },
    from: {
      id: 42,
      is_bot: false,
      first_name: "Test",
      last_name: "User",
      username: "test_user",
    },
    user_chat_id: 4200,
    date: Math.floor(Date.now() / 1000),
    bio: "hello",
    invite_link: undefined,
  } as ChatJoinRequest;
}

describe("join request flow", () => {
  it("resolves FORM/PASS/IGNORE modes", () => {
    expect(resolveJoinRequestMode(null)).toBe("IGNORE");
    expect(
      resolveJoinRequestMode({ id: 1, mode: "IGNORE", config }),
    ).toBe("IGNORE");
    expect(resolveJoinRequestMode({ id: 1, mode: "PASS", config })).toBe(
      "PASS",
    );
    expect(resolveJoinRequestMode({ id: 1, mode: "FORM", config })).toBe(
      "FORM",
    );
  });

  it("dispatches PASS mode without invoking FORM flow", async () => {
    const onPass = mock(async () => {});
    const onForm = mock(async () => {});
    await handleJoinRequestByMode(buildRequest(), { id: 1, mode: "PASS", config }, {
      onPass,
      onForm,
    });
    expect(onPass).toHaveBeenCalledTimes(1);
    expect(onForm).toHaveBeenCalledTimes(0);
  });

  it("ignores request when chat config is missing", async () => {
    const onPass = mock(async () => {});
    const onForm = mock(async () => {});
    await handleJoinRequestByMode(buildRequest(), { id: 1, mode: "FORM", config: null }, {
      onPass,
      onForm,
    });
    expect(onPass).toHaveBeenCalledTimes(0);
    expect(onForm).toHaveBeenCalledTimes(0);
  });

  it("creates workflow for FORM mode", async () => {
    const request = buildRequest();
    const calls: string[] = [];

    const result = await orchestrateFormJoinRequest(request, { id: 1, config }, {
      createWorkflowId: () => "wf-new",
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      clearJoinResponse: async () => {
        calls.push("clear");
      },
      findExistingJoinRequest: async () => {
        calls.push("find");
        return null;
      },
      terminateExistingWorkflow: async () => {
        calls.push("terminate");
      },
      upsertJoinRequest: async (payload) => {
        calls.push(`upsert:${payload.workflowId}`);
      },
      createWorkflow: async (workflowId, payload) => {
        calls.push(`create:${workflowId}:${payload.deadline}`);
      },
    });

    expect(result.workflowId).toBe("wf-new");
    expect(calls).toEqual([
      "clear",
      "find",
      "upsert:wf-new",
      "create:wf-new:1767226200000",
    ]);
  });

  it("terminates previous workflow when request already exists", async () => {
    const request = buildRequest();
    const terminated: string[] = [];

    await orchestrateFormJoinRequest(request, { id: 1, config }, {
      createWorkflowId: () => "wf-next",
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      clearJoinResponse: async () => {},
      findExistingJoinRequest: async () => ({ workflowId: "wf-old" }),
      terminateExistingWorkflow: async (workflowId) => {
        terminated.push(workflowId);
      },
      upsertJoinRequest: async () => {},
      createWorkflow: async () => {},
    });

    expect(terminated).toEqual(["wf-old"]);
  });

  it("picks latest pending request by date", () => {
    const oldest = { date: new Date("2025-01-01T00:00:00.000Z") };
    const middleAnswered = {
      date: new Date("2025-01-02T00:00:00.000Z"),
      Response: { ok: true },
    };
    const latest = { date: new Date("2025-01-03T00:00:00.000Z") };

    const selected = pickLatestPendingRequest([oldest, middleAnswered, latest]);
    expect(selected).toBe(latest);
  });
});
