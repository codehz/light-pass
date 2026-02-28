import { useFormFieldProxy, useFormRoot } from "@codehz/form";
import { RiMailSendFill } from "@remixicon/react";
import { validateAnswer } from "../../../shared/src/answerConstraints";
import { tw } from "bun-tailwindcss" with { type: "macro" };
import { Button } from "../components/Button";
import { Fieldset } from "../components/Fieldset";
import { FormTextarea } from "../components/FormTextarea";
import { MaybePhoto } from "../components/MaybePhoto";
import { SafeAreaPage } from "../components/SafeAreaPage";
import { useNavigatePop } from "../components/StackNavigator";
import { SubTitle } from "../components/SubTitle";
import { useAsyncState } from "../hooks/useAsyncState";
import { useStatusRpcAction } from "../hooks/useStatusRpcAction";
import { rpc, type RpcStatus } from "../rpc";

export function AnswerQuestion({
  chat,
  title,
  photo,
  question,
  answerConstraints,
}: {
  chat: number;
  title: string;
  photo?: string;
  question: string;
  answerConstraints: RpcStatus.Request["answer_constraints"];
}) {
  const root = useFormRoot({ values: { answer: "" } });
  const proxy = useFormFieldProxy(root);
  const pop = useNavigatePop();
  const [submitting, start] = useAsyncState();
  const runStatusAction = useStatusRpcAction();
  return (
    <SafeAreaPage title="入群审核">
      <form
        className={tw("grid gap-4")}
        onSubmit={async (e) => {
          e.preventDefault();
          using _ = start();
          const { answer } = root.reconstruct();
          const validation = validateAnswer(answer, answerConstraints);
          if (!validation.ok) {
            await runStatusAction(
              async () => {
                throw new Error(validation.message);
              },
              {
                errorTitle: "回答格式不符合要求",
              },
            );
            return;
          }
          const ok = await runStatusAction(
            () => rpc.answer({ chat, answer }),
            {
              successText: "已提交",
              errorTitle: "保存失败",
            },
          );
          if (ok) {
            pop();
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
          <FormTextarea
            proxy={proxy("answer")}
            required
            maxLength={answerConstraints.max_length}
          />
          <div className={tw("text-subtitle-text mt-1 text-xs")}>
            最多{answerConstraints.max_length}字，至少{answerConstraints.min_lines}
            行（按非空行统计）
          </div>
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
