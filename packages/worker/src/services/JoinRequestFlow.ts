import type { ChatJoinRequest } from "@telegraf/types";
import type { ChatConfig, ChatMode } from "../../../shared/src/contracts";
import type { VerifyUserParams } from "../VerifyUser";

export type JoinFlowChat = {
  id: number;
  mode: ChatMode | null;
  config: ChatConfig | null;
};

export type FormJoinFlowDeps = {
  createWorkflowId: () => string;
  now: () => Date;
  clearJoinResponse: (chat: number, user: number) => Promise<void>;
  findExistingJoinRequest: (
    chat: number,
    user: number,
  ) => Promise<{ workflowId: string } | null>;
  terminateExistingWorkflow: (workflowId: string) => Promise<void>;
  upsertJoinRequest: (payload: {
    chat: number;
    user: number;
    userChatId: number;
    userBio: string | undefined;
    workflowId: string;
    date: Date;
    deadline: Date;
  }) => Promise<void>;
  createWorkflow: (workflowId: string, params: VerifyUserParams) => Promise<void>;
};

export function resolveJoinRequestMode(chat: JoinFlowChat | null) {
  if (!chat || !chat.config || chat.mode === "IGNORE") return "IGNORE" as const;
  if (chat.mode === "PASS") return "PASS" as const;
  return "FORM" as const;
}

export async function handleJoinRequestByMode(
  request: ChatJoinRequest,
  chat: JoinFlowChat | null,
  deps: {
    onPass: (request: ChatJoinRequest, config: ChatConfig) => Promise<void>;
    onForm: (request: ChatJoinRequest, chat: JoinFlowChat & { config: ChatConfig }) => Promise<void>;
  },
) {
  const mode = resolveJoinRequestMode(chat);
  if (mode === "IGNORE") return mode;
  if (mode === "PASS") {
    await deps.onPass(request, chat!.config!);
    return mode;
  }
  await deps.onForm(request, chat as JoinFlowChat & { config: ChatConfig });
  return mode;
}

export async function orchestrateFormJoinRequest(
  request: ChatJoinRequest,
  chat: { id: number; config: ChatConfig },
  deps: FormJoinFlowDeps,
) {
  const workflowId = deps.createWorkflowId();
  await deps.clearJoinResponse(chat.id, request.from.id);

  const existing = await deps.findExistingJoinRequest(chat.id, request.from.id);
  if (existing) {
    try {
      await deps.terminateExistingWorkflow(existing.workflowId);
    } catch (e) {
      console.warn("failed to terminate existing workflow", e);
    }
  }

  const date = deps.now();
  const deadline = new Date(date.getTime() + chat.config.timeout * 1000);
  await deps.upsertJoinRequest({
    chat: chat.id,
    user: request.from.id,
    userChatId: request.user_chat_id,
    userBio: request.bio,
    workflowId,
    date,
    deadline,
  });

  await deps.createWorkflow(workflowId, {
    chat: chat.id,
    user: request.from.id,
    userChatId: request.user_chat_id,
    config: chat.config,
    deadline: deadline.getTime(),
  });

  return { workflowId, deadline };
}

export function pickLatestPendingRequest<T extends { date: Date; Response?: unknown }>(
  requests: T[],
) {
  return requests
    .filter((request) => !request.Response)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
}
