<!-- This is the English version. Chinese version available at readme_zh.md -->

> 📖 This document is in English. 中文版本: [readme_zh.md](readme_zh.md).

# Gantt TODO Panel — Trilium Gantt Task Management

## Overview

Trilium's built-in todo-list supports task markers (`#date`, `#P1`–`#P4`, `#Follow-up`, recurring tasks), but there's no visual panel to browse, filter, and track all tasks across notes on a timeline.

This plugin adds a **Gantt TODO Panel** to Trilium's frontend showcase page. It collects tasks from specified notes, parses the task markers, and presents them in three views:

### Tab 1: Gantt Chart
- Visual timeline of all dated tasks using [Frappe Gantt](https://github.com/frappe/gantt)
- Toggle between Day / Week / Month / Year views
- Click a bar to navigate to the source note
- Progress bar reflects completion status
- Automatically adapts to Trilium's light/dark theme
- **Filter** — Filter tasks by source note
- **Sort** — Sort by priority (high→low / low→high), start date, end date
- **Hide done** — Toggle completed tasks visibility

![alt text](file/show.webp)

### Tab 2: Task List
- **Filter** — Search tasks by text content
- **Sort** — Click any column header (#, Status, Content, Note, Priority, Start, End) to sort
- **Pagination** — Adjustable page size (10/20/30/50/100)
- **Checkbox toggle** — Check to complete, uncheck to restore
- **Completed section** — Done tasks shown separately, can be undone
- **Note column** — Click note title to navigate to the source note

![alt text](file/showList.webp)

### Tab 3: Settings
- **Collection Scope** — Specify which notes (IDs) to collect tasks from
- **Auto-refresh** — Automatic data refresh interval
- **History Retention** — Limit how many recurring task history entries are kept
- **Overdue Priority** — Toggle overdue-first sorting

## Installation

### Option 1: Manual File Copy

1. Open the note `nlKR1j0QzfmS` (Frontend Showcase) in Trilium
2. Create the following structure under that note:

```
Gantt TODO (render type)
  └── ~renderNote → GanttTodoTemplate (code, mime: text/html)
                      ├── GanttTodoBackend (code, mime: application/javascript;env=frontend)
                      └── GanttTodoScript (code, mime: application/javascript;env=frontend)
```

3. Copy the contents of `gantt-todo-template.html` into the **GanttTodoTemplate** note
4. Copy the contents of `gantt-todo-backend.js` into the **GanttTodoBackend** note
5. Copy the contents of `gantt-todo-script.js` into the **GanttTodoScript** note
6. Set the `~renderNote` relation on the **Gantt TODO** note pointing to **GanttTodoTemplate**

### Option 2: Use Trilium API
If you have API access, the notes can be created programmatically (see the `.sisyphus/` directory for the build script).

## Usage

1. Open the **Gantt TODO** panel from the frontend showcase (`nlKR1j0QzfmS`)
2. Go to **Settings** tab
3. Enter one or more note IDs in the scope field (separated by spaces) — tasks from these notes and all their descendants will be collected
4. Click **Save Settings**
5. Switch to **Gantt Chart** or **Task List** to see your tasks

### Task Syntax Reference

Tasks in notes use standard Trilium todo-list syntax with markers:

| Syntax                    | Meaning                        | Example         |
| ------------------------- | ------------------------------ | --------------- |
| `#YYYY-MM-DD`             | Due date (end date)            | `#2026-05-28`   |
| `#S-YYYY-MM-DD`           | Start date                     | `#S-2026-05-24` |
| `#E-YYYY-MM-DD`           | End date (explicit)            | `#E-2026-06-01` |
| `#P1` ~ `#P4`             | Priority (1 highest, 4 lowest) | `#P1`           |
| `#Follow-up`              | Mark as follow-up              | `#Follow-up`    |
| `#every n day/week/month` | Recurring task                 | `#every 1 day`  |

Example:
```markdown
- [ ] Write daily report #2026-05-24 #every 1 day #P4
- [ ] Code review #S-2026-05-25 #E-2026-05-29 #P1 #Follow-up
- [ ] Monthly summary #S-2026-05-20 #E-2026-05-30 #P2
```

When a recurring task is completed, the next occurrence is automatically generated with the updated date. Completed history entries are moved into a nested sub-list under the next occurrence.

## Architecture

### Note Structure

```
nlKR1j0QzfmS (Frontend Showcase)
  ├── Gantt TODO (render) ──renderNote──→ GanttTodoTemplate
  └── GanttTodoTemplate (code/text/html)
       ├── GanttTodoBackend (pos 10) — Backend data operations
       └── GanttTodoScript (pos 20) — Frontend UI rendering
```

### Module System

Trilium loads child notes of a `render`/`code` note as CommonJS modules. The **note title** becomes the module name:

```javascript
// GanttTodoBackend — exports functions
module.exports = { runBackendAction };

// GanttTodoScript — imports sibling module
const { runBackendAction } = GanttTodoBackend;
```

Child notes are loaded in **position order** (lower loads first). Position 10 = Backend loads before Position 20 = Script.

### Data Flow

```
User opens panel → init() → cacheDom() → loadTasks()
  → runBackendAction('fetchTasks', {rootNoteIds: [...]})
    → api.runOnBackend(fn, [action, payload])   ← executes on Trilium server
      → 1. Walk note tree from each root ID
      → 2. For each text note, parse HTML via Cheerio
      → 3. Find <ul class="todo-list"> items
      → 4. Extract description, parse markers (dates, priority, repeat, follow-up)
      → 5. Return structured task objects
    → Frontend renders Gantt chart / Task list / Settings
```

### API Usage

| API                                | Purpose                                                  |
| ---------------------------------- | -------------------------------------------------------- |
| `api.runOnBackend(callback, args)` | Execute backend operations (task collection, completion) |
| `api.getNote(noteId)`              | Fetch a note by ID (backend)                             |
| `api.dayjs()`                      | Date parsing and formatting (backend)                    |
| `api.cheerio.load(html)`           | Parse note HTML content (backend)                        |
| `Buffer.isBuffer(content)`         | Handle binary note content (backend)                     |
| `api.activateNote(noteId)`         | Navigate to source note on bar/card click                |
| `localStorage`                     | Store settings (frontend)                                |
| `api.searchForNotes(query)`        | Search notes by type (fallback)                          |

### Task Markers Parsing

The backend function `parseTaskMeta()` extracts structured data from task description text using regex:

1. Strip all marker tokens (`#S-date`, `#E-date`, `#P1`–`#P4`, `#Follow-up`, `#every n unit`)
2. The remaining text becomes the task display text
3. Extracted markers populate `startDate`, `endDate`, `priority`, `followUp`, `repeat` fields

## Development

### Files

| File                       | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `gantt-todo-template.html` | HTML template + CSS for the render note                       |
| `gantt-todo-backend.js`    | Backend module (task collection, parsing, completion, repeat) |
| `gantt-todo-script.js`     | Frontend module (UI rendering, events, settings)              |
| `readme.md`                | This file (English)                                           |
| `readme_zh.md`             | Chinese documentation                                         |

### Dependencies

- **Frappe Gantt** (v0.6.1) — Loaded from CDN (`cdn.jsdelivr.net`) for Gantt chart rendering
- **Trilium built-ins** — `api.dayjs`, `api.cheerio`, `api.runOnBackend`, `api.getNote`

## Known Issues

- Gantt chart Day/Week views require datetime precision (ISO format with `T` separator)
- Frappe Gantt CDN must be accessible; if blocked by CSP, the chart will show a load error
- The settings "Scope" field is required — empty scope shows an instruction message instead of searching all notes

## License

MIT
