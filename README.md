# Light Pass

Telegram 群组加入请求管理机器人，支持 Mini App 界面。

## 模板使用说明

机器人支持在提示文本中使用模板变量，允许动态插入上下文信息如用户名、群组名等。

### 支持的变量

模板使用 `{{variable}}` 语法，支持点路径访问。

#### 用户相关 (`user.*`)
- `user.id`: 用户 Telegram ID (数字)
- `user.first_name`: 用户名
- `user.last_name`: 用户姓 (可选)
- `user.username`: 用户名 @handle (可选)
- `user.display_name`: 显示名称 (first_name + last_name 或从 API 获取)

#### 群组相关 (`chat.*`)
- `chat.id`: 群组 ID
- `chat.title`: 群组标题

#### 请求相关 (`request.*`)
- `request.deadline`: 截止时间戳
- `request.date`: 请求创建时间戳
- `request.userBio`: 用户简介 (可选)

#### 回答相关 (`response.*`) - 仅在用户回答后发送时可用
- `response.question`: 问题文本
- `response.answer`: 用户回答
- `response.details`: 附加详情
- `response.date`: 回答时间戳

#### 元信息 (`meta.*`)
- `meta.deadline_formatted`: 格式化的截止时间 (中文)
- `meta.bot_username`: 机器人用户名

### 示例模板

#### 私聊提示
```
你好 {{user.first_name}}，你正在申请加入群《{{chat.title}}》。
问题：{{chat_config.question}}
请在 {{meta.deadline_formatted}} 前完成。
```

#### 群组通知
```
用户 {{user.display_name}}（@{{user.username}}）申请加入，简介：{{request.userBio}}。
请管理员查看。
```

#### 用户回答通知
```
【申请回答】{{user.display_name}} 回答：
{{response.answer}}
问题：{{response.question}}
```

### 注意事项
- 缺失变量默认替换为空字符串，可配置为保留占位符或抛出错误。
- 模板渲染在发送消息前进行，确保安全和性能。
- 当前支持纯文本消息，未来可扩展支持 Markdown/HTML 转义。