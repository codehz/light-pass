import { useFormFieldProxy, useFormRoot } from "@codehz/form";
import { RiSave2Fill } from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { hapticFeedback, popup } from "@telegram-apps/sdk-react";
import { tw } from "bun-tailwindcss" with { type: "macro" };
import { toast } from "sonner";
import { Button } from "../components/Button";
import { Fieldset } from "../components/Fieldset";
import { FormInput } from "../components/FormInput";
import { FormLabel } from "../components/FormLabel";
import { FormTextarea } from "../components/FormTextarea";
import { MaybePhoto } from "../components/MaybePhoto";
import { SafeAreaPage } from "../components/SafeAreaPage";
import { useNavigatePop } from "../components/StackNavigator";
import { VariableHint } from "../components/VariableHint";
import { useAsyncState } from "../hooks/useAsyncState";
import { ChatConfig, rpc } from "../rpc";
import { SubTitle } from "../components/SubTitle";
import {
  PRIVATE_PROMPT_VARIABLES,
  GROUP_PROMPT_VARIABLES,
  RESPONSE_TEMPLATE_VARIABLES,
} from "../utils/templateVariables";

export function ChatSettings({
  initial,
  chat,
  title,
  photo,
}: {
  initial: ChatConfig | null;
  chat: number;
  title: string;
  photo?: string;
}) {
  const client = useQueryClient();
  const root = useFormRoot<ChatConfig>({
    values: initial ?? {
      question: "",
      welcome: "",
      timeout: 600,
      prompt: {
        text_in_private: "",
        text_in_group: "",
      },
      response_template: "用户{{user.display_name}}回答：\n{{response.answer}}",
    },
  });
  const proxy = useFormFieldProxy(root);
  const pop = useNavigatePop();
  const [saving, start] = useAsyncState();
  return (
    <SafeAreaPage title="配置群组">
      <SubTitle>
        正在配置：
        <MaybePhoto photo={photo} className={tw("mr-1 size-6 rounded-full")} />
        <span>{title}</span>
      </SubTitle>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          using _ = start();
          try {
            await rpc.updateChatConfig({ chat, config: root.reconstruct() });
            hapticFeedback.notificationOccurred.ifAvailable("success");
            await client.refetchQueries({ queryKey: ["status"] });
            toast("已保存");
            pop();
          } catch (e) {
            hapticFeedback.notificationOccurred.ifAvailable("error");
            if (popup.show.isAvailable())
              await popup
                .show({ title: "保存失败", message: `${e}` })
                .catch(() => {});
            else alert(`${e}`);
          }
        }}
        className={tw("mt-4 grid gap-4")}
      >
        <Fieldset title="群组配置" disabled={saving}>
          <FormLabel title="入群问题">
            <FormTextarea proxy={proxy("question")} required />
          </FormLabel>
          <FormLabel title="入群欢迎">
            <FormTextarea proxy={proxy("welcome")} required />
          </FormLabel>
          <FormLabel title="超时时间（单位：秒）">
            <FormInput.number
              proxy={proxy("timeout")}
              min={5}
              step={1}
              required
            />
          </FormLabel>
        </Fieldset>
        <Fieldset title="触发提示" disabled={saving}>
          <FormLabel title="私聊提示">
            <FormTextarea proxy={proxy("prompt.text_in_private")} required />
            <VariableHint variables={PRIVATE_PROMPT_VARIABLES} />
          </FormLabel>
          <FormLabel title="群聊提示">
            <FormTextarea proxy={proxy("prompt.text_in_group")} required />
            <VariableHint variables={GROUP_PROMPT_VARIABLES} />
          </FormLabel>
        </Fieldset>
        <Fieldset title="用户回答展示" disabled={saving}>
          <FormLabel title="回答模板">
            <FormTextarea proxy={proxy("response_template")} required />
            <VariableHint variables={RESPONSE_TEMPLATE_VARIABLES} />
          </FormLabel>
        </Fieldset>
        <Button
          variant="solid"
          Icon={RiSave2Fill}
          className={tw("block text-xl")}
          type="submit"
          disabled={saving}
        >
          保存
        </Button>
      </form>
    </SafeAreaPage>
  );
}
