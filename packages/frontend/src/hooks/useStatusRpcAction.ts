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
        successText: string;
        errorTitle?: string;
      },
    ): Promise<boolean> => {
      try {
        await action();
        hapticFeedback.notificationOccurred.ifAvailable("success");
        await client.refetchQueries({ queryKey: ["status"] });
        toast(options.successText);
        return true;
      } catch (e) {
        hapticFeedback.notificationOccurred.ifAvailable("error");
        if (popup.show.isAvailable()) {
          await popup
            .show({ title: options.errorTitle ?? "操作失败", message: `${e}` })
            .catch(() => {});
        } else {
          alert(`${e}`);
        }
        return false;
      }
    },
    [client],
  );
}
