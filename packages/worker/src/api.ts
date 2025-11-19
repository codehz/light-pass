import { ApiError, ApiMethods, ApiResponse } from "@telegraf/types";

type MappedApi<T> = {
  [K in keyof T]: T[K] extends (param: infer Param extends any) => infer Result
    ? (
        ...params: [unknown] extends [Param]
          ? [token: string]
          : [token: string, param: Param]
      ) => Promise<Result>
    : never;
};

export class BotError extends Error {
  code: number;
  retry_after?: number;
  constructor(error: ApiError, from: string) {
    super(error.description);
    this.code = error.error_code;
    this.name = `ApiError(${from})`;
    this.retry_after = error.parameters?.retry_after;
  }
}

export const api = new Proxy(
  {},
  {
    get(target, method: string) {
      if (method in target) {
        // @ts-ignore
        return target[method];
      }
      return async (token: string, param: any = {}) => {
        const body = JSON.stringify(param);
        const response = await fetch(
          `https://api.telegram.org/bot${token}/${method}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=UTF-8" },
            body,
          },
        );
        console.log(`call ${method} ${body}`);
        const apiResponse = (await response.json()) as ApiResponse<unknown>;
        if (apiResponse.ok) {
          return apiResponse.result;
        }
        console.log(`call ${method} ${body} error: ${apiResponse.description}`);
        throw new BotError(apiResponse, method);
      };
    },
  },
) as MappedApi<ApiMethods<never>>;

type MappedDirectResponse<T> = {
  [K in keyof T]: T[K] extends (param: infer Param extends any) => any
    ? (param: Param) => Response
    : never;
};

export const direct = new Proxy(
  {},
  {
    get(target, method: string) {
      if (method in target) {
        // @ts-ignore
        return target[method];
      }
      return (param: any) => {
        return new Response(JSON.stringify({ method, ...param }), {
          headers: {
            "Content-Type": "application/json",
          },
        });
      };
    },
  },
) as MappedDirectResponse<ApiMethods<never>>;
