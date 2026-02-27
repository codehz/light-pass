import { initData } from "@telegram-apps/sdk-react";
import type {
  AdminAction,
  ChatConfig,
  RpcStatus,
  RpcType,
} from "../../shared/src/contracts";

export type { AdminAction, ChatConfig, RpcStatus, RpcType };

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
        }
        throw new Error(data.error);
      };
    },
  },
) as RpcMapped;
