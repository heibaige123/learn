# bumpp 架构说明

## 1. 项目定位

`bumpp` 是一个用于版本号升级与发布动作编排的命令行工具，同时也暴露了可编程 API。它的核心目标不是单纯修改 `package.json`，而是把一次发布过程收束成一条可重复执行的流水线：

1. 解析配置与命令行输入。
2. 识别当前版本。
3. 计算目标版本。
4. 更新一个或多个清单文件和文本文件。
5. 运行版本相关脚本。
6. 执行可选的安装与自定义命令。
7. 提交 Git、打 Tag、推送远端。

从职责上看，它处在“发布自动化工具”与“版本号写入器”之间，强调以下特性：

- 既可交互式使用，也可在 CI 或脚本中无交互运行。
- 默认面向 Node 包发布，但兼容 `jsr.json`、`deno.json` 等清单文件。
- 支持 monorepo 递归扫描工作区包。
- 把发布动作拆成可组合模块，而不是把所有行为塞进 CLI 入口。

## 2. 总体分层

代码结构可以分为五层：

### 2.1 入口层

- `bin/bumpp.mjs`
- `src/cli.ts`
- `src/index.ts`

其中：

- `bin/bumpp.mjs` 是 npm 可执行入口，运行打包后的 `dist/cli.mjs`。
- `src/cli.ts` 只是 CLI 模块的转发导出。
- `src/index.ts` 是库入口，导出 `versionBump`、`versionBumpInfo` 和配置辅助函数。

这个设计把“命令行体验”和“库能力”分离开来：CLI 只负责用户交互和进程退出，真正的版本升级逻辑由核心服务层完成。

### 2.2 CLI 编排层

- `src/cli/index.ts`
- `src/cli/parse-args.ts`
- `src/cli/exit-code.ts`
- `src/cli/symbols.ts`
- `src/cli/run.ts`

这一层负责：

- 参数解析。
- 配置加载结果与命令行参数合并。
- Git 工作区前置检查。
- 将进度回调绑定到终端输出。
- 统一处理异常并转换为进程退出码。

这一层不直接做版本计算，也不直接修改文件。它的任务是把用户输入整理成 `VersionBumpOptions`，然后交给核心流程。

### 2.3 核心流程层

- `src/version-bump.ts`
- `src/operation.ts`

这是项目的中枢。

- `version-bump.ts` 定义标准执行顺序。
- `Operation` 是一次运行的上下文对象，保存输入、状态、结果和进度回调。

可以把 `Operation` 理解为一次发布事务的“会话对象”。后续所有模块都围绕它读写状态，而不是彼此直接共享零散参数。

### 2.4 领域能力层

- `src/normalize-options.ts`
- `src/get-current-version.ts`
- `src/get-new-version.ts`
- `src/update-files.ts`
- `src/run-npm-script.ts`
- `src/git.ts`
- `src/print-commits.ts`
- `src/release-type.ts`
- `src/manifest.ts`

这一层承载真实业务规则：

- 选项归一化。
- 版本来源识别。
- 目标版本推导。
- 文件更新策略。
- npm version 生命周期脚本执行。
- Git 提交、Tag、Push。
- Conventional Commits 解析后的展示与推导。

### 2.5 基础设施层

- `src/fs.ts`
- 外部依赖：`prompts`、`cac`、`semver`、`tinyexec`、`tinyglobby`、`jsonc-parser`、`yaml`、`unconfig`、`package-manager-detector`

这一层提供基础 I/O 能力和第三方集成，不包含业务策略本身。

## 3. 核心对象模型

### 3.1 VersionBumpOptions

`src/types/version-bump-options.ts` 定义公共输入模型。它同时服务于两类调用方：

- 命令行用户。
- 直接在代码中调用 `versionBump()` 的开发者。

该类型覆盖以下维度：

- 版本选择：`release`、`currentVersion`、`preid`、`customVersion`
- Git 行为：`commit`、`tag`、`push`、`sign`、`all`、`noVerify`、`noGitCheck`
- 文件范围：`files`、`recursive`、`cwd`
- 执行控制：`confirm`、`ignoreScripts`、`install`、`execute`
- 交互与反馈：`interface`、`progress`、`printCommits`
- 配置来源：`configFilePath`

