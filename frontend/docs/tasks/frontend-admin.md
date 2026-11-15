# Frontend task — Admin dashboard (`admin.html`, phase 3)

**Owner:** Eain Si Htun · **Review:** Win Thant Aung (frontend lead)
**How you get and send the code:** a zip from Win Thant Aung → you work in it → you send back a zip of
your files (section 8). No GitHub account needed.
**Flowcharts:** `docs/flows/4-admin-menu.png`, `4a-applications.png`, `4b-shops-categories.png`,
`4c-reports-appeals.png`, `4d-users-log.png` — the screens below follow them one to one.

You build the admin pages **on fake (mock) data**, exactly like the rest of the frontend. The backend
team connects them to PHP later; you don't write PHP or SQL. When you're done, an admin can check new
shops and payments, manage shops, public places and categories, handle reports and appeals, ban or
unban users and read the audit log.

---

## 1. Before you start (½ day)

1. Unzip `POINTER-frontend.zip` from Win Thant Aung into a folder **without spaces or Burmese letters
   in the path** (e.g. `D:\pointer-admin\`). Install **Node.js 22.12 or newer** (the LTS from nodejs.org) if you don't have it.
2. Run it: Windows → double-click `start-windows.bat` (Mac / Linux → `npm start` in the folder). The first
   start installs the packages (a few minutes, needs internet); then open the address it prints
   (http://localhost:5173). Keep that window open while you work — the page reloads on every save.
3. Click through these pages to learn the look and the code style you will copy:
   - `owner.html` (Log in → "Try as a demo shop owner") — dark header with gold numbers, white cards, forms.
   - `account.html`, `deals.html`, `messages.html` — lists, chips, dialogs, empty states.
4. Read, in this order:
   - the five admin flowcharts above;
   - `HANDOFF.md` → **Database** (the 15 tables) and **Roles**;
   - `src/pages/owner.js` + `src/api/owner.js` + `src/styles/pages/owner.css` — your files will look like these.

## 2. How we write code (please follow exactly)

**Stack:** Vite + plain HTML, CSS and JavaScript ES modules. **No** React / Vue / jQuery / Bootstrap /
Tailwind, no new npm packages (ask first if you think you need one).

**Your files** (create them; don't edit other pages):

| File | What goes in it |
|---|---|
| `admin.html` | Page skeleton: copy the `<head>` of `owner.html` (fonts, icons), `<body class="page-app page-admin">` |
| `src/pages/admin.js` | The page script: imports, render functions per section, event handlers |
| `src/styles/pages/admin.css` | Styles for the admin page only, class names start with `admin-` |
| `src/api/admin.js` | Every admin data function (mock now, PHP later) — see section 5 |
| `src/data/admin.js` | Fake data: applications, reports, appeals, users, audit log |

**Small edits to shared files (one line each, allowed):**

- `vite.config.js` → add `admin: 'admin.html',` to `pages`.
- `src/api/api.js` → add `export * from './admin.js';` at the end (pages only import from `api.js`).
- `src/i18n/en.json` and `src/i18n/my.json` → a new `"admin": { … }` block (both files, same keys).

**Rules:**

1. **Data only through `src/api/`.** Page code never calls `fetch` and never imports from `src/data/`.
   Each API function has a `USE_MOCK` branch (fake data from the browser's demo store) and a real branch
   (`request('admin/....php', …)`) — copy the pattern of `src/api/owner.js`. Write the PHP endpoint, the
   request and the answer in a comment above every function.
2. **Changes on mock data** are saved with `readDemo` / `writeDemo` (`src/api/demo-store.js`), so they
   survive a page reload. Every change also adds an audit-log row (section 4.8).
3. **Building HTML:** use `el()` from `src/lib/dom.js`, and `textContent` for anything that came from data —
   never put user text into `innerHTML`.
4. **Text:** no English text hard-coded in JS. Every label uses `t('admin.…')` or `data-i18n="admin.…"`,
   with the English **and** Burmese text in `en.json` / `my.json`. Dates: `dateInYangon()` /
   `timeInYangon()` from `src/lib/format.js`; numbers: `number()`.
5. **Styles:** only the variables in `src/styles/tokens.css` (colours, fonts, spacing, radius, shadow).
   No new hex colours, no inline `style=""`. Reuse `app-*` classes from `src/styles/pages/app.css`
   (`app-hero`, `app-main`, `app-button`, `app-button--gold`, `app-chip`, `app-muted`) before writing new ones.
6. **Comments:** every file starts with 1–3 lines saying what it is for. Small functions with clear
   English names (`renderApplications`, `approveApplication`).
7. **Accessibility:** real `<button>`s and `<label>`s, visible focus (`:focus-visible` gold outline),
   confirm dialogs with `<dialog>`, result messages with `toast()` from `src/lib/dom.js`, respect
   `prefers-reduced-motion`.
8. **Photos:** shop photos and payment screenshots are shown as uploaded (real photos only — no drawn or generated pictures).

## 3. Design

**Look:** the same family as Owner mode — a **dark dusk header** with gold numbers, then a light page
(`--land`) with **white cards** (`--surface`, `--radius-lg`, `--shadow-card`). Headings in Fraunces
(`--font-display`), everything else in Onest (`--font-ui`). Calm and clear: this is a work tool, so no
big animations — only short fades (150–200 ms) when a panel opens.

**Colours for status pills** (small rounded labels):

| Status | Colour |
|---|---|
| Pending / open | gold fill `--gold`, dark text `--dusk` |
| Approved / active / live | green `--status-open`, white text |
| Rejected / banned / removed | red `--danger`, white text |
| Hidden / closed / expired | grey `--status-closed`, white text |

Gold is never used as **text** on a light background — use `--gold-deep` for gold text.
Primary buttons = `app-button--gold`; dangerous actions (Reject, Ban, Hide, Remove) = a red outline
button `admin-button--danger` that always asks "Are you sure?" in a `<dialog>`.

**Layout (desktop first, ≥ 1024 px):**

```
┌────────────────────────────────────────────────────────────────────────┐
│ POINTER  Admin                                     [မြန်မာ] [Log out] │  ← app-top (copy owner.html)
├──────────────┬─────────────────────────────────────────────────────────┤
│ Dashboard    │  Dashboard                       (dark header, gold)    │
│ Applications │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│   (3)        │  │  3  │ │  2  │ │  5  │ │  1  │ │ 21  │ │ 46  │        │
│ Shops        │  │new  │ │pay- │ │open │ │ap-  │ │shops│ │users│        │
│ Public places│  │shops│ │ments│ │rep. │ │peals│ │ live│ │     │        │
│ Categories   │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘        │
│ Reports  (5) │                                                         │
│ Users        │  Latest admin actions (audit log, 8 rows)  [See all →]  │
│ Audit log    │                                                         │
└──────────────┴─────────────────────────────────────────────────────────┘
   sidebar 240 px, dark (--glass-solid), the open section in gold; red/gold count badges
```

- **List + detail** for Applications, Shops, Reports and Users: a table (or card list) on the left,
  the selected item's details in a panel on the right (≥ 1280 px) or below the list (smaller).
- Every list has a **search box** and **filter chips** (status, category group) above it, and an
  **empty state** ("No new applications 🎉") when nothing matches.
- **Tablet (768–1023 px):** the sidebar turns into a row of tabs under the header.
- **Phone:** not required, but nothing may overflow sideways (one column).

## 4. Screens (one sidebar section each)

### 4.1 Admin only
- Only `role: 'admin'` sees the page. Anyone else gets a card "Admins only" with a link to `home.html`;
  a visitor gets the login dialog (`askToLogin()` from `src/components/login-dialog.js`).
- Mock: add `loginDemoAdmin()` (signs in `{ id: 1000, name: 'Demo admin', role: 'admin' }`) and show a
  "Try as demo admin" button on the "Admins only" card **only when `USE_MOCK` is true**.

### 4.2 Dashboard (flowchart 4)
Count tiles: new shops waiting, payments waiting (renewals), open reports, open appeals, shops live,
users, banned users. Each tile is a link to its section. Below: the 8 latest audit-log rows.

### 4.3 Applications (flowchart 4a)
Tabs **New shops** / **Renewals**. A row: shop name, owner, category group, months (1/3/12), amount,
payment method, transaction ID, sent date. The detail panel shows:
- the shop: name, group, description, phone, opening hours, address;
- the **shop-front photo** and the **map pin** (the coordinates and an "Open in Google Maps" link made
  with `googleMapsUrl()` from `src/lib/format.js` are enough; a small map is a bonus);
- the **payment screenshot**, months, amount, method, transaction ID;
- a two-item checklist: ☐ "Shop is real: photo matches the pin" (new shops only) ☐ "Proof matches the
  amount and transaction ID".

Actions: **Approve** (both boxes ticked) → place `approved`, payment `approved`, `startsAt` = now (or the
old end date for a renewal), `expiresAt` = start + months. **Reject** (needs a reason) → a new shop:
place and payment `rejected` and the note "Refund outside the app"; a renewal: payment `rejected`,
"Owner asked to send the proof again".

### 4.4 Shops (flowchart 4b)
All places that have an owner: name, owner, group, status (live / expired / hidden / pending), rating,
subscription end. Detail: everything on the place page, and **Edit** (name, group, description, phone,
opening hours, map pin, photos — reuse the form pieces of `business.html`), **Hide** / **Show again**
(asks first; hiding notifies the owner).

### 4.5 Public places (flowchart 4b, "Add public place")
Places **without an owner** (pagodas, parks, landmarks, hospitals): list + **Add public place** form —
the `business.html` fields without the payment part; saved with `ownerId: null`, status approved.

### 4.6 Categories (flowchart 4b)
The 7 groups: English name, Burmese name, group key, colour dot (from the tokens). Admin can edit the
two names. Groups can't be added or removed (each has a colour and an icon in the app).

### 4.7 Reports & appeals (flowchart 4c)
Tabs **Reports** / **Appeals**.
- Report row: what was reported (post, review, message, user or shop), the reason, who reported, when.
  Detail shows the reported content itself. Actions: **Remove content**, **Warn user**, **Ban user**,
  **Keep (dismiss)** — each closes the report and notifies the reporter.
- Appeal row: the banned user, their reason, when they were banned and why. Actions: **Accept** → user
  `active` again and their shop shown again; **Reject** → stays banned. Both close the appeal.

### 4.8 Users (flowchart 4d) and Audit log
- Users: name, email, role, status (active / banned), joined date, their shop. **Ban** / **Unban** (asks
  first). Banning a shop owner also hides the shop and turns off their messages. An admin can't ban
  themself or another admin. (The database calls the status `banned`.)
- Audit log: every admin change as a row — who, what (`approve_shop`, `reject_payment`, `hide_place`,
  `ban_user`, `close_report`, …), the target (type + name), when. Filter chips by action; newest first.

## 5. Data functions (`src/api/admin.js`)

Name the functions like this; the comment above each one says the PHP endpoint (backend builds them later).

| Function | Endpoint (later) | Returns / does |
|---|---|---|
| `loginDemoAdmin()` | mock only | admin session |
| `getAdminDashboard()` | `GET /api/admin/dashboard.php` | counts + 8 latest audit rows |
| `getApplications({ kind })` | `GET /api/admin/applications.php?kind=new\|renewal` | list with place + payment |
| `approveApplication(id)` / `rejectApplication(id, reason)` | `POST /api/admin/applications.php` | updated application |
| `getAdminPlaces({ owned, q, status })` | `GET /api/admin/places.php` | places with owner and subscription |
| `updatePlace(id, fields)` / `setPlaceHidden(id, hidden)` | `PUT` / `POST /api/admin/places.php` | updated place |
| `createPublicPlace(fields)` | `POST /api/admin/places.php` | new place, `ownerId: null` |
| `updateCategory(id, { nameEn, nameMy })` | `PUT /api/admin/categories.php` | updated category |
| `getReports({ kind })` | `GET /api/admin/reports.php?kind=report\|appeal` | open reports or appeals |
| `resolveReport(id, { action, note })` | `POST /api/admin/reports.php` | closed report |
| `getUsers({ q, status })` / `setUserBanned(id, banned)` | `GET` / `POST /api/admin/users.php` | users / updated user |
| `getAuditLog({ action })` | `GET /api/admin/audit-log.php` | rows, newest first |

Fake data in `src/data/admin.js`: about 4 new-shop applications and 2 renewals (use the places and owners
already in `src/data/places.js` / `src/data/community.js`), 6 reports of different kinds, 2 appeals,
~12 users (2 banned, 1 other admin) and ~10 audit rows. Shop photos and payment screenshots in the
fake data are `null`: show a grey "No photo" box with the same size, so the layout is ready for real
uploads (no downloaded or generated pictures).

## 6. Order of work (tick as you go)

- [ ] 1. Files from section 2 + `vite.config.js` line; empty page loads at `/admin.html`
- [ ] 2. Admin-only check, demo admin login, header, sidebar (desktop + tablet tabs)
- [ ] 3. `src/data/admin.js` + `src/api/admin.js` (mock branch first, endpoint comments)
- [ ] 4. Dashboard
- [ ] 5. Applications (both tabs, detail, approve / reject with checks)
- [ ] 6. Shops + Public places
- [ ] 7. Categories
- [ ] 8. Reports & appeals
- [ ] 9. Users + Audit log (and every change writes an audit row)
- [ ] 10. Burmese texts in `my.json` for every key; switch the language and check nothing is cut off
- [ ] 11. Check at 1440, 1024 and 768 px wide; keyboard only (Tab / Enter / Esc) works everywhere
- [ ] 12. `npm run build` has no errors (run it in a terminal in the folder); then send the zip (section 8)

## 7. Done when

- [ ] An admin can do every step of flowcharts 4, 4a, 4b, 4c and 4d on mock data, and the changes stay
      after a reload.
- [ ] A normal user or a visitor can't use the page.
- [ ] Every text exists in English and Burmese; no hard-coded text in JS.
- [ ] Only the files in section 2 were added or changed.
- [ ] No `fetch` outside `src/api/`, no `innerHTML` with data, only token colours.
- [ ] It looks like Owner mode (dark header, gold numbers, white cards) and works at 768–1440 px.

## 8. What to send back

Make **one zip** (`admin-frontend-<date>.zip`) that keeps the folders, with only these files:

```
admin.html
vite.config.js
src/pages/admin.js
src/styles/pages/admin.css
src/api/admin.js
src/api/api.js
src/data/admin.js
src/i18n/en.json
src/i18n/my.json
```

Don't zip `node_modules/` or `dist/`. If you had to change any other file, list it in your message and
say why. Send it on the team Telegram with 2–3 screenshots (desktop and tablet width) and a short list of
what works and what doesn't yet. You can send a zip after each finished section, so problems are found early.

💬 Questions → ask Win Thant Aung on Telegram.
