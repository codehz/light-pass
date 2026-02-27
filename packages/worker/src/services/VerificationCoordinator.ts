import type { AdminAction } from "../../../shared/src/contracts";
import type { VerifyUserParams } from "../VerifyUser";

export class VerificationCoordinator {
  constructor(private readonly verify: Env["VERIFY"]) {}

  async terminate(workflowId: string) {
    const instance = await this.verify.get(workflowId);
    await instance?.terminate().catch(() => {});
  }

  async create(workflowId: string, params: VerifyUserParams) {
    await this.verify.create({ id: workflowId, params });
  }

  async sendUserAnswer(
    workflowId: string,
    payload: { answer: string; details: string; question: string },
  ) {
    const workflow = await this.verify.get(workflowId);
    await workflow.sendEvent({ type: "user_answer", payload });
  }

  async sendAdminAction(workflowId: string, action: AdminAction) {
    const workflow = await this.verify.get(workflowId);
    await workflow.sendEvent({ type: "admin_action", payload: action });
  }
}