这个接口有两个重要设计点：

1. 兼容“简单值”和“结构化值”。例如 `commit` 与 `tag` 可以是布尔值，也可以是模板字符串。
2. 把 CLI 和 API 的能力统一在一个输入模型中，减少两套配置体系并存带来的维护成本。

### 3.2 NormalizedOptions

`normalizeOptions()` 会把公共输入收束成内部稳定结构 `NormalizedOptions`。它的作用是：

- 为默认值兜底。
- 将 `release` 标准化为三种内部表示之一：显式版本、交互提示、相对 bump。
- 将 `commit` / `tag` 等布尔值转换为内部对象结构。
- 展开 glob 并得到最终文件列表。
- 规范输入输出流接口。

这一步很关键，因为它把后续模块从“兼容各种用户输入形态”的负担中解放出来。

### 3.3 Operation

`Operation` 持有三类信息：

- `options`：归一化后的稳定输入。
- `state`：运行中的可变状态。
- `results`：从状态和选项投影出来的最终输出。

`state` 中最重要的字段有：

- `currentVersionSource`
- `currentVersion`
- `newVersion`
- `release`
- `commitMessage`
- `tagName`
- `updatedFiles`
- `skippedFiles`

模块之间不直接传递这些字段，而是通过 `operation.update()` 进行状态推进，并在必要时触发 `progress` 回调。

这种设计有两个收益：

1. 整体执行链路是线性的，但状态记录集中，便于追踪和测试。
2. CLI 输出与实际业务事件解耦，未来如果接入 GUI 或其他宿主，只要消费 `progress` 即可。

## 4. 执行流程

一次完整执行的真实顺序如下。

### 4.1 CLI 启动

当用户运行 `bumpp` 时，执行路径是：

1. `bin/bumpp.mjs`
2. `dist/cli.mjs`
3. `src/cli/index.ts` 的 `main()`

`main()` 做四件事：

1. 注册全局异常处理。
2. 调用 `parseArgs()` 获取最终选项。
3. 在需要时执行 Git 工作区检查。
4. 为非静默模式绑定默认进度输出，再调用 `versionBump()`。

其中 Git 检查通过 `git status --porcelain` 实现，默认只在 `all` 为 `false` 且未显式关闭 Git 检查时执行。这样做的目的，是防止在脏工作区中误发布。

### 4.2 参数与配置合并

`parseArgs()` 先通过 `cac` 解析命令行，再调用 `loadBumpConfig()` 加载配置文件。

配置来源按优先级可以理解为：

1. 内置默认值 `bumpConfigDefaults`
2. `bump.config.*` 文件或 `configFilePath` 指定文件
3. 当前命令行显式传入的参数

这里有两个值得注意的实现细节：

- 命令行中的第一个位置参数如果看起来像 release type 或合法 semver，会从 `files` 数组中剥离，转写到 `options.release`。
- 当用户同时传入 `--recursive` 和显式文件列表时，会提示递归选项被忽略，因为两者在语义上冲突。

### 4.3 创建 Operation

`versionBump()` 是核心入口。它首先调用 `Operation.start()`，而后者会进一步调用 `normalizeOptions()`。

这一阶段完成：

- release 语义标准化。
- commit/tag/push/install 等行为选项标准化。
- 目标文件集合展开。
- 交互接口合法性检查。

如果调用者通过 `currentVersion` 直接传入当前版本，`Operation` 构造函数会立即将其写入状态，后续无需再从文件扫描。

### 4.4 提交记录读取与展示

`versionBump()` 会调用 `getRecentCommits()` 读取最近提交，并在 `printCommits` 为真时使用 `printRecentCommits()` 展示。

这里的职责分离比较清晰：

- 提交解析由外部库 `tiny-conventional-commits-parser` 负责。
- 展示格式化由 `print-commits.ts` 负责。
- 真正使用这些提交进行版本推导则在 `get-new-version.ts` 中完成。

