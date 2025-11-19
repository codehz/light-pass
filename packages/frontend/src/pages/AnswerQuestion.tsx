import { useFormFieldProxy, useFormRoot } from "@codehz/form";
import { RiMailSendFill } from "@remixicon/react";
import { hapticFeedback, popup } from "@telegram-apps/sdk-react";
import { tw } from "bun-tailwindcss" with { type: "macro" };
import { toast } from "sonner";
import { Button } from "../components/Button";
import { Fieldset } from "../components/Fieldset";
import { FormTextarea } from "../components/FormTextarea";
import { MaybePhoto } from "../components/MaybePhoto";
import { SafeAreaPage } from "../components/SafeAreaPage";
import { useNavigatePop } from "../components/StackNavigator";
import { SubTitle } from "../components/SubTitle";
import { useAsyncState } from "../hooks/useAsyncState";
import { rpc } from "../rpc";
import { useQueryClient } from "@tanstack/react-query";

export function AnswerQuestion({
  chat,
  title,
  photo,
  question,
}: {
  chat: number;
  title: string;
  photo?: string;
  question: string;
}) {
  const client = useQueryClient();
  const root = useFormRoot({ values: { answer: "" } });
  const proxy = useFormFieldProxy(root);
  const pop = useNavigatePop();
  const [submitting, start] = useAsyncState();
  return (
    <SafeAreaPage title="入群审核">
      <form
        className={tw("grid gap-4")}
        onSubmit={async (e) => {
          e.preventDefault();
          using _ = start();
          try {
            const { answer } = root.reconstruct();
            await rpc.answer({ chat, answer });
            hapticFeedback.notificationOccurred.ifAvailable("success");
            await client.refetchQueries({ queryKey: ["status"] })
            toast("已提交");
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
      >
        <SubTitle>
          正在回答：
          <MaybePhoto
            photo={photo}
            className={tw("mr-1 size-6 rounded-full")}
          />
          <span>{title}</span>
        </SubTitle>
        <Fieldset title="问题" disabled={submitting}>
          <div className={tw("whitespace-pre-wrap")}>{question}</div>
        </Fieldset>
        <Fieldset title="回答" disabled={submitting}>
          <FormTextarea proxy={proxy("answer")} required />
        </Fieldset>
        <Button
          variant="solid"
          className={tw("block text-xl")}
          Icon={RiMailSendFill}
          disabled={submitting}
          type="submit"
        >
          提交
        </Button>
      </form>
    </SafeAreaPage>
  );
}
