# Overview 数据格式

页面是三列：左 Timeline、中 3D playback + Agent、右 Match stats。顶部是比赛条。下面按组件列出它读的数据，字段都是现在静态数据里实际用到的。

数据来源：`lib/incident.js`（`MATCH`）、`lib/incidents.js`（`RATINGS` / `MATCH_DECISIONS` / `MATCH_EVENTS` / `MATCH_PHASES` / `INCIDENTS`）、`components/overview/OverviewTab.jsx`（比分条、统计、阵容、势头）、`components/overview/AgentPanel.jsx`（解说）。

---

## Match bar

顶部比赛条。读 `MATCH`。时钟是前端自己从 `78:32` 往前走的，不在 `MATCH` 里。

```js
{
  competition: "Premier League", // 联赛
  round: "Matchweek 29",         // 轮次
  home: { code, name, color, text },
  away: { code, name, color, text },
  score: [2, 1],                 // [主队, 客队]
  clock: "78:32",                // 静态起点，页面上的 live 时钟另算
  stadium: "Etihad Stadium",
  attendance: "54,118",
  incidentId: "MCI-ARS-7829-04", // 展示用编号，不是 3D incident id
}
```

`home` / `away`：

| 字段 | 说明 |
| --- | --- |
| `code` | 三字缩写，比分条、势头图、时间轴都用它 |
| `name` | 全名，解说里用简称（City / Arsenal），不是这个字段 |
| `color` | 队色，圆点、进度条、势头柱 |
| `text` | 深色字色，Overview 目前没用 |

---

## Timeline · Decisions

左列 Decisions。一条决策一条。有 `incidentId` 时点进去进 `/pitch?incident=<id>`。

```js
{
  id: "d-tackle",          // 列表 key
  minute: 77,              // 整数分钟，显示成 77'
  label: "Tackle",         // 标题
  detail: "Studs above the ankle…",
  rating: "red",           // green | amber | red，查 RATINGS
  meta: "Law 12.2",        // 小字前缀，可空字符串
  incidentId: "tackle",    // 可选，对应 INCIDENTS.id
}
```

评级 `RATINGS`：

```js
{
  green: { label: "Correct", color: "#22c55e" },
  amber: { label: "Questionable", color: "#f59e0b" },
  red: { label: "Controversial", color: "#ef4444" },
}
```

底部计数是前端按 `rating` 数出来的：correct / questionable / controversial / 总条数。

关联的 `INCIDENTS` 条目（只在有 `incidentId` 时查）：

```js
{
  id: "tackle",
  label: "Tackle Controversy",
  short: "Tackle",
  minute: "77:38",
  rating: "red",
  status: "active",   // active = 有 3D，文案 "Open 3D review"；其它 = "Open review"
  incidentId: "MCI-ARS-7829-04",
  summary: "…",
}
```

Overview 只用 `id` 和 `status`。

---

## Timeline · Events

左列 Events，和右列势头图、中间解说共用 `MATCH_EVENTS`。半场哨来自 `MATCH_PHASES`，插在同一条时间轴上。

事件：

```js
{
  minute: 23,
  type: "goal",          // 见下表
  team: "home",          // home | away
  label: "MCI goal - 1-0",
  player: "Foden",       // 进球者 / 被罚者 / 上场球员
  assist: "De Bruyne",   // 可选，进球助攻
  note: "Tactical foul", // 可选，黄牌原因、VAR 说明、点球被扑
  score: "1-0",          // 可选，进球后的比分
  replaced: "Gundogan",  // 可选，仅换人：被换下的人
  incidentId: "offside", // 可选，能点进 pitch
}
```

`type`：

| type | 图标 | 额外字段 |
| --- | --- | --- |
| `goal` | 足球 | `assist`、`score` |
| `penalty-goal` | 足球 + PEN | `score` |
| `penalty-missed` | 足球划掉 + PEN | `note` |
| `yellow` / `red` | 黄牌 / 红牌 | `note` |
| `sub` | 上下箭头 | `replaced`（被换下） |
| `var` | 监视器 | `note`；标题固定显示 "VAR review" |

超过 90 分钟显示成 `90+n`。

阶段标记：

```js
{ minute: 45, kind: "ht", label: "Half-time", score: "1-0" }
```

`kind` 目前只有 `ht`。比赛还在进行，没有全场结束。

---

## 3D live playback

中间上方窗口。没有数据，只留了一个空的 16:9 区域，等实时 3D。

---

## Agent

中间下方。两个模式，数据不一样。

### Live commentary

一行解说：

```js
{
  minute: 23,
  second: 0,
  kind: "goal",   // 决定文字颜色
  text: "GOAL MCI. Foden finishes from De Bruyne's pass — 1-0.",
}
```

`kind` 分两类：

- 事件行，和 `MATCH_EVENTS.type` 一致：`goal` `penalty-goal` `penalty-missed` `yellow` `red` `var` `sub`
- 阶段行：`phase`（开球、半场）
- 填充行（不改比分、不发明牌）：`buildup` `attack` `chance` `defend` `setpiece` `referee` `offside` `atmosphere`

事件行由 `MATCH_EVENTS` 拼出来，模板按 `type` 取 `player` / `assist` / `note` / `score` / `replaced`。填充行是本地生成的，不是接口数据。时钟过了 `78:32` 之后，新行用当前时钟的 `minute` / `second`。

### Smart assistant

对话组件，没有比赛静态数据。占位文案是 `Ask about the match…`。

---

## Match stats

右列。队名和颜色还是 `MATCH.home` / `MATCH.away`。

### Momentum

46 个点，每 2 分钟一个，值域 `-1 ~ 1`。正数画在上半（主队），负数画在下半（客队）。事件图标复用 `MATCH_EVENTS`，按 `team` 分到图的上方或下方，横向位置是 `minute / 95`。

```js
[0.21, -0.14, 0.55, /* … 共 46 个 */]
```

现在是前端用种子算出来的占位，不是接口字段。接数据时直接给这个数组即可。

### Stat bars

一行一项，左主右客。`unit` 有就拼在数字后面（控球、传球成功率是 `"%"`），没有就原样显示。进度条按较大的一侧着色。

```js
{ label: "Possession", home: 58, away: 42, unit: "%" }
{ label: "Shots", home: 14, away: 9 }
{ label: "Expected goals", home: 1.84, away: 1.12 }
```

当前行：Possession、Shots、Shots on target、Big chances、Expected goals、Passes、Pass accuracy、Duels won、Corners、Offsides、Saves、Fouls、Yellow cards。

### Lineups

一块球场，客队在上、主队在下。`x` / `y` 是球场百分比（0–100）。评分显示一位小数。阵型文案写死 `4-3-3`，不在球员数据里。

```js
{
  team: "home",   // home | away，决定圆点颜色
  number: 47,
  name: "Foden",
  rating: 8.3,    // 模拟评分
  x: 83,
  y: 58,
}
```

22 人：客队门将在 `y: 8`，主队门将在 `y: 92`。同一行的 x 用 13 / 37 / 63 / 87（后卫）、24 / 50 / 76（中场）、17 / 50 / 83（前锋），避免名字叠在一起。