### 4.5 当前版本识别

`getCurrentVersion()` 会尝试从文件集中寻找当前版本。策略是：

1. 只检查 `.json` 文件。
2. 无论用户文件列表是否包含，都会额外尝试 `package.json`、`deno.json`、`deno.jsonc`。
3. 按顺序读取，并返回第一个合法 semver 版本。

这里体现出一个设计取向：当前版本只需要一个可靠来源，而不是要求所有文件都一致后才继续。这让工具更偏工程实用，但也意味着版本源一致性主要依赖调用方自己保证。

### 4.6 新版本计算

`getNewVersion()` 支持三种模式：

1. 显式版本：用户直接给出完整版本号。
2. 相对 bump：例如 `major`、`minor`、`patch`、`prepatch`、`next`、`conventional`。
3. 交互模式：通过 `prompts` 让用户选择。

#### `next` 的语义

- 当前版本已经是预发布版本时，`next` 等于 `prerelease`
- 否则等于 `patch`

#### `conventional` 的语义

根据最近提交自动推导：

- 只要存在 breaking change，则升级 `major`
- 否则只要存在 `feat`，则升级 `minor`
- 否则升级 `patch`

#### 预发布编号修正

`semver.inc()` 在从正式版本切换到预发布版本时，通常会生成 `beta.0`。项目在 `getNextVersion()` 中主动把这种首个预发布版本修正为 `beta.1`，更贴近发布习惯。

#### 交互模式的候选值

在 `promptForNewVersion()` 中，系统会预计算所有 release type 对应的目标版本，形成候选列表。若当前版本已包含 prerelease 标识，还会沿用当前版本的 preid，而不是强制使用默认 `beta`。

此外，还支持：

- `custom`：用户手动输入版本号。
- `config`：如果配置中提供了 `customVersion`，则显示“from config”选项。
- `none`：保持当前版本不变。

### 4.7 二次确认

如果 `confirm` 开启，`versionBump()` 会先打印概要信息，包括：

- 将更新哪些文件。
- commit、tag、execute、push、install 的最终行为。
- 当前版本和目标版本。

然后使用 `prompts` 再次询问是否执行。用户拒绝时直接退出进程。

### 4.8 npm 生命周期脚本

在文件实际写入前后，项目会按 npm version 约定运行：

1. `preversion`
2. `version`
3. `postversion`

实现位于 `run-npm-script.ts`，逻辑非常直接：

- 读取根 `package.json`
- 检查对应脚本是否存在
- 使用 `npm run <script> --silent` 执行

这里有一个边界条件：脚本读取只看当前 `cwd` 下的根 `package.json`，不会为 monorepo 中每个子包分别执行版本脚本。

### 4.9 文件更新

`updateFiles()` 会遍历归一化后的文件列表，并逐个调用 `updateFile()`。

它将文件更新策略分为两类。

#### 清单文件更新

以下文件名被视为结构化清单：

- `package.json`
- `package-lock.json`
- `bower.json`
- `component.json`
- `jsr.json`
- `jsr.jsonc`
- `deno.json`
- `deno.jsonc`

对于这类文件，`updateManifestFile()` 会：

1. 以 JSON/JSONC 方式解析。
2. 验证对象形态是否符合 `Manifest`。
3. 只修改顶层 `version` 字段。
4. 若是 `package-lock.json`，额外同步 `packages[""] .version`。

这里体现的设计原则是“结构化更新优先于文本替换”，可以降低误替换风险。

#### 文本文件更新

其他文件走 `updateTextFile()`：

1. 读取全文。
2. 检查是否包含当前版本字符串。
3. 构造正则，只替换带边界的版本号，兼容 `v1.2.3` 与 `1.2.3`。
4. 写回文件。

这使得 README、脚本文件或其他文本资源也能被一起升级，但它仍属于基于模式的替换，不会理解更复杂的语义上下文。

### 4.10 安装依赖与执行自定义命令

完成文件更新后，系统可能继续做两类扩展动作。

