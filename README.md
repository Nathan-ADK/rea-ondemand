# rea-ondemand（WorkBuddy / WBD 侧）

**REA 逆向分析能力 —— 真·零常驻、按需调用插件。**

## 它解决什么

REA 是一个逆向分析 CLI（263 个工具）。常规做法（注册 MCP 或注册 Skill）会把它写进每次请求的系统上下文——即使你根本没做逆向任务，也会为它持续付费。

本插件做到：**平时 0 token 常驻，只有你真正提出逆向需求时才注入一次调用指引；调用时拉起一次 CLI 进程，用完即走，不驻留。**

## 为什么必须做成 Hook 而不是 MCP / Skill

| 方式 | 常驻 token | 是否满足"绝不多耗 1 token" |
|---|---|---|
| MCP（注册 263 工具）| 每轮约 670KB schema | ✗ |
| Skill（name+description 注入）| 每轮约 50 token | ✗ |
| **UserPromptSubmit 命令 Hook（本插件）** | **命中关键词才注入，平时 0** | **✓** |

Hook 运行在模型上下文之外：它在用户提示进入模型前做关键词匹配，只有命中"逆向/反编译/分析 exe…"等关键词时才注入一次指引。平时既不注入任何字符，也不拉起进程。

## 与 ctx-forge 的关系

**完全独立的两个插件，功能不同：**

- 本插件（rea-ondemand）：让 REA 逆向能力按需可用。
- ctx-forge：让大模型精简输出、压缩上下文。

二者没有代码依赖，互不调用，可分别安装/卸载。

## 安装（WBD 侧）

1. 在 `~/.workbuddy/settings.json` 的 `hooks` 里加入（注意用**你自己机器上的绝对路径**）：

```json
"UserPromptSubmit": [
  {
    "hooks": [
      { "type": "command", "command": "node \"/绝对路径/rea-ondemand/hook.js\"", "timeout": 20 }
    ]
  }
]
```

2. **不要**把 REA 注册为 MCP（不写进 `~/.workbuddy/mcp.json`），也不要注册为 Skill（否则描述会常驻）。
3. 生成本机 REA 路径适配（仅本机，不随包分发）：

```bash
node /绝对路径/rea-ondemand/install.js
```

若你把 `rea` 装在 PATH 上（如 `npm i -g rea-agents`），可跳过第 3 步，hook 会自动走 PATH 回退。

## 用法

平时无需任何操作（0 注入）。当你提出逆向需求，hook 自动注入一次指引，形如：

```
node <本目录>/hook.js --call capabilities        # 看能力
node <本目录>/hook.js --call analyze <路径>       # 分析文件/应用
node <本目录>/hook.js --call --help              # 全部命令
```

也可直接按需单次调用：

```bash
node hook.js --call capabilities
node hook.js --call analyze /path/to/app
node hook.js --call analyze-javascript-application /path/to/app
node hook.js --call analyze-web-bundle <url>
```

## 卸载

删除 `settings.json` 里那条 `UserPromptSubmit` hook 即可。不写 mcp.json、不留常驻进程，无残留。

## 许可

MIT
