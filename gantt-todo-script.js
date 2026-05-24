"use strict";

async function runBackendAction(action, payload) {
    return api.runOnBackend(function(backendAction, backendPayload) {
        function nzd(d) {
            if (!d) return null;
            var n = String(d).replace(/\//g, "-");
            var p = api.dayjs(n, ["YYYY-MM-DD", "YYYY-M-D"], true);
            return p.isValid() ? p.format("YYYY-MM-DD") : null;
        }
        function $ch() {
            return typeof api.cheerio.load === "function"
                ? api.cheerio.load.bind(api.cheerio)
                : api.cheerio.default.load.bind(api.cheerio.default);
        }
        function parseR(t) {
            var m = t.match(/#every\s+(\d+)\s+(day|week|month)\b/i);
            return m ? { mode: "when-done", interval: { unit: m[2].toLowerCase(), value: Number(m[1]) }, raw: m[0] } : null;
        }
        function parseMeta(t) {
            var s = String(t || "").replace(/\s+/g, " ").trim();
            var sm = s.match(/#S-(\d{4}[-/]\d{2}[-/]\d{2})\b/i);
            var em = s.match(/#E-(\d{4}[-/]\d{2}[-/]\d{2})\b/i);
            var bm = s.match(/#(\d{4}[-/]\d{2}[-/]\d{2})\b/);
            var pm = s.match(/#P([1-4])\b/i);
            var fm = s.match(/#follow-?up\b/i);
            var rp = parseR(s);
            var c = s;
            if (sm) c = c.replace(sm[0], " ");
            if (em) c = c.replace(em[0], " ");
            if (bm) c = c.replace(bm[0], " ");
            if (pm) c = c.replace(pm[0], " ");
            if (fm) c = c.replace(fm[0], " ");
            if (rp) c = c.replace(rp.raw, " ");
            c = c.replace(/\s+/g, " ").trim();
            return {
                raw: s, text: c || s || "(empty)",
                startDate: nzd(sm ? sm[1] : null),
                endDate: nzd(em ? em[1] : bm ? bm[1] : null),
                priority: pm ? Number(pm[1]) : null,
                followUp: Boolean(fm), repeat: rp
            };
        }
        function nextD(task) {
            var r = task && task.repeat;
            if (!r || !r.interval || !r.interval.unit || !r.interval.value) return null;
            var b = nzd(task.endDate || task.startDate) || api.dayjs().format("YYYY-MM-DD");
            return api.dayjs(b).startOf("day").add(Number(r.interval.value), r.interval.unit).format("YYYY-MM-DD");
        }
        function repD(t, nd) {
            var d = nzd(nd);
            if (!d) throw new Error("bad date");
            var s = String(t || "");
            if (/#E-\d{4}[-/]\d{2}[-/]\d{2}\b/i.test(s)) return s.replace(/#E-\d{4}[-/]\d{2}[-/]\d{2}\b/i, "#E-" + d);
            if (/#\d{4}[-/]\d{2}[-/]\d{2}\b/.test(s)) return s.replace(/#\d{4}[-/]\d{2}[-/]\d{2}\b/, "#" + d);
            return s.trim() + " #" + d;
        }
        function rmR(t) {
            return String(t || "").replace(/\s*#every\s+\d+\s+(day|week|month)\b/gi, " ").replace(/\s+/g, " ").trim();
        }
        function normH(s) { var p = Number(s && s.historyRetention); return Number.isFinite(p) && p >= 0 ? Math.floor(p) : 0; }
        function collH($, el) {
            var e = [], sk = false;
            el.contents().each(function(i, el2) {
                if (el2.type === "text") { var t = $(el2).text().replace(/\s+/g, " ").trim(); if (t) e.push({ type: "task", text: rmR(t) }); return; }
                if (el2.type !== "tag") return;
                var $e = $(el2), tn = String(el2.tagName || el2.name || "").toLowerCase();
                if (!sk && $e.hasClass("todo-list__label")) { sk = true; return; }
                if (tn === "ul" || tn === "ol") {
                    $e.find("li").each(function(j, li) {
                        var d = $(li).find(".todo-list__label__description").first().text().replace(/\s+/g, " ").trim();
                        if (d) e.push({ type: "task", text: rmR(d) });
                    });
                }
            });
            return e;
        }
        function capH(e, l) {
            var v = [];
            for (var i = 0; i < e.length; i++) { if (e[i] && e[i].type === "task" && e[i].text) v.push(e[i]); }
            if (!l || l < 1 || v.length <= l) return v;
            return v.slice(0, l);
        }
        function bLI($, t, c) {
            var id = String(Math.random()).replace("0.", "") + Date.now().toString(16);
            var li = $("<li></li>").attr("data-list-item-id", id);
            var lb = $("<span></span>").addClass("todo-list__label");
            var w = $("<span></span>").attr("contenteditable", "false");
            var cb = $("<input>").attr("type", "checkbox").attr("tabindex", "-1");
            var d = $("<span></span>").addClass("todo-list__label__description").text(t);
            if (c) cb.attr("checked", "checked");
            w.append(cb);
            lb.append(w);
            lb.append(d);
            li.append(lb);
            return li;
        }
        function getTE(nid, idx) {
            var n = api.getNote(nid);
            if (!n) throw new Error("Note not found: " + nid);
            var rc = n.getContent(), c = Buffer.isBuffer(rc) ? rc.toString("utf8") : String(rc || "");
            var $ = $ch()(c);
            var el = $("ul.todo-list li").eq(Number(idx));
            if (!el.length) throw new Error("Task idx " + idx + " not found");
            return { note: n, $: $, taskElement: el };
        }
        function collN(ids) {
            if (!ids || !ids.length) return [];
            var all = [], vis = {};
            function w(id) {
                if (!id || vis[id]) return;
                vis[id] = true;
                var n = api.getNote(id);
                if (!n) return;
                if (n.type === "text") all.push(id);
                var kids = Array.isArray(n.children) ? n.children : [];
                for (var c = 0; c < kids.length; c++) w(kids[c].noteId);
            }
            for (var r = 0; r < ids.length; r++) w(ids[r]);
            var notes = [];
            for (var i = 0; i < all.length; i++) { try { var nn = api.getNote(all[i]); if (nn) notes.push(nn); } catch (e) {} }
            return notes;
        }
        function fetch(p) {
            var ids = Array.isArray(p && p.rootNoteIds) ? p.rootNoteIds.map(function(i) { return String(i).trim(); }).filter(Boolean) : [];
            if (!ids.length) return { tasks: [], stats: { totalNotes: 0, todoNotes: 0, uncheckedCount: 0 }, emptyScope: true };
            var notes = collN(ids);
            var $ = $ch();
            var tasks = [], total = 0, todo = 0;
            notes.forEach(function(note) {
                total++;
                var rc = note.getContent(), c = Buffer.isBuffer(rc) ? rc.toString("utf8") : String(rc || "");
                if (!c || c.indexOf("todo-list") === -1) return;
                var doc = $(c), items = doc("ul.todo-list li");
                if (!items.length) return;
                todo++;
                items.each(function(idx, el) {
                    var $el = doc(el), cb = $el.find('input[type="checkbox"]').first();
                    if (!cb.length) return;
                    var ch = cb.attr("checked") === "checked" || cb.attr("checked") === "" || cb.is(":checked");
                    var descEl = $el.find(".todo-list__label__description").first();
                    var desc;
                    if (descEl.length) {
                        desc = descEl.text().replace(/\s+/g, " ").trim();
                    } else {
                        desc = $el.clone().children("label").remove().end().text().replace(/\s+/g, " ").trim();
                    }
                    var meta = parseMeta(desc);
                    var path = typeof note.getBestNotePathString === "function" ? note.getBestNotePathString() : null;
                    var today = api.dayjs().format("YYYY-MM-DD"), ed = meta.endDate;
                    tasks.push({
                        id: note.noteId + ":" + idx, noteId: note.noteId,
                        noteTitle: note.title || "Untitled", notePath: path || "",
                        taskIndexInNote: idx, text: meta.text, raw: meta.raw,
                        done: ch, startDate: meta.startDate, endDate: ed,
                        priority: meta.priority, repeat: meta.repeat, followUp: meta.followUp,
                        overdue: Boolean(ed && ed < today)
                    });
                });
            });
            return { tasks: tasks, stats: { totalNotes: total, todoNotes: todo, uncheckedCount: tasks.filter(function(t) { return !t.done; }).length } };
        }
        function complete(task, settings) {
            var r = getTE(task.noteId, task.taskIndexInNote), n = r.note, $ = r.$, el = r.taskElement;
            var cb = el.find('input[type="checkbox"]').first();
            if (!cb.length) throw new Error("Checkbox not found");
            var rep = false, nd = null;
            if (task.repeat) {
                var de = el.find(".todo-list__label__description").first();
                if (de.length) {
                    nd = nextD(task);
                    if (nd) {
                        var ct = de.text().replace(/\s+/g, " ").trim(), nt = repD(ct, nd);
                        var hl = normH(settings), he = capH([{ type: "task", text: rmR(ct) }].concat(collH($, el)), hl);
                        var nel = bLI($, nt, false);
                        if (he.length) {
                            var nl = $("<ul></ul>").addClass("todo-list");
                            for (var h = 0; h < he.length; h++) nl.append(bLI($, he[h].text, true));
                            nel.append(nl);
                        }
                        el.replaceWith(nel);
                        rep = true;
                    }
                }
            }
            if (rep) { n.setContent($.html()); return { success: true, noteId: n.noteId, repeated: true, nextDate: nd }; }
            cb.attr("checked", "checked");
            n.setContent($.html());
            return { success: true, noteId: n.noteId, repeated: false, nextDate: null };
        }
        function uncomplete(task) {
            var r = getTE(task.noteId, task.taskIndexInNote);
            r.taskElement.find('input[type="checkbox"]').first().removeAttr("checked");
            r.note.setContent(r.$.html());
            return { success: true, noteId: r.note.noteId };
        }
        if (backendAction === "fetchTasks") return fetch(backendPayload);
        if (backendAction === "completeTask") return complete(backendPayload.task, backendPayload.settings);
        if (backendAction === "uncompleteTask") return uncomplete(backendPayload.task);
        throw new Error("Unknown action: " + backendAction);
    }, [action, payload]);
}

var STORAGE_KEY = "gantt_todo_settings_v1";
var DEFAULT_SETTINGS = { scope: "", refreshInterval: 30, historyRetention: 0, showOverdueFirst: true };
var SORT_COLUMNS = {
    index: { get: function(t) { return t.taskIndexInNote || 0; } },
    text: { get: function(t) { return (t.text || "").toLowerCase(); } },
    noteTitle: { get: function(t) { return (t.noteTitle || "").toLowerCase(); } },
    priority: { get: function(t) { return t.priority ? t.priority : 99; } },
    startDate: { get: function(t) { return t.startDate || ""; } },
    endDate: { get: function(t) { return t.endDate || ""; } }
};

function priorityClass(p) { return p ? "p" + p : ""; }
function priorityLabel(p) { return p ? "P" + p : "-"; }
function fmtDate(d) { if (!d) return "-"; var m = String(d).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(m) ? m : "-"; }
function todayStr() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function escHtml(s) { if (s == null) return ""; var div = document.createElement("div"); div.textContent = String(s); return div.innerHTML; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function readSettings() {
    try { var raw = localStorage.getItem(STORAGE_KEY); return raw ? Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)) : Object.assign({}, DEFAULT_SETTINGS); } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
}
function writeSettings(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {} }

var taskData = null;
var currentTab = "gantt";
var currentView = "Day";
var pendingPage = 1;
var completedPage = 1;
var pageSize = 20;
var sortField = null;
var sortAsc = true;
var searchQuery = "";
var autoRefreshTimer = null;
var ganttInstance = null;
var ganttHideDone = false;
var isLoading = false;
var lastLoadPromise = null;
var dom = {};

function cacheDom() {
    dom = {
        app: document.getElementById("gantt-todo-app"),
        tabs: document.querySelectorAll(".gantt-todo-tab"),
        panels: document.querySelectorAll(".gantt-todo-panel"),
        ganttContainer: document.getElementById("gantt-todo-gantt-container"),
        ganttStats: document.getElementById("gantt-stats"),
        ganttViewBtns: document.querySelectorAll("#gantt-todo-app .gantt-todo-gantt-controls button"),
        searchInput: document.getElementById("task-search-input"),
        searchBtn: document.getElementById("task-search-btn"),
        pendingMeta: document.getElementById("pending-tasks-meta"),
        pendingBody: document.getElementById("pending-tasks-body"),
        pendingPagination: document.getElementById("pending-pagination"),
        pendingSection: document.getElementById("pending-tasks-section"),
        completedMeta: document.getElementById("completed-tasks-meta"),
        completedBody: document.getElementById("completed-tasks-body"),
        completedPagination: document.getElementById("completed-pagination"),
        completedSection: document.getElementById("completed-tasks-section"),
        settingScope: document.getElementById("setting-scope"),
        settingRefresh: document.getElementById("setting-refresh"),
        settingHistory: document.getElementById("setting-history"),
        settingShowOverdue: document.getElementById("setting-show-overdue"),
        settingsSaveBtn: document.getElementById("settings-save-btn"),
        settingsSavedMsg: document.getElementById("settings-saved-msg"),
        pendingHeaders: document.querySelectorAll("#pending-tasks-table th[data-sort]")
    };
}

function ensureFrappeGantt() {
    if (typeof Gantt !== "undefined") return Promise.resolve();
    return new Promise(function(resolve, reject) {
        var s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.1/dist/frappe-gantt.min.js";
        s.onload = resolve;
        s.onerror = function() { reject(new Error("Failed to load Frappe Gantt from CDN")); };
        document.head.appendChild(s);
    });
}

async function loadTasks() {
    if (isLoading) return lastLoadPromise;
    isLoading = true;
    var promise = (async function() {
        try {
            var settings = readSettings();
            var scope = settings.scope ? settings.scope.split(/\s+/).filter(Boolean) : [];
            var result = await runBackendAction("fetchTasks", { rootNoteIds: scope });
            if (!result || result.emptyScope) { taskData = []; return []; }
            taskData = (result.tasks) || [];
            return taskData;
        } catch (err) { console.error("[GanttTodo] loadTasks failed:", err); throw err; } finally { isLoading = false; }
    })();
    lastLoadPromise = promise;
    return promise;
}

async function doCompleteTask(task) { return runBackendAction("completeTask", { task: task, settings: readSettings() }); }
async function doUncompleteTask(task) { return runBackendAction("uncompleteTask", { task: task }); }

function showEmptyScopeMessage() {
    dom.pendingBody.innerHTML = "<tr><td colspan=\"6\" class=\"gantt-todo-empty\">请在设置页面中配置任务收集范围（笔记ID）</td></tr>";
    dom.pendingPagination.innerHTML = "";
    dom.pendingSection.style.display = "";
    dom.completedBody.innerHTML = "";
    dom.completedPagination.innerHTML = "";
    dom.completedSection.style.display = "none";
    dom.pendingMeta.textContent = "";
    dom.completedMeta.textContent = "";
    if (dom.ganttStats) dom.ganttStats.textContent = "请先在设置中配置收集范围";
    dom.ganttContainer.innerHTML = "<div class=\"gantt-todo-empty\">请在设置页面中配置任务收集范围（笔记ID），例如: gXEI9kcMRw7F</div>";
}

function switchTab(tab) {
    currentTab = tab;
    dom.tabs.forEach(function(btn) { btn.classList.toggle("is-active", btn.dataset.tab === tab); });
    dom.panels.forEach(function(panel) { panel.classList.toggle("is-active", panel.dataset.panel === tab); });
    if (tab === "gantt") { renderGantt(); } else if (tab === "list") { renderTaskList(); } else if (tab === "settings") renderSettings();
}

function refreshStats() {
    if (currentTab === "gantt" && taskData) {
        var total = taskData.length, done = taskData.filter(function(t) { return t.done; }).length;
        dom.ganttStats.textContent = "共 " + total + " 个任务（已完成 " + done + " 个）";
    }
}

function drawTodayLine(container) {
    var svg = container ? container.querySelector("svg") : null;
    if (!svg) return;
    var old = svg.querySelector(".gantt-today-line");
    if (old) old.remove();
    var x = NaN;
    var hl = svg.querySelector(".today-highlight");
    if (hl) x = parseFloat(hl.getAttribute("x"));
    if (isNaN(x) || x <= 0) {
        var ticks = svg.querySelectorAll(".tick");
        if (ticks.length >= 2) {
            var fX = parseFloat(ticks[0].getAttribute("x"));
            var lX = parseFloat(ticks[ticks.length - 1].getAttribute("x"));
            if (!isNaN(fX) && !isNaN(lX) && lX > fX) {
                var now = new Date(), idx = -1, n = ticks.length;
                if (currentView === "Year") { var sy = new Date(now.getFullYear(),0,0); idx = Math.floor((now - sy) / 86400000) - 1; }
                else if (currentView === "Month") idx = now.getDate() - 1;
                else if (currentView === "Week") { var d = now.getDay(); idx = d === 0 ? 6 : d - 1; }
                else {
                    var dayNum = now.getDate();
                    for (var i = 0; i < n; i++) {
                        var m = (ticks[i].textContent || "").match(/\d+/g);
                        if (m) { for (var j = 0; j < m.length; j++) {
                            if (parseInt(m[j], 10) === dayNum) { idx = i; break; }
                        }}
                        if (idx >= 0) break;
                    }
                }
                if (idx >= 0 && idx < n) {
                    x = fX + (idx / (n - 1)) * (lX - fX);
                }
            }
        }
    }
    if (!isNaN(x) && x > 0) {
        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x); line.setAttribute("y1", "0");
        line.setAttribute("x2", x);
        line.setAttribute("y2", svg.getAttribute("height") || "300");
        line.setAttribute("stroke", "rgba(66,133,244,0.7)");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("class", "gantt-today-line");
        svg.insertBefore(line, svg.firstChild);
    }
}
}

function renderGantt() {
    var settings = readSettings();
    if (!settings.scope && (!taskData || !taskData.length)) { showEmptyScopeMessage(); return; }
    if (!taskData) return;
    var container = dom.ganttContainer, statsEl = dom.ganttStats;
    var hideDone = document.getElementById("gantt-hide-done") ? document.getElementById("gantt-hide-done").checked : false;
  var sourceTasks = hideDone ? taskData.filter(function(t) { return !t.done; }) : taskData;
  var datedTasks = sourceTasks.filter(function(t) { return t.startDate || t.endDate; });
    if (datedTasks.length === 0) {
        container.innerHTML = "<div class=\"gantt-todo-empty\">没有带日期的任务</div>";
        statsEl.textContent = "共 " + taskData.length + " 个任务（0 个带日期）";
        ganttInstance = null; return;
    }
    var ganttTasks = datedTasks.map(function(t) {
        var start = t.startDate || "", end = t.endDate || "";
        if (!start && end) { var d = new Date(end); d.setDate(d.getDate() - 1); start = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
        if (start && !end) end = start;
        if (!start || !end) return null;
        return { id: t.noteId + "-" + t.taskIndexInNote, name: t.text || "(empty)", start: start + "T00:00:00", end: end + "T23:59:00", progress: t.done ? 100 : 0, dependencies: "", custom_class: t.done ? "gantt-task-complete" : "" };
    }).filter(Boolean);
    if (ganttTasks.length === 0) {
        container.innerHTML = "<div class=\"gantt-todo-empty\">没有带日期的任务</div>";
        statsEl.textContent = "共 " + taskData.length + " 个任务（0 个有有效日期）";
        ganttInstance = null; return;
    }
    var prefix = hideDone ? "未完成 " : "";
  statsEl.textContent = prefix + "共 " + sourceTasks.length + " 个，甘特图显示 " + ganttTasks.length + " 个";
    container.innerHTML = "";
    ensureFrappeGantt().then(function() {
        if (container.children.length > 0) return;
        try {
            ganttInstance = new Gantt(container, ganttTasks, {
                view_mode: currentView, date_format: "YYYY-MM-DD HH:mm:ss",
                on_click: function(task) { var nid = task.id.split("-")[0]; if (nid && api && typeof api.activateNote === "function") api.activateNote(nid); },
                on_date_change: function(task) { console.log("[GanttTodo] Date drag:", task.id); },
                on_progress_change: function(task, progress) {
                    var parts = task.id.split("-"), nid = parts[0], tidx = parseInt(parts[1], 10), src = null;
                    for (var i = 0; i < taskData.length; i++) { if (taskData[i].noteId === nid && taskData[i].taskIndexInNote === tidx) { src = taskData[i]; break; } }
                    if (!src) return;
                    if (progress >= 100 && !src.done) {
                        doCompleteTask(src).then(function() { src.done = true; refreshStats(); }).catch(function(err) { console.error("[GanttTodo] Complete failed:", err); });
                    } else if (progress < 100 && src.done) {
                        doUncompleteTask(src).then(function() { src.done = false; refreshStats(); }).catch(function(err) { console.error("[GanttTodo] Uncomplete failed:", err); });
                    }
                },
                on_view_change: function(mode) {
                    currentView = mode;
                    setTimeout(function() { drawTodayLine(container); }, 50);
                },
                language: "zh"
            });
            drawTodayLine(container);
        } catch (err) { console.error("[GanttTodo] Gantt failed:", err); container.innerHTML = "<div class=\"gantt-todo-error\">甘特图渲染失败</div>"; }
    }).catch(function(err) { console.error("[GanttTodo] Frappe Gantt load failed:", err); container.innerHTML = "<div class=\"gantt-todo-error\">甘特图库加载失败</div>"; });
}

function setGanttView(view) {
    currentView = view;
    dom.ganttViewBtns.forEach(function(btn) { btn.classList.toggle("is-active", btn.dataset.view === view); });
    renderGantt();
}

function renderTaskList() {
    var settings = readSettings();
    if (!settings.scope && (!taskData || !taskData.length)) { showEmptyScopeMessage(); return; }
    if (!taskData) return;
    var filtered = taskData;
    if (searchQuery) { var q = searchQuery.toLowerCase(); filtered = taskData.filter(function(t) { return (t.text || "").toLowerCase().indexOf(q) >= 0; }); }
    if (sortField && SORT_COLUMNS[sortField]) {
        var accessor = SORT_COLUMNS[sortField].get;
        filtered = filtered.slice().sort(function(a, b) {
            var va = accessor(a), vb = accessor(b);
            var cmp = (typeof va === "string" && typeof vb === "string") ? va.localeCompare(vb) : (va < vb ? -1 : va > vb ? 1 : 0);
            return sortAsc ? cmp : -cmp;
        });
    }
    var pending = filtered.filter(function(t) { return !t.done; });
    var completed = filtered.filter(function(t) { return t.done; });
    pendingPage = clamp(pendingPage, 1, Math.max(1, Math.ceil(pending.length / pageSize)));
    completedPage = clamp(completedPage, 1, Math.max(1, Math.ceil(completed.length / pageSize)));
    renderPendingTasks(pending);
    renderPagination("pending-pagination", pendingPage, pending.length, function(p) { pendingPage = p; renderTaskList(); });
    renderCompletedTasks(completed);
    renderPagination("completed-pagination", completedPage, completed.length, function(p) { completedPage = p; renderTaskList(); });
    var pVisible = pending.length > 0, cVisible = completed.length > 0;
    dom.pendingSection.style.display = (pVisible || cVisible) ? "" : "none";
    dom.completedSection.style.display = cVisible ? "" : "none";
    if (pending.length === 0 && completed.length === 0) {
        dom.pendingBody.innerHTML = "<tr><td colspan=\"6\" class=\"gantt-todo-empty\">" + (searchQuery ? "没有匹配的任务" : "暂无任务") + "</td></tr>";
        dom.pendingPagination.innerHTML = "";
        dom.pendingSection.style.display = "";
    }
}

function renderPendingTasks(pending) {
    var body = dom.pendingBody, meta = dom.pendingMeta;
    var start = (pendingPage - 1) * pageSize, page = pending.slice(start, start + pageSize);
    if (page.length === 0) { body.innerHTML = "<tr><td colspan=\"6\" class=\"gantt-todo-empty\">暂无待办任务</td></tr>"; meta.textContent = ""; return; }
    var html = "";
    for (var i = 0; i < page.length; i++) {
        var t = page[i], idx = start + i + 1, pC = priorityClass(t.priority), pL = priorityLabel(t.priority);
        var rB = t.repeat ? "<span class=\"gantt-todo-repeat-badge\">&#x1F504;</span>" : "";
        html += "<tr><td class=\"col-index\">" + idx + "</td><td class=\"col-check\"><label class=\"gantt-todo-check-wrap\"><input type=\"checkbox\" data-action=\"complete\" data-note-id=\"" + escHtml(t.noteId) + "\" data-task-idx=\"" + t.taskIndexInNote + "\"><span class=\"gantt-todo-checkmark\"></span></label></td><td class=\"col-content\"><span class=\"gantt-todo-task-text\" data-note-id=\"" + escHtml(t.noteId) + "\" data-task-idx=\"" + t.taskIndexInNote + "\">" + escHtml(t.text) + rB + "</span>" + (t.notePath ? "<div class=\"gantt-todo-note-path\">" + escHtml(t.notePath) + "</div>" : "") + "</td><td class=\"col-note\" title=\"" + escHtml(t.noteTitle) + "\">" + escHtml(t.noteTitle) + "</td><td class=\"col-priority\"><span class=\"gantt-todo-priority " + pC + "\">" + pL + "</span></td><td class=\"col-date\">" + fmtDate(t.startDate) + "</td><td class=\"col-date\">" + fmtDate(t.endDate) + "</td></tr>";
    }
    body.innerHTML = html;
    meta.textContent = "共 " + pending.length + " 项待办";
}

function renderCompletedTasks(completed) {
    var body = dom.completedBody, meta = dom.completedMeta;
    var start = (completedPage - 1) * pageSize, page = completed.slice(start, start + pageSize);
    if (page.length === 0) { body.innerHTML = "<tr><td colspan=\"6\" class=\"gantt-todo-empty\">暂无已完成任务</td></tr>"; meta.textContent = ""; return; }
    var html = "";
    for (var i = 0; i < page.length; i++) {
        var t = page[i], idx = start + i + 1, pC = priorityClass(t.priority), pL = priorityLabel(t.priority);
        html += "<tr><td class=\"col-index\">" + idx + "</td><td class=\"col-check\"><label class=\"gantt-todo-check-wrap\"><input type=\"checkbox\" data-action=\"uncomplete\" data-note-id=\"" + escHtml(t.noteId) + "\" data-task-idx=\"" + t.taskIndexInNote + "\" checked><span class=\"gantt-todo-checkmark\"></span></label></td><td class=\"col-content\"><span class=\"gantt-todo-task-text\" data-note-id=\"" + escHtml(t.noteId) + "\" data-task-idx=\"" + t.taskIndexInNote + "\">" + escHtml(t.text) + "</span>" + (t.notePath ? "<div class=\"gantt-todo-note-path\">" + escHtml(t.notePath) + "</div>" : "") + "</td><td class=\"col-note\" title=\"" + escHtml(t.noteTitle) + "\">" + escHtml(t.noteTitle) + "</td><td class=\"col-priority\"><span class=\"gantt-todo-priority " + pC + "\">" + pL + "</span></td><td class=\"col-date\">" + fmtDate(t.startDate) + "</td><td class=\"col-date\">" + fmtDate(t.endDate) + "</td></tr>";
    }
    body.innerHTML = html;
    meta.textContent = "共 " + completed.length + " 项已完成";
}

function renderPagination(containerId, page, total, onPage) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var tp = Math.max(1, Math.ceil(total / pageSize));
    if (total <= pageSize) { el.innerHTML = ""; return; }
    var html = "<span>第 " + page + "/" + tp + " 页，共 " + total + " 项</span>";
    html += "<button data-page=\"" + (page - 1) + "\" " + (page <= 1 ? "disabled" : "") + ">&#x2039; 上一页</button>";
    html += "<button data-page=\"" + (page + 1) + "\" " + (page >= tp ? "disabled" : "") + ">下一页 &#x203A;</button>";
    html += "<select class=\"gantt-todo-page-size\">";
    [10, 20, 30, 50, 100].forEach(function(s) { html += "<option value=\"" + s + "\" " + (s === pageSize ? "selected" : "") + ">每页 " + s + "</option>"; });
    html += "</select>";
    el.innerHTML = html;
    el.querySelectorAll("button[data-page]").forEach(function(btn) { btn.addEventListener("click", function() { var p = parseInt(btn.dataset.page, 10); if (p >= 1 && p <= tp) onPage(p); }); });
    var sel = el.querySelector(".gantt-todo-page-size");
    if (sel) { sel.addEventListener("change", function() { pageSize = parseInt(sel.value, 10); pendingPage = 1; completedPage = 1; renderTaskList(); }); }
}

async function handleCheckboxChange(cb) {
    var action = cb.dataset.action, nid = cb.dataset.noteId, tidx = parseInt(cb.dataset.taskIdx, 10), task = null;
    for (var i = 0; i < taskData.length; i++) { if (taskData[i].noteId === nid && taskData[i].taskIndexInNote === tidx) { task = taskData[i]; break; } }
    if (!task) { console.warn("[GanttTodo] Task not found:", nid, tidx); return; }
    try {
        if (action === "complete") { await doCompleteTask(task); task.done = true; } else { await doUncompleteTask(task); task.done = false; }
        if (currentTab === "list") renderTaskList();
        refreshStats();
    } catch (err) { console.error("[GanttTodo] Toggle failed:", err); cb.checked = !cb.checked; }
}

function handleTaskTextClick(el) { var nid = el.dataset.noteId; if (nid && api && typeof api.activateNote === "function") api.activateNote(nid); }
function doSearch() { var q = (dom.searchInput.value || "").trim(); if (q === searchQuery) return; searchQuery = q; pendingPage = 1; completedPage = 1; renderTaskList(); }

function handleSortClick(th) {
    var field = th.dataset.sort;
    if (!field || !SORT_COLUMNS[field]) return;
    if (sortField === field) sortAsc = !sortAsc;
    else { sortField = field; sortAsc = true; }
    pendingPage = 1; completedPage = 1;
    dom.pendingHeaders.forEach(function(h) { h.classList.remove("is-sorted"); var a = h.querySelector(".sort-arrow"); if (a) a.textContent = ""; });
    th.classList.add("is-sorted");
    var a = th.querySelector(".sort-arrow");
    if (a) a.textContent = sortAsc ? " ▲" : " ▼";
    renderTaskList();
}

function renderSettings() {
    var s = readSettings();
    dom.settingScope.value = s.scope || "";
    dom.settingRefresh.value = s.refreshInterval || 30;
    dom.settingHistory.value = s.historyRetention || 0;
    dom.settingShowOverdue.checked = s.showOverdueFirst !== false;
    dom.settingsSavedMsg.classList.remove("show");
}

function saveSettings() {
    var s = { scope: (dom.settingScope.value || "").trim(), refreshInterval: clamp(parseInt(dom.settingRefresh.value, 10) || 30, 5, 3600), historyRetention: clamp(parseInt(dom.settingHistory.value, 10) || 0, 0, 9999), showOverdueFirst: dom.settingShowOverdue.checked };
    writeSettings(s);
    dom.settingsSavedMsg.classList.add("show");
    setTimeout(function() { dom.settingsSavedMsg.classList.remove("show"); }, 2000);
    reloadAll();
}

function startAutoRefresh() {
    if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
    var iv = (readSettings().refreshInterval || 30) * 1000;
    if (iv < 5000) return;
    autoRefreshTimer = setInterval(function() { if (currentTab !== "settings") reloadAll(); }, iv);
}

async function reloadAll() {
    if (isLoading) return;
    try {
        await loadTasks();
        if (currentTab === "gantt") renderGantt();
        else if (currentTab === "list") renderTaskList();
    } catch (err) { console.error("[GanttTodo] Reload failed:", err); if (currentTab === "gantt") dom.ganttContainer.innerHTML = "<div class=\"gantt-todo-error\">" + escHtml(err.message || "未知错误") + "</div>"; }
}

function init() {
    cacheDom();
    if (!dom.app) return;
    dom.tabs.forEach(function(btn) { btn.addEventListener("click", function() { switchTab(btn.dataset.tab); }); });
    dom.ganttViewBtns.forEach(function(btn) { btn.addEventListener("click", function() { setGanttView(btn.dataset.view); }); });
    dom.searchBtn.addEventListener("click", doSearch);
    dom.searchInput.addEventListener("keydown", function(e) { if (e.key === "Enter") doSearch(); });
    dom.pendingHeaders.forEach(function(th) { th.addEventListener("click", function() { handleSortClick(th); }); });
    dom.pendingBody.addEventListener("change", function(e) { var cb = e.target.closest("input[type=\"checkbox\"][data-action]"); if (cb) handleCheckboxChange(cb); });
    dom.completedBody.addEventListener("change", function(e) { var cb = e.target.closest("input[type=\"checkbox\"][data-action]"); if (cb) handleCheckboxChange(cb); });
    dom.pendingBody.addEventListener("click", function(e) { var el = e.target.closest(".gantt-todo-task-text"); if (el) handleTaskTextClick(el); });
    dom.completedBody.addEventListener("click", function(e) { var el = e.target.closest(".gantt-todo-task-text"); if (el) handleTaskTextClick(el); });
    dom.settingsSaveBtn.addEventListener("click", saveSettings);
    var hideDoneCb = document.getElementById("gantt-hide-done");
    if (hideDoneCb) {
        hideDoneCb.addEventListener("change", function() {
            if (currentTab === "gantt") renderGantt();
        });
    }
    var hideCb = document.getElementById("gantt-hide-done");
    if (hideCb) {
        hideCb.checked = localStorage.getItem("gantt_hide_done") === "true";
        hideCb.addEventListener("change", function() {
            localStorage.setItem("gantt_hide_done", hideCb.checked ? "true" : "");
            if (currentTab === "gantt") renderGantt();
        });
    }
    renderSettings();
    loadTasks().then(function() {
        var s = readSettings();
        if (!s.scope && (!taskData || !taskData.length)) showEmptyScopeMessage();
        else { renderGantt(); if (currentTab === "list") renderTaskList(); }
    }).catch(function(err) { console.error("[GanttTodo] Init failed:", err); dom.ganttContainer.innerHTML = "<div class=\"gantt-todo-error\">" + escHtml(err.message || "未知错误") + "</div>"; });
    startAutoRefresh();
    document.addEventListener("keydown", function(e) { if (e.key === "Escape" && document.activeElement === dom.searchInput) { dom.searchInput.value = ""; doSearch(); dom.searchInput.blur(); } });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();