#### 安装依赖

当 `install` 为真时：

1. 使用 `package-manager-detector` 检测包管理器。
2. 构造 install 命令。
3. 在 `cwd` 下执行对应安装命令。

这种实现避免把安装逻辑写死为 `npm install`，更适合 pnpm、yarn、bun 等环境。

#### 执行自定义命令

`execute` 支持两种形式：

- 字符串命令。
- 函数回调，直接拿到 `Operation`。

这给了调用方很强的扩展能力，例如：

- 重新构建产物。
- 清理目录。
- 生成 changelog。
- 在提交前执行额外校验。

### 4.11 Git 发布链路

Git 流程由 `git.ts` 统一处理，顺序是：

1. `gitCommit()`
2. `gitTag()`
3. `gitPush()`

#### Commit

当启用 commit 时：

- 默认 commit message 模板为 `chore: release v`
- 若模板中含 `%s`，则替换为新版本号
- 否则把新版本拼接到模板末尾
- 默认只提交本次被更新的文件
- 若 `all` 为真，则使用 `git commit --all`
- 若 `noVerify` 为真，则附加 `--no-verify`
- 若 `sign` 为真，则附加 `--gpg-sign`

#### Tag

当启用 tag 时：

- 默认 tag 前缀为 `v`
- 创建 annotated tag
- tag message 复用 commit message
- 若 `sign` 为真，则使用签名 tag

#### Push

当启用 push 时：

- 先执行 `git push`
- 若启用了 tag，再执行 `git push --tags`

这个顺序说明 `bumpp` 的发布模型仍是典型的 Git 驱动发布，而不是 registry-first。

## 5. Monorepo 支持策略

`recursive` 选项的处理集中在 `normalizeOptions()`，属于“文件发现策略扩展”，而不是“每个包独立执行一次完整流程”。

它的实现方式是：

1. 当未显式指定 `files` 时，先放入默认清单模式。
2. 读取 `pnpm-workspace.yaml` 的 `packages`。
3. 读取根 `package.json` 的 `workspaces`。
4. 为每个 workspace 模式追加 `/package.json`。
5. 过滤掉以 `!` 开头的排除模式和重复项。
6. 使用 `tinyglobby` 展开成最终文件列表。

这意味着：

- monorepo 支持主要体现在“批量发现并升级多个包的版本号”。
- Git、脚本、安装、execute 仍然只按一次全局流程执行。
- 它不是逐包发布器，也不会为每个子包单独生成 commit/tag。

## 6. 配置系统设计

配置加载通过 `unconfig` 实现，默认查找 `bump.config.ts` 等变体，也允许通过 `configFilePath` 指向自定义文件。

`config.ts` 暴露了两个辅助能力：

- `loadBumpConfig()`：给 CLI 用，完成默认值、文件配置、显式覆盖三者合并。
- `defineConfig()`：给用户配置文件提供更清晰的类型提示。

配置系统的关键价值在于：

- 用户可以把常用发布策略固化下来，而不是每次传很多 CLI 参数。
- 代码调用与命令行调用共享同一组选项定义。

## 7. 进度反馈与错误处理

### 7.1 进度反馈

`Operation.update()` 在更新状态时，如果带有 `event` 且存在 `progress` 回调，会立即把当前结果快照推送出去。

CLI 默认绑定的 `progress()` 会把事件映射成终端文案，例如：

- 文件已更新
- 文件跳过
- Git commit 完成
- Git tag 完成
- Git push 完成
- npm script 完成

这种设计比把 `console.log()` 散落在各个业务模块里更干净，因为：

- 核心模块不依赖具体输出媒介。
- API 调用方可以接入自己的日志系统或 UI。

### 7.2 错误处理

CLI 使用统一的 `errorHandler()`：

- 普通错误直接打印 `message`
- 若是 `tinyexec` 的 `NonZeroExitError`，附加标准错误输出
- 在 `DEBUG` 或开发环境下打印堆栈
- 最终以 `FatalError` 退出

参数解析阶段则会单独以 `InvalidArgument` 退出。

