# MicYou Automation

为 [LanRhyme/MicYou](https://github.com/LanRhyme/MicYou) 打造的 Probot GitHub App，提供 **issue 标签状态机**、**垃圾过滤**、**PR 工作流自动化**及**斜杠命令**。

部署于 [Vercel](https://vercel.com) serverless 函数。

## 斜杠命令

在 issue 评论中以 `/` 开头的行触发命令。

| 命令         | 用法                     | 权限     | 说明                                                                                  |
| ------------ | ------------------------ | -------- | ------------------------------------------------------------------------------------- |
| `/ping`      | `/ping`                  | 所有人   | 机器人回复 `Pong! @你`，用于健康检查                                                  |
| `/duplicate` | `/duplicate <issue编号>` | 写入权限 | 标记当前 issue 为 #N 的重复项，关闭并添加 `重复` 标签。重复调用会删除上一次的提示评论 |

## 标签状态机

标签使用 GitHub 数字 ID（见 `src/values.ts`），机器人响应 `labeled` / `unlabeled` 事件：

| 添加标签 →                                          | issue 打开时 →                                           | issue 关闭时 → |
| --------------------------------------------------- | -------------------------------------------------------- | -------------- |
| **流程标签**（`处理中`/`复核中`/`等待合并`）        | 移除所有负面标签                                         | 重新打开 issue |
| **完成**（`完成`）                                  | 移除负面标签，关闭为已完成                               | —              |
| **负面标签**（`重复`/`不予修复`/`无效`/`暂无计划`） | 清除除自身和标记标签外的所有标签；若为"暂无计划"类则关闭 | —              |
| **需求标签**（`需要信息`/`需要复现`）               | —                                                        | 重新打开 issue |
| **尺寸标签**（`XS`–`XXL`）                          | 互斥，自动替换已有的尺寸标签                             | —              |
| **标记标签**（`破坏性变更`/`高质量`）               | 永不被自动移除                                           | 永不被自动移除 |

## 垃圾过滤器

在 `issues.opened` 时，检测 issue 正文是否包含**未勾选**的 YAML 模板必选复选框（如 `- [ ] 我已经确认使用的是最新版本`）。若存在则自动以 `not_planned` 关闭并留言说明。

必选复选框（三语）：
- （简中）我已经确认使用的是最新版本 / 我已经搜索过已有问题，没有发现重复 / ...
- （繁中）我已經確認使用的是最新版本 / 我已經搜尋過已有問題，沒有發現重複
- （英文）I confirm I am using the latest version / I have searched existing issues and found no duplicates

## 严重程度自动标签

当 bug issue 创建时，根据模板中「严重程度」下拉框的选择自动打优先级标签。支持三语模板：

| 严重程度        | 模板选项                                                                                   | 自动标签             |
| --------------- | ------------------------------------------------------------------------------------------ | -------------------- |
| 阻塞 / Blocking | 阻塞 - 完全无法使用 / 阻塞 - 完全無法使用 / Blocking - Completely unusable                 | `priority: critical` |
| 严重 / Critical | 严重 - 主要功能受损 / 嚴重 - 主要功能受損 / Critical - Major functionality broken          | `priority: high`     |
| 一般 / Moderate | 一般 - 功能可用但有缺陷 / Moderate - Functionality works but with flaws                    | `priority: medium`   |
| 轻微 / Minor    | 轻微 - 细微问题，不影响主要功能 / 輕微 - 細微問題，不影響主要功能 / Minor - Minor issue... | `priority: low`      |

> 实现位于 `src/targets/issues.opened.ts`，映射表见 `SEVERITY_LABEL_MAP`。

## PR 工作流

| 事件                  | 行为                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `opened` / `reopened` | 根据 `additions + deletions` 分配尺寸标签（`XS`–`XXL`）。若可合并（GraphQL 检查）→ `等待合并`，否则 → `复核中`。同步更新关联 issue 的标签 |
| `ready_for_review`    | 重新检查可合并性，更新标签                                                                                                                |
| `converted_to_draft`  | 设为 `处理中`，更新关联 issue                                                                                                             |
| `merged`              | 设为 `完成`，更新关联 issue                                                                                                               |
| `closed`（未合并）    | 清除所有标签，关联 issue 设为 `处理中`                                                                                                    |
| `review`（提交）      | 保留已有尺寸标签，重新检查可合并性                                                                                                        |
| `synchronize`         | 新提交时重新检查可合并性                                                                                                                  |

可合并性通过 **GraphQL** 查询（`mergeStateStatus`、`reviewDecision`、`mergeable`）判断，REST API 不提供这些字段。

## 关闭时自动标签

Issue 关闭时根据 `state_reason` 自动设置标签：

- `completed` → `完成`（关闭者有写入权限时；否则降级为 `暂无计划`）
- `not_planned` → `暂无计划`
- `duplicate` → `重复`

## 标签参考

| 名称               | ID            | 分类     |
| ------------------ | ------------- | -------- |
| 处理中             | `10942109735` | 流程     |
| 复核中             | `10942112055` | 流程     |
| 等待合并           | `10942112227` | 流程     |
| 完成               | `10942112367` | 完成     |
| 重复               | `10175506682` | 负面     |
| 不予修复           | `10175506712` | 不予计划 |
| 无效               | `10175506703` | 不予计划 |
| 暂无计划           | `10942112473` | 不予计划 |
| 需要信息           | `10942112604` | 需求     |
| 需要复现           | `10942115301` | 需求     |
| 破坏性变更         | `10942115448` | 标记     |
| 高质量             | `10942115570` | 标记     |
| size/XS            | `10942115655` | 尺寸     |
| size/S             | `10942115747` | 尺寸     |
| size/M             | `10942115872` | 尺寸     |
| size/L             | `10942117971` | 尺寸     |
| size/XL            | `10942118132` | 尺寸     |
| size/XXL           | `10942118246` | 尺寸     |
| priority: low      | `10733626475` | 优先级   |
| priority: medium   | `10733634790` | 优先级   |
| priority: high     | `10733638284` | 优先级   |
| priority: critical | `10733641016` | 优先级   |

> 刷新 ID：`gh api repos/LanRhyme/MicYou/labels?per_page=100 --jq '.[] | "\(.name): \(.id)"'`

## 架构

```
webhook → api/github/webhooks/index.ts → handler.ts → app.ts → src/targets/<event>.ts
```

| 文件                             | 职责                                                         |
| -------------------------------- | ------------------------------------------------------------ |
| `src/values.ts`                  | 标签 ID 常量、分类辅助函数、`Context.prototype.label()` 扩展 |
| `src/data.ts`                    | 内存临时存储（`TDATA`）— **冷启动丢失**（Vercel serverless） |
| `src/utils.ts`                   | `hasWritePermission()`、`isNotUserEvent()`                   |
| `src/app.ts`                     | Probot 入口 — 注册所有事件处理器 + 调试日志                  |
| `src/handler.ts`                 | `createNodeMiddleware` 包装，适配 Vercel serverless          |
| `api/github/webhooks/index.ts`   | `src/handler.ts` 的薄层重导出（Vercel 要求 `/api` 目录）     |
| `src/targets/issues.opened.ts`   | 垃圾过滤器 + 严重程度自动标签                                |
| `src/targets/issues.labeled.ts`  | 标签状态机（`labeled` 和 `unlabeled`）                       |
| `src/targets/issues.closed.ts`   | 关闭时自动标签 + 权限检查                                    |
| `src/targets/issues.reopened.ts` | 重新打开时移除 `不予计划` 和 `重复` 标签                     |
| `src/targets/issue_comment.ts`   | `/command` 解析器，使用临时状态（`TDATA`）支持多步工作流     |
| `src/targets/pull_request.ts`    | PR 工作流 + GraphQL 可合并性检查 + review 处理               |
| `src/targets/template`           | 新事件处理器的起始模板                                       |

## 开发

```bash
pnpm install          # 安装依赖
pnpm build            # tsc → dist/
pnpm start            # 构建 + probot run ./dist/app.js
pnpm test             # ts-node ./test/app.test.ts（uvu 测试框架）
pnpm lint             # biome lint .
pnpm format           # biome format --write .
```

### 编码约定

- **ESM 导入必须带 `.js` 后缀** — `import { Labels } from "../values.js";`
- **标签使用数字 ID**，非名称 — 调用 REST API 前用 `context.label(...ids)` 解析为名称
- **非用户发送者**用 `utils.ts` 的 `isNotUserEvent()` 过滤（例外：`issues.opened.ts` 的垃圾过滤器对所有作者生效）
- **PR 可合并性需用 GraphQL** — REST 不暴露 `mergeStateStatus` / `reviewDecision`
- **TDATA 是暂时的** — Vercel 冷启动时多步命令流程会中断

## 部署

部署到 **Vercel** serverless 函数。Webhook URL：`POST /api/github/webhooks`。

1. 在 Vercel 中配置 [GitHub App 环境变量](https://probot.github.io/docs/configuration/)
2. 确保 serverless 函数在 `/api` 目录下 — Vercel 会自动检测
3. 将 GitHub App 的 webhook URL 设为 `https://<你的域名>/api/github/webhooks`

## 许可证

[ISC](LICENSE)
