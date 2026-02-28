import {
  RemixiconComponentType,
  RiReplyFill,
  RiSettingsFill,
} from "@remixicon/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { tw } from "bun-tailwindcss" with { type: "macro" };
import { ReactNode, use, useMemo } from "react";
import { Button } from "../components/Button";
import { MaybePhoto } from "../components/MaybePhoto";
import RelativeTime from "../components/RelativeTime";
import { handlePushPage, useNavigatePush } from "../components/StackNavigator";
import { SubTitle } from "../components/SubTitle";
import { rpc, type RpcStatus } from "../rpc";
import { AnswerQuestion } from "./AnswerQuestion";
import { ChatSettings } from "./ChatSettings";
import { WaitContext } from "../components/WaitHost";
import { useStatusRpcAction } from "../hooks/useStatusRpcAction";

export function Status() {
  const {
    data: { admins, requests },
  } = useSuspenseQuery({
    queryKey: ["status"],
    queryFn: () => rpc.status(),
  });
  const children: ReactNode[] = [];
  if (requests.length) {
    children.push(
      <div key="requests" className={tw("mt-2")}>
        <SubTitle>待回答的加群问题</SubTitle>
        <div className={tw("grid *:mt-2")}>
          {requests.map((request) => (
            <RequestCard key={request.id} {...request} />
          ))}
        </div>
      </div>,
    );
  }
  if (admins.length) {
    children.push(
      <div key="admin" className={tw("mt-2")}>
        <SubTitle>管理的群组</SubTitle>
        <div className={tw("grid *:mt-2")}>
          {admins.map((admin) => (
            <AdminCard key={admin.id} {...admin} />
          ))}
        </div>
      </div>,
    );
  }
  return children.length ? children : <div>今日无事可做</div>;
}

function RequestCard({
  id,
  title,
  photo,
  question,
  answer_constraints,
}: RpcStatus.Request) {
  return (
    <CardLayout
      photo={photo}
      title={title}
      action={
        <AnswerQuestion
          chat={id}
          question={question}
          answerConstraints={answer_constraints}
          title={title}
          photo={photo}
        />
      }
      ActionIcon={RiReplyFill}
      actionText="立即回答"
      description={question}
    />
  );
}

function AdminCard({
  id,
  title,
  photo,
  config,
  requests,
  responses,
}: RpcStatus.Admin) {
  const mapped = useMemo(
    () => new Map(responses.map((resp) => [resp.user, resp])),
    [responses],
  );
  return (
    <CardLayout
      photo={photo}
      title={title}
      action={
        <ChatSettings chat={id} initial={config} title={title} photo={photo} />
      }
      ActionIcon={RiSettingsFill}
      actionText="设置"
      description={
        <>
          {config && (
            <span className={tw("text-sm whitespace-nowrap")}>
              当前问题：
              <span className={tw("text-subtitle-text")}>
                {config.question}
              </span>
              <br />
            </span>
          )}
          <span className={tw("text-sm text-subtitle-text")}>
            {requests.length}个入群请求，{responses.length}个已回答
          </span>
        </>
      }
    >
      {requests.length > 0 && (
        <>
          <div className={tw("mt-2 border-b text-xs text-subtitle-text")}>
            入群请求列表（点击头像查看详情）
          </div>
          <div
            className={tw("grid gap-1 divide-y divide-subtitle-text pt-2 pl-3")}
          >
            {requests.map((request) => (
              <AdminRequestItem
                key={request.user}
                {...request}
                response={mapped.get(request.user)}
                chat={id}
              />
            ))}
          </div>
        </>
      )}
    </CardLayout>
  );
}

function AdminRequestItem({
  chat,
  user,
  photo,
  title,
  date,
  deadline,
  response,
}: RpcStatus.Admin.Request & {
  response?: RpcStatus.Admin.Response;
  chat: number;
}) {
  const wait = use(WaitContext);
  const runStatusAction = useStatusRpcAction();

  async function runAdminAction(
    action: "approved by admin" | "declined by admin" | "banned by admin",
    successText: string,
  ) {
    using _ = wait();
    await runStatusAction(
      () =>
        rpc.adminAction({
          chat,
          user,
          action: { type: action },
        }),
      {
        successText,
        errorTitle: "操作失败",
      },
    );
  }

  return (
    <div className={tw("grid grid-cols-[auto_minmax(0,1fr)] gap-2 px-1 pb-1")}>
      <MaybePhoto photo={photo} className={tw("size-8 rounded-full")} />
      <div className={tw("grid")}>
        <div
          className={tw(
            "overflow-hidden text-xs font-bold text-ellipsis whitespace-nowrap",
          )}
        >
          {title}
        </div>
        <div className={tw("flex flex-wrap gap-1 text-xs text-subtitle-text")}>
          <span>
            <RelativeTime time={date} />
            加入
          </span>
          {response ? (
            <span>
              <RelativeTime time={response.date} />
              回答
            </span>
          ) : (
            <span>
              <RelativeTime time={deadline} />
              超时
            </span>
          )}
        </div>
        {response && (
          <div
            className={tw(
              "overflow-hidden text-xs text-ellipsis whitespace-nowrap",
            )}
          >
            回答：
            <span className={tw("text-subtitle-text italic")}>
              {response.answer}
            </span>
          </div>
        )}
        <div className={tw("mt-1 grid grid-cols-3 gap-1 text-xs")}>
          <Button
            variant="solid"
            color="accent"
            onClick={() =>
              runAdminAction("approved by admin", "已通过该入群请求")
            }
          >
            通过
          </Button>
          <Button
            variant="solid"
            color="destructive"
            onClick={() =>
              runAdminAction("declined by admin", "已拒绝该入群请求")
            }
          >
            拒绝
          </Button>
          <Button
            variant="solid"
            color="destructive"
            onClick={() =>
              runAdminAction("banned by admin", "已封禁并拒绝该入群请求")
            }
          >
            封禁
          </Button>
        </div>
      </div>
    </div>
  );
}

function CardLayout({
  photo,
  title,
  description,
  ActionIcon,
  action,
  actionText,
  children,
}: {
  photo?: string;
  title: string;
  description: ReactNode;
  ActionIcon?: RemixiconComponentType;
  action: ReactNode;
  actionText: ReactNode;
  children?: ReactNode;
}) {
  const push = useNavigatePush();
  return (
    <div className={tw("rounded-2xl bg-secondary-bg p-2")}>
      <div className={tw("grid grid-cols-[auto_minmax(0,1fr)] gap-2")}>
        <MaybePhoto photo={photo} className={tw("size-12 rounded-full")} />
        <div className={tw("grid")}>
          <div
            className={tw(
              "overflow-hidden font-bold text-ellipsis whitespace-nowrap",
            )}
          >
            {title}
          </div>
          <div
            className={tw("overflow-hidden text-ellipsis after:clear-right")}
          >
            <span className={tw("whitespace-pre-wrap")}>{description}</span>
            <Button
              variant="solid"
              className={tw("float-end text-xs")}
              Icon={ActionIcon}
              onClick={handlePushPage(push, action)}
            >
              {actionText}
            </Button>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
