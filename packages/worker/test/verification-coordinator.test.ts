import { describe, expect, it, mock } from "bun:test";
import { VerificationCoordinator } from "../src/services/VerificationCoordinator";

describe("verification coordinator", () => {
  it("forwards workflow events", async () => {
    const sendEvent = mock(async () => {});
    const terminate = mock(async () => {});
    const get = mock(async () => ({ sendEvent, terminate }));
    const create = mock(async () => {});

    const coordinator = new VerificationCoordinator({
      get,
      create,
    } as unknown as Env["VERIFY"]);

    await coordinator.sendUserAnswer("wf-1", {
      answer: "a",
      details: "d",
      question: "q",
    });
    await coordinator.sendAdminAction("wf-1", { type: "approved by admin" });
    await coordinator.terminate("wf-1");

    expect(get).toHaveBeenCalledTimes(3);
    expect(sendEvent).toHaveBeenCalledTimes(2);
    expect(sendEvent).toHaveBeenNthCalledWith(1, {
      type: "user_answer",
      payload: { answer: "a", details: "d", question: "q" },
    });
    expect(sendEvent).toHaveBeenNthCalledWith(2, {
      type: "admin_action",
      payload: { type: "approved by admin" },
    });
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it("creates workflow instance", async () => {
    const get = mock(async () => ({ sendEvent: async () => {}, terminate: async () => {} }));
    const create = mock(async () => {});
    const coordinator = new VerificationCoordinator({
      get,
      create,
    } as unknown as Env["VERIFY"]);

    await coordinator.create("wf-2", {
      chat: 1,
      user: 2,
      userChatId: 3,
      config: {
        question: "q",
        welcome: "w",
        timeout: 10,
        prompt: { text_in_private: "p", text_in_group: "g" },
        response_template: "r",
      },
      deadline: 1000,
    });

    expect(create).toHaveBeenCalledWith({
      id: "wf-2",
      params: {
        chat: 1,
        user: 2,
        userChatId: 3,
        config: {
          question: "q",
          welcome: "w",
          timeout: 10,
          prompt: { text_in_private: "p", text_in_group: "g" },
          response_template: "r",
        },
        deadline: 1000,
      },
    });
  });
});
