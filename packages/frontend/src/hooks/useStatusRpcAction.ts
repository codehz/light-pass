import { useQueryClient } from "@tanstack/react-query";
import { hapticFeedback, popup } from "@telegram-apps/sdk-react";
import { useCallback } from "react";
import { toast } from "sonner";

export function useStatusRpcAction() {
  const client = useQueryClient();

  return useCallback(
    async (
      action: () => Promise<unknown>,
      options: {
        successText?: string;
        errorTitle?: string;
      },
    ): Promise<boolean> => {
      try {
        await action();
        hapticFeedback.notificationOccurred.ifAvailable("success");
        await client.refetchQueries({ queryKey: ["status"] });
        if (options.successText) {
          toast(options.successText);
        }
        return true;
      } catch (e) {
        hapticFeedback.notificationOccurred.ifAvailable("error");
        const message = e instanceof Error ? e.message : String(e);
        if (popup.show.isAvailable()) {
          await popup
            .show({ title: options.errorTitle ?? "操作失败", message })
            .catch(() => {});
        } else {
          alert(message);
        }
        return false;
      }
    },
    [client],
  );
}
