# Gantt TODO 面板 - Trilium 插件

## 结构

- `nlKR1j0QzfmS` (前端展示页面)
  - `XKRkB7R18Zd0` (Gantt TODO) - type: render, `~renderNote` → GanttTodoTemplate
    - `uyCR0QlmclCu` (GanttTodoTemplate) - type: code, mime: text/html
      - `nGQiYb7Vm1qU` (GanttTodoBackend) - type: code, mime: application/javascript;env=frontend, pos: 10
      - `trn5nrNHVkPo` (GanttTodoScript) - type: code, mime: application/javascript;env=frontend, pos: 20

## 功能

- **甘特图** — Frappe Gantt 时间线可视化，日/周/月/年视图切换
- **任务列表** — 筛选、排序、分页、复选框完成/取消完成
- **设置** — 收集范围配置、自动刷新、历史保留量
- **任务语法** — `#S-`/`#E-`/`#date`、`#P1`~`#P4`、`#Follow-up`、`#every n day/week/month`
- **重复任务** — 完成时自动生成下一次，历史归档到子列表
- **暗色主题** — 甘特图 SVG 样式使用 Trilium CSS 变量，自动适配

## 数据文件

| 工作区文件 | Trilium 笔记 | 类型 |
|-----------|-------------|------|
| `gantt-todo-template.html` | GanttTodoTemplate | code/text/html |
| `gantt-todo-backend.js` | GanttTodoBackend | code/application/javascript;env=frontend |
| `gantt-todo-script.js` | GanttTodoScript | code/application/javascript;env=frontend |

## 开发记录

1. 创建项目结构，实现后端任务收集/解析逻辑 (8046c30)
2. 创建前端模板 HTML+CSS 三标签布局 (ac4f33c)
3. 实现前端 JS：甘特图、任务列表、设置面板 (ac4f33c)
4. 修复：render note 模块加载问题（module.exports + const 解构导入）
5. 修复：api.runOnBackend 参数数组化 `[action, payload]`
6. 修复：移除全部笔记回退策略，改为 scope 必需模式
7. 修复：甘特图年视图模式名 Quarter → Year
8. 新增：甘特图暗色主题 CSS（Trilium CSS 变量）
9. 修复：日/周视图日期格式（ISO T 分隔符 + 时间精度）
10. 新增：README 文档（中英文）

## 已知问题

- 设置页 scope 为空时显示引导提示（不移除该提示，因为扫全库性能差）
- Frappe Gantt CDN 加载失败时甘特图不可用
