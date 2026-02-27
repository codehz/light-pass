export type ChatMode = "FORM" | "PASS" | "IGNORE";

export type ChatConfig = {
  question: string;
  welcome: string;
  timeout: number;
  prompt: {
    text_in_private: string;
    text_in_group: string;
  };
  response_template: string;
};

export const DEFAULT_RESPONSE_TEMPLATE =
  "用户{{user.display_name}}回答：\\n{{response.answer}}";

export type AdminAction =
  | { type: "approved by admin" }
  | { type: "declined by admin" }
  | { type: "banned by admin" };

export type RpcStatus = {
  admins: RpcStatus.Admin[];
  requests: RpcStatus.Request[];
};

export declare namespace RpcStatus {
  export type Admin = {
    id: number;
    title: string;
    photo?: string;
    config: ChatConfig | null;
    requests: Admin.Request[];
    responses: Admin.Response[];
  };

  export namespace Admin {
    export type Request = {
      user: number;
      userBio: string;
      title: string;
      photo?: string;
      date: number;
      deadline: number;
    };

    export type Response = {
      user: number;
      date: number;
      answer: string;
      details: string;
      question: string;
    };
  }

  export type Request = {
    id: number;
    question: string;
    title: string;
    photo?: string;
    answered: boolean;
  };
}

export type RpcType = {
  status(): RpcStatus;
  updateChatConfig(params: { chat: number; config: ChatConfig }): void;
  answer(params: { chat: number; answer: string }): void;
  adminAction(params: {
    chat: number;
    user: number;
    action: AdminAction;
  }): void;
};

export type RpcRequest =
  | { method: "status" }
  | { method: "updateChatConfig"; params: { chat: number; config: ChatConfig } }
  | { method: "answer"; params: { chat: number; answer: string } }
  | {
      method: "adminAction";
      params: { chat: number; user: number; action: AdminAction };
    };