总体上，错误处理策略偏直接，强调尽早失败，而不是做复杂恢复。

## 8. 模块职责速查

### 核心编排

- `src/version-bump.ts`：定义完整执行时序。
- `src/operation.ts`：承载状态、结果和进度事件。

### 输入与配置

- `src/cli/parse-args.ts`：命令行解析和配置合并。
- `src/config.ts`：配置默认值、配置文件加载、类型辅助。
- `src/normalize-options.ts`：把外部输入压平成内部稳定结构。

### 版本推导

- `src/get-current-version.ts`：确定当前版本来源。
- `src/get-new-version.ts`：计算或交互获取目标版本。
- `src/release-type.ts`：发布类型定义与判断。

### 文件与清单

- `src/update-files.ts`：分派清单更新或文本替换。
- `src/manifest.ts`：清单类型守卫。
- `src/fs.ts`：文本与 JSONC 文件读写。

### 发布动作

- `src/run-npm-script.ts`：执行 npm 生命周期脚本。
- `src/git.ts`：commit、tag、push。
- `src/print-commits.ts`：提交记录展示。

### CLI 运行时

- `src/cli/index.ts`：主流程入口与异常处理。
- `src/cli/run.ts`：源码启动入口。

## 9. 关键设计优点

### 9.1 单一状态上下文

整个流程围绕 `Operation` 展开，减少参数横向传递和状态碎片化，这是这个仓库最核心的架构优势。

### 9.2 CLI 与库能力复用

CLI 没有自己维护另一套发布逻辑，而是把所有能力压到 `versionBump()` 上。这样库 API 和命令行行为基本一致，降低了行为漂移风险。

### 9.3 可扩展但不过度抽象

扩展点主要集中在：

- 配置文件
- `customVersion`
- `execute`
- `progress`

这些点足以覆盖大多数定制需求，同时没有引入复杂插件系统，保持了实现可读性。

### 9.4 结构化更新优先

对 manifest 文件采用 JSON/JSONC 语义级修改，而不是全部做字符串替换，降低了误伤范围。

## 10. 当前架构的边界与限制

### 10.1 根版本源优先，缺少一致性校验

当前版本只从首个可读到的合法版本源获取，不会校验多个 manifest 之间是否一致。对于复杂 monorepo，这意味着工具更像“批量写入器”，不是“版本一致性审计器”。

### 10.2 monorepo 仍是单次全局发布模型

虽然支持递归发现工作区包，但脚本、Git、安装等步骤仍只执行一次，不能覆盖“每包独立发布”场景。

### 10.3 文本替换仍可能存在语义误命中

普通文本文件更新依赖正则边界规则，已经比裸字符串替换安全，但对于更复杂的版本表达方式，仍不如 AST 或格式感知更新稳健。

### 10.4 Git 命令对执行目录的依赖较强

Git 操作默认直接调用 `git`，没有显式给每个命令传入 `cwd`。这要求调用环境本身就在目标仓库上下文中，通常 CLI 场景没问题，但在嵌入式调用中需要调用方注意运行目录。

## 11. 适合的扩展方向

如果后续继续演进，这个架构最自然的扩展方向有：

1. 增加版本一致性检查模式，在更新前验证所有清单的现有版本是否一致。
2. 为 monorepo 引入包级发布计划，而不是仅扩展文件匹配集合。
3. 为文本文件引入可配置替换策略，例如显式占位符或自定义 matcher。
4. 让 Git 与 npm 脚本执行显式继承 `cwd`，降低 API 嵌入场景的歧义。
5. 把提交记录解析和 release 规则抽象成可替换策略，以支持更复杂的版本约定。

## 12. 一句话总结

`bumpp` 的架构本质上是“以 `Operation` 为中心的一次性发布流水线”：CLI 负责收口输入，核心流程负责顺序编排，领域模块负责版本推导与文件/Git 操作，基础设施模块负责 I/O 与第三方集成。它的优势在于足够简单、职责清晰、可脚本化，适合绝大多数单包或轻量 monorepo 的版本发布场景。
