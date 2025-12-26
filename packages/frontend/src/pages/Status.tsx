import {
  RemixiconComponentType,
  RiReplyFill,
  RiSettingsFill,
} from "@remixicon/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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

export function Status() {
  const {
    data: { admins, requests },
  } = useSuspenseQuery({
    queryKey: ["status"],
    queryFn: () => rpc.status(),
  });
  const children: ReactNode[] = [];
  const push = useNavigatePush();
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

function RequestCard({ id, title, photo, question }: RpcStatus.Request) {
  return (
    <CardLayout
      photo={photo}
      title={title}
      action={
        <AnswerQuestion
          chat={id}
          question={question}
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
            <span className={tw("whitespace-nowrap text-sm")}>
              当前问题：
              <span className={tw("text-subtitle-text")}>
                {config.question}
              </span>
              <br />
            </span>
          )}
          <span className={tw("text-subtitle-text text-sm")}>
            {requests.length}个入群请求，{responses.length}个已回答
          </span>
        </>
      }
    >
      {requests.length > 0 && (
        <>
          <div className={tw("text-subtitle-text border-b mt-2 text-xs")}>
            入群请求列表（点击头像查看详情）
          </div>
          <div
            className={tw("divide-subtitle-text grid gap-1 divide-y pl-3 pt-2")}
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
  const client = useQueryClient();
  const wait = use(WaitContext);
  return (
    <div className={tw("grid grid-cols-[auto_minmax(0,1fr)] gap-2 px-1 pb-1")}>
      <MaybePhoto photo={photo} className={tw("size-8 rounded-full")} />
      <div className={tw("grid")}>
        <div
          className={tw(
            "overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold",
          )}
        >
          {title}
        </div>
        <div className={tw("text-subtitle-text flex flex-wrap gap-1 text-xs")}>
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
              "overflow-hidden text-ellipsis whitespace-nowrap text-xs",
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
            onClick={async () => {
              using _ = wait();
              await rpc.adminAction({
                chat,
                user,
                action: { type: "approved by admin" },
              });
              await client.refetchQueries({ queryKey: ["status"] });
            }}
          >
            通过
          </Button>
          <Button
            variant="solid"
            color="destructive"
            onClick={async () => {
              using _ = wait();
              await rpc.adminAction({
                chat,
                user,
                action: { type: "declined by admin" },
              });
              await client.refetchQueries({ queryKey: ["status"] });
            }}
          >
            拒绝
          </Button>
          <Button
            variant="solid"
            color="destructive"
            onClick={async () => {
              using _ = wait();
              await rpc.adminAction({
                chat,
                user,
                action: { type: "banned by admin" },
              });
              await client.refetchQueries({ queryKey: ["status"] });
            }}
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
    <div className={tw("bg-secondary-bg rounded-2xl p-2")}>
      <div className={tw("grid grid-cols-[auto_minmax(0,1fr)] gap-2")}>
        <MaybePhoto photo={photo} className={tw("size-12 rounded-full")} />
        <div className={tw("grid")}>
          <div
            className={tw(
              "overflow-hidden text-ellipsis whitespace-nowrap font-bold",
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
