# Recording Ops Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the “操作” column in the Recordings list so buttons don’t overlap by moving secondary actions into a “更多(…)” menu.

**Architecture:** Keep a primary “回放” button always visible; add a lightweight popover menu per row for “重命名/删除”, with click-outside-to-close and delete confirmation.

**Tech Stack:** Electron renderer (vanilla JS) + existing dark CSS theme (renderer/app.css).

---

## File structure

**Modify**
- `desktop-app/renderer/views/recordings.js` — replace inline `回放/重命名/删除` with `回放 + …(popover)`; implement open/close logic and menu item handlers.
- `desktop-app/renderer/app.css` — add reusable styles for the `…` button and popover menu (`.ops-menu`, `.ops-menu-pop`, `.ops-menu-item`, `.danger`).

**No backend changes**
- Reuse existing IPC: `recording:rename`, `recording:delete`.

---

### Task 1: Add popover menu styles

**Files:**
- Modify: `desktop-app/renderer/app.css`

- [ ] **Step 1: Add “ops menu” CSS classes**

Add styles (place near existing `.btn` styles):

```css
.ops-menu {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.ops-menu-btn {
  height: 30px;
  min-width: 34px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.06);
  color: #e6edf3;
  cursor: pointer;
}

.ops-menu-pop {
  position: absolute;
  top: 34px;
  right: 0;
  z-index: 9999;
  min-width: 140px;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(15, 20, 27, 0.98);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
}

.ops-menu-item {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(230, 237, 243, 0.92);
  text-align: left;
  cursor: pointer;
}

.ops-menu-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

.ops-menu-item.danger {
  color: #ff7b72;
}
```

- [ ] **Step 2: Manual verify (visual)**

Run: `npm run dev` (in `desktop-app`) and confirm popover looks readable on dark theme (no overlap, correct z-index).

- [ ] **Step 3: Commit**

```bash
git add desktop-app/renderer/app.css
git commit -m "style: add recordings ops menu popover styles"
```

---

### Task 2: Replace recordings row actions with “回放 + …” menu

**Files:**
- Modify: `desktop-app/renderer/views/recordings.js`

- [ ] **Step 1: Add a small helper to manage click-outside close**

In `renderRecordings()`, define helpers:

```js
let openPop = null; // HTMLElement | null
const closePop = () => {
  if (openPop) openPop.remove();
  openPop = null;
};
document.addEventListener('click', (e) => {
  if (!openPop) return;
  // if click happens inside popover or inside the “…” button, ignore
  if (openPop.contains(e.target)) return;
  closePop();
}, true);
```

(If you worry about multiple listeners, guard it with a module-level `let _docBound = false`.)

- [ ] **Step 2: For each row, render “回放” + “…”**

Replace the inline `btnRename` + `btnDelete` in the ops cell with:

```js
const wrap = document.createElement('div');
wrap.className = 'ops-menu';

wrap.appendChild(btnReplay);

const btnMore = document.createElement('button');
btnMore.className = 'ops-menu-btn';
btnMore.textContent = '…';
btnMore.title = '更多操作';

btnMore.addEventListener('click', (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  // toggle
  if (openPop) closePop();

  const pop = document.createElement('div');
  pop.className = 'ops-menu-pop';

  const miRename = document.createElement('button');
  miRename.className = 'ops-menu-item';
  miRename.textContent = '重命名';
  miRename.onclick = async () => { closePop(); /* reuse existing rename handler */ };

  const miDelete = document.createElement('button');
  miDelete.className = 'ops-menu-item danger';
  miDelete.textContent = '删除';
  miDelete.onclick = async () => { closePop(); /* reuse existing delete handler */ };

  pop.appendChild(miRename);
  pop.appendChild(miDelete);
  wrap.appendChild(pop);
  openPop = pop;
});

wrap.appendChild(btnMore);
ops.appendChild(wrap);
```

Then:
- move the existing rename logic into a small function `doRename(f)` and call it from `miRename`.
- move the existing delete logic into `doDelete(f)` and call it from `miDelete`.

- [ ] **Step 3: Ensure delete still confirms**

Keep:
```js
const ok = window.confirm('确认删除...删除后不可恢复');
```

- [ ] **Step 4: Manual verify**

Run: `npm run dev` then on “录制&回放” page:
- Narrow window width and confirm buttons no longer overlap
- Click `…` shows menu; click outside closes
- Rename works and refreshes list
- Delete works and refreshes list

- [ ] **Step 5: Commit**

```bash
git add desktop-app/renderer/views/recordings.js
git commit -m "feat: move recording row actions into more menu"
```

---

## Self-review checklist

- No overlap in the “操作” column at 50% window width.
- Menu does not get clipped; z-index high enough.
- Clicking anywhere outside menu closes it.
- “删除” remains a confirm + refresh.
- No IPC changes required.

---

## Execution choice

Plan complete and saved to `docs/superpowers/plans/2026-04-16-recording-ops-menu.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach?

