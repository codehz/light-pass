import { Variable } from "../components/FormTextareaWithVariables";

const COMMON_VARIABLES: Variable[] = [
  { name: "user.id", description: "用户 ID" },
  { name: "user.first_name", description: "用户名" },
  { name: "user.last_name", description: "用户姓" },
  { name: "user.username", description: "用户 @handle" },
  { name: "user.display_name", description: "用户显示名称" },
  { name: "user.bio", description: "用户个人简介" },
  { name: "chat.id", description: "群组 ID" },
  { name: "chat.title", description: "群组标题" },
  { name: "chat.question", description: "入群问题" },
  { name: "request.deadline", description: "截止时间戳（毫秒）" },
  { name: "request.date", description: "请求创建时间戳（毫秒）" },
  { name: "meta.deadline_formatted", description: "格式化的截止时间（中文）" },
  { name: "meta.bot_username", description: "机器人用户名" },
];

/**
 * 私聊提示（text_in_private）支持的模板变量
 * 用于在用户私聊中展示入群请求提示信息
 */
export const PRIVATE_PROMPT_VARIABLES: Variable[] = [...COMMON_VARIABLES];

/**
 * 群聊提示（text_in_group）支持的模板变量
 * 用于在群组中展示用户入群请求提示信息
 */
export const GROUP_PROMPT_VARIABLES: Variable[] = [...COMMON_VARIABLES];

/**
 * 用户回答模板（response_template）支持的模板变量
 * 用于在群组中展示用户的入群问题回答
 */
export const RESPONSE_TEMPLATE_VARIABLES: Variable[] = [
  ...COMMON_VARIABLES,
  { name: "response.answer", description: "用户的回答" },
  { name: "response.details", description: "回答详情" },
];

/**
 * 欢迎消息（welcome）支持的模板变量
 * 在管理员批准用户后向群组发送欢迎文本
 */
export const WELCOME_MESSAGE_VARIABLES: Variable[] = [
  ...COMMON_VARIABLES,
  { name: "response.answer", description: "用户的回答" },
  { name: "response.details", description: "回答详情" },
];
