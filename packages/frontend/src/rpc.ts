import { initData } from "@telegram-apps/sdk-react";

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

type RpcMapped = {
  [K in keyof RpcType]: (
    ...args: Parameters<RpcType[K]>
  ) => Promise<ReturnType<RpcType[K]>>;
};

export const rpc = new Proxy(
  {},
  {
    get(target, method: string) {
      if (method in target) {
        // @ts-ignore
        return target[method];
      }
      return async (params: any = {}) => {
        const response = await fetch("/rpc", {
          method: "POST",
          headers: {
            "X-Telegram-InitData": initData.raw()!,
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: JSON.stringify({ method, params }),
        });
        const data = (await response.json()) as
          | { ok: true; result: any }
          | { ok: false; error: string };
        if (data.ok) {
          return data.result;
        } else {
          throw new Error(data.error);
        }
      };
    },
  },
) as RpcMapped;
