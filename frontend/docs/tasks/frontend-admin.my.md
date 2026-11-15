# Frontend အလုပ် — Admin dashboard (`admin.html`, phase 3)

**တာဝန်ယူသူ:** Eain Si Htun · **စစ်ပေးမယ့်သူ:** Win Thant Aung (frontend lead)
**Code ယူပုံ / ပို့ပုံ:** Win Thant Aung ဆီက zip ယူ → အဲဒီထဲမှာ ရေး → ကိုယ်ရေးထားတဲ့ file တွေကို zip နဲ့
ပြန်ပို့ (အပိုင်း ၈)။ GitHub account မလိုပါ။
**Flowchart:** `docs/flows/4-admin-menu.png`, `4a-applications.png`, `4b-shops-categories.png`,
`4c-reports-appeals.png`, `4d-users-log.png` — အောက်က စာမျက်နှာတွေက ဒီ flowchart တွေအတိုင်း တစ်ခုချင်း လိုက်ထားတာပါ။

Admin စာမျက်နှာတွေကို **fake data (mock)** နဲ့ပဲ ဆောက်ရမှာပါ — ကျန်တဲ့ frontend တွေလိုပဲ။ PHP / SQL မရေးရပါ၊
backend team က နောက်မှ ချိတ်ပါမယ်။ ပြီးသွားရင် admin က ဆိုင်အသစ်နဲ့ ငွေပေးချေမှုတွေ စစ်တာ၊ ဆိုင်တွေ၊
public နေရာတွေ၊ category တွေ စီမံတာ၊ report နဲ့ appeal ကိုင်တာ၊ user ကို ban / unban လုပ်တာ၊ audit log
ကြည့်တာ အကုန်လုပ်လို့ရရမယ်။

---

## ၁. မစခင် (နာရီဝက် – တစ်ရက်ဝက်)

1. Win Thant Aung ပေးတဲ့ `POINTER-frontend.zip` ကို **path ထဲမှာ space နဲ့ မြန်မာစာ မပါတဲ့** folder ထဲမှာ
   ဖြည်ပါ (ဥပမာ `D:\pointer-admin\`)။ **Node.js 22.12 နဲ့ အထက်** (nodejs.org က LTS) မရှိသေးရင် install လုပ်ပါ။
2. Run ပါ: Windows → `start-windows.bat` ကို double-click (Mac / Linux → folder ထဲမှာ `npm start`)။
   ပထမဆုံးအကြိမ်မှာ package တွေ install လုပ်လို့ မိနစ်အနည်းငယ် ကြာမယ် (internet လိုတယ်)။ ပြီးရင် ပေါ်လာတဲ့
   လိပ်စာ (http://localhost:5173) ကို ဖွင့်ပါ။ အလုပ်လုပ်နေသရွေ့ အဲဒီ window ကို ဖွင့်ထားပါ —
   file save လုပ်တိုင်း page က အလိုလို reload ဖြစ်မယ်။
3. ဒီစာမျက်နှာတွေကို နှိပ်ကြည့်ပြီး ပုံစံနဲ့ code ရေးပုံကို လေ့လာပါ (သင် အဲဒီအတိုင်း လိုက်ရေးရမှာ):
   - `owner.html` (Log in → "Try as a demo shop owner") — အမည်းရောင် header ပေါ်က ရွှေရောင် ဂဏန်းတွေ၊ အဖြူကတ်တွေ၊ form တွေ။
   - `account.html`, `deals.html`, `messages.html` — list, chip, dialog, ဗလာဖြစ်နေတဲ့အခါ ပြပုံ။
4. ဒီအစဉ်အတိုင်း ဖတ်ပါ:
   - အပေါ်က admin flowchart ၅ ခု၊
   - `HANDOFF.md` ထဲက **Database** (table ၁၅ ခု) နဲ့ **Roles**၊
   - `src/pages/owner.js` + `src/api/owner.js` + `src/styles/pages/owner.css` — သင့် file တွေ ဒီလိုပုံစံ ဖြစ်ရမယ်။

## ၂. Code ရေးနည်း (အတိအကျ လိုက်နာပေးပါ)

**Stack:** Vite + ရိုးရိုး HTML, CSS, JavaScript (ES modules)။ React / Vue / jQuery / Bootstrap / Tailwind
**မသုံးရ**၊ npm package အသစ် မထည့်ရ (လိုမယ်ထင်ရင် အရင်မေးပါ)။

**သင် အသစ်ဆောက်ရမဲ့ file တွေ** (တခြား page တွေကို မပြင်ပါနဲ့):

| File | အထဲမှာ ဘာထည့်ရမလဲ |
|---|---|
| `admin.html` | Page ပုံကြမ်း: `owner.html` ရဲ့ `<head>` (font, icon) ကို ကူး၊ `<body class="page-app page-admin">` |
| `src/pages/admin.js` | Page script: import, အပိုင်းတစ်ခုချင်း render လုပ်တဲ့ function, button နှိပ်ရင် လုပ်မဲ့ handler |
| `src/styles/pages/admin.css` | Admin page အတွက်ပဲ style၊ class နာမည်တွေ `admin-` နဲ့ စရမယ် |
| `src/api/admin.js` | Admin data function အားလုံး (အခု mock၊ နောက်မှ PHP) — အပိုင်း ၅ ကြည့် |
| `src/data/admin.js` | Fake data: application, report, appeal, user, audit log |

**ဝေမျှသုံးတဲ့ file တွေမှာ တစ်ကြောင်းစီ ပြင်ခွင့်ရှိတာ:**

- `vite.config.js` → `pages` ထဲမှာ `admin: 'admin.html',` ထည့်။
- `src/api/api.js` → အဆုံးမှာ `export * from './admin.js';` ထည့် (page တွေက `api.js` ကနေပဲ import လုပ်တယ်)။
- `src/i18n/en.json` နဲ့ `src/i18n/my.json` → `"admin": { … }` block အသစ် (file ၂ ခုလုံးမှာ key တူတူ)။

**စည်းကမ်းများ:**

1. **Data ကို `src/api/` ကနေပဲ ယူရမယ်။** Page code ထဲမှာ `fetch` မခေါ်ရ၊ `src/data/` ကို တိုက်ရိုက် import မလုပ်ရ။
   API function တစ်ခုစီမှာ `USE_MOCK` အပိုင်း (browser ထဲက demo store ကနေ fake data) နဲ့ တကယ့်အပိုင်း
   (`request('admin/....php', …)`) ပါရမယ် — `src/api/owner.js` ပုံစံအတိုင်း ကူးပါ။ Function တိုင်းရဲ့ အပေါ်မှာ
   PHP endpoint, ဘာပို့လဲ, ဘာပြန်ရလဲ ကို comment ရေးပါ။
2. **Mock data ကို ပြင်ရင်** `readDemo` / `writeDemo` (`src/api/demo-store.js`) နဲ့ သိမ်းပါ — ဒါမှ page reload လုပ်ရင်
   မပျောက်မယ်။ ပြင်တိုင်း audit log မှာ တစ်ကြောင်း ထည့်ရမယ် (အပိုင်း ၄.၈)။
3. **HTML ဆောက်ရင်** `src/lib/dom.js` ထဲက `el()` ကို သုံးပါ၊ data ကလာတဲ့ စာမှန်သမျှကို `textContent` နဲ့ ထည့်ပါ —
   user ရေးတဲ့စာကို `innerHTML` ထဲ ဘယ်တော့မှ မထည့်ရ။
4. **စာသား:** JS ထဲမှာ English စာ တိုက်ရိုက် မရေးရ။ စာတိုင်း `t('admin.…')` (သို့) `data-i18n="admin.…"` ကို သုံးပြီး
   English **ရော** မြန်မာ **ရော** `en.json` / `my.json` မှာ ထည့်ရမယ်။ ရက်စွဲ: `src/lib/format.js` ထဲက `dateInYangon()` /
   `timeInYangon()`၊ ဂဏန်း: `number()`။
5. **Style:** `src/styles/tokens.css` ထဲက variable တွေ (အရောင်, font, spacing, radius, shadow) ကိုပဲ သုံးပါ။
   Hex အရောင်အသစ် မထည့်ရ၊ `style=""` inline မရေးရ။ Class အသစ် မရေးခင် `src/styles/pages/app.css` ထဲက `app-*`
   class တွေ (`app-hero`, `app-main`, `app-button`, `app-button--gold`, `app-chip`, `app-muted`) ကို အရင်ပြန်သုံးပါ။
6. **Comment:** file တိုင်းရဲ့ ထိပ်မှာ ဘာအတွက်လဲ ၁–၃ ကြောင်း ရေးပါ။ Function တွေကို တိုတို ရှင်းရှင်း
   English နာမည် ပေးပါ (`renderApplications`, `approveApplication`)။
7. **Accessibility:** `<button>` နဲ့ `<label>` အစစ် သုံးပါ၊ focus မြင်ရအောင် (`:focus-visible` ရွှေရောင် outline)၊
   အတည်ပြုခိုင်းတဲ့ dialog ကို `<dialog>` နဲ့၊ ရလဒ် message ကို `src/lib/dom.js` ထဲက `toast()` နဲ့ ပြပါ၊
   `prefers-reduced-motion` ကို လေးစားပါ (animation ပိတ်ထားတဲ့သူအတွက် မလှုပ်ရ)။
8. **ဓာတ်ပုံ:** ဆိုင်ပုံနဲ့ ငွေလွှဲ screenshot တွေကို upload လုပ်ထားတဲ့အတိုင်းပဲ ပြရမယ် (ဓာတ်ပုံအစစ်ပဲ၊ ဆွဲထားတဲ့ပုံ / generate လုပ်ထားတဲ့ပုံ မသုံးရ)။

## ၃. Design

**ပုံစံ:** Owner mode နဲ့ မိသားစုတူ — **အမည်းရောင် (dusk) header** ပေါ်မှာ ရွှေရောင်ဂဏန်းတွေ၊ အောက်မှာ အလင်းရောင်
page (`--land`) နဲ့ **အဖြူကတ်တွေ** (`--surface`, `--radius-lg`, `--shadow-card`)။ ခေါင်းစဉ် Fraunces
(`--font-display`)၊ ကျန်တာ Onest (`--font-ui`)။ ဒါက အလုပ်လုပ်တဲ့ tool မို့ ငြိမ်ငြိမ် ရှင်းရှင်း — animation ကြီးတွေ
မထည့်ပါနဲ့၊ panel ပွင့်တဲ့အခါ fade (150–200 ms) လောက်ပဲ။

**Status pill အရောင်** (စာတန်းလေး အဝိုင်း):

| Status | အရောင် |
|---|---|
| Pending / open (စောင့်ဆဲ / ဖွင့်ဆဲ) | ရွှေ `--gold` နောက်ခံ၊ အမည်းစာ `--dusk` |
| Approved / active / live (အတည်ပြုပြီး / အသုံးပြုဆဲ) | အစိမ်း `--status-open`၊ အဖြူစာ |
| Rejected / banned / removed (ပယ်ချ / ban / ဖျက်) | အနီ `--danger`၊ အဖြူစာ |
| Hidden / closed / expired (ဖျောက် / ပိတ် / သက်တမ်းကုန်) | မီးခိုး `--status-closed`၊ အဖြူစာ |

အလင်းနောက်ခံပေါ်မှာ ရွှေရောင်ကို **စာ** အဖြစ် မသုံးရ — ရွှေရောင်စာဆိုရင် `--gold-deep` ကိုသုံးပါ။
အဓိက button = `app-button--gold`၊ အန္တရာယ်ရှိတဲ့ action (Reject, Ban, Hide, Remove) = အနီ outline button
`admin-button--danger` — အမြဲ `<dialog>` နဲ့ "သေချာလား?" မေးရမယ်။

**Layout (desktop ကို ဦးစားပေး, ≥ 1024 px):**

```
┌────────────────────────────────────────────────────────────────────────┐
│ POINTER  Admin                                     [မြန်မာ] [Log out] │  ← app-top (owner.html ကကူး)
├──────────────┬─────────────────────────────────────────────────────────┤
│ Dashboard    │  Dashboard                       (အမည်း header, ရွှေ)   │
│ Applications │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│   (3)        │  │  3  │ │  2  │ │  5  │ │  1  │ │ 21  │ │ 46  │        │
│ Shops        │  │ဆိုင်│ │ငွေ  │ │report│ │appeal│ │ဆိုင်│ │user │        │
│ Public places│  │အသစ်│ │ပေး  │ │ဖွင့်│ │     │ │live │ │     │        │
│ Categories   │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘        │
│ Reports  (5) │                                                         │
│ Users        │  နောက်ဆုံး admin လုပ်ဆောင်ချက်များ (audit log ၈ ကြောင်း) [အကုန်ကြည့် →] │
│ Audit log    │                                                         │
└──────────────┴─────────────────────────────────────────────────────────┘
   ဘေး sidebar 240 px, အမည်း (--glass-solid), ဖွင့်ထားတဲ့အပိုင်း ရွှေရောင်; အနီ/ရွှေ အရေအတွက် badge
```

- Applications, Shops, Reports, Users တွေမှာ **စာရင်း + အသေးစိတ်** ပုံစံ: ဘယ်ဘက်မှာ table (သို့) card list၊ ရွေးထားတဲ့
  item ရဲ့ အသေးစိတ်ကို ညာဘက် panel မှာ (≥ 1280 px) (သို့) list အောက်မှာ (screen သေးရင်) ပြပါ။
- စာရင်းတိုင်းရဲ့ အပေါ်မှာ **ရှာဖွေ box** နဲ့ **filter chip** (status, category group) ထားပါ၊ ဘာမှ မတွေ့ရင်
  **ဗလာ message** ("ဆိုင်အသစ် မရှိသေးပါ 🎉") ပြပါ။
- **Tablet (768–1023 px):** sidebar ကို header အောက်မှာ tab တန်းအဖြစ် ပြောင်းပါ။
- **ဖုန်း:** မလိုအပ်ပေမဲ့ ဘေးဘက်ကို ကျော်ထွက်တာ မရှိရ (column တစ်ခုတည်း)။

## ၄. စာမျက်နှာများ (sidebar အပိုင်း တစ်ခုစီ)

### ၄.၁ Admin သာ ဝင်ခွင့်ရှိ
- `role: 'admin'` ပဲ ဒီ page ကို မြင်ရမယ်။ တခြားသူဆိုရင် "Admins only" ကတ်နဲ့ `home.html` link ပြပါ၊ login မဝင်ထားသူ
  (visitor) ဆိုရင် login dialog ပြပါ (`src/components/login-dialog.js` ထဲက `askToLogin()`)။
- Mock: `loginDemoAdmin()` ထည့်ပါ (`{ id: 1000, name: 'Demo admin', role: 'admin' }` နဲ့ login ဝင်ပေးတာ)၊
  "Admins only" ကတ်ပေါ်မှာ "Try as demo admin" button ကို **`USE_MOCK` true ဖြစ်မှသာ** ပြပါ။

### ၄.၂ Dashboard (flowchart 4)
အရေအတွက် ကတ်တွေ: စောင့်နေတဲ့ ဆိုင်အသစ်၊ စောင့်နေတဲ့ ငွေပေးချေမှု (သက်တမ်းတိုး)၊ ဖွင့်ထားဆဲ report၊ ဖွင့်ထားဆဲ appeal၊
live ဖြစ်နေတဲ့ ဆိုင်၊ user စုစုပေါင်း၊ ban ထားတဲ့ user။ ကတ်တစ်ခုချင်းက သူ့အပိုင်းကို link။ အောက်မှာ audit log
နောက်ဆုံး ၈ ကြောင်း။

### ၄.၃ Applications — လျှောက်လွှာများ (flowchart 4a)
**ဆိုင်အသစ်** / **သက်တမ်းတိုး** tab ၂ ခု။ တစ်ကြောင်းစီမှာ: ဆိုင်နာမည်, ပိုင်ရှင်, category group, လ (1/3/12),
ငွေပမာဏ, ငွေပေးနည်း, transaction ID, ပို့တဲ့ရက်။ အသေးစိတ် panel မှာ:
- ဆိုင်: နာမည်, group, ဖော်ပြချက်, ဖုန်း, ဖွင့်ချိန်, လိပ်စာ၊
- **ဆိုင်ရှေ့ ဓာတ်ပုံ** နဲ့ **map pin** (coordinate နဲ့ `src/lib/format.js` ထဲက `googleMapsUrl()` နဲ့ လုပ်တဲ့
  "Open in Google Maps" link လောက်ဆို လုံလောက်တယ်၊ map အသေးလေးပါရင် ပိုကောင်း)၊
- **ငွေလွှဲ screenshot**, လ, ပမာဏ, ငွေပေးနည်း, transaction ID၊
- စစ်ဆေးရန် checkbox ၂ ခု: ☐ "ဆိုင်က တကယ်ရှိတယ်: ဓာတ်ပုံနဲ့ pin ကိုက်တယ်" (ဆိုင်အသစ်မှသာ) ☐ "Screenshot က
  ပမာဏနဲ့ transaction ID နဲ့ ကိုက်တယ်"။

လုပ်ဆောင်ချက်: **Approve** (box ၂ ခုလုံး ခြစ်ပြီးမှ) → place `approved`, payment `approved`, `startsAt` = အခု
(သက်တမ်းတိုးဆိုရင် အဟောင်းကုန်တဲ့ရက်), `expiresAt` = စတဲ့ရက် + လ။ **Reject** (အကြောင်းပြချက် ရေးရမယ်) → ဆိုင်အသစ်:
place နဲ့ payment `rejected` + "App အပြင်မှာ ငွေပြန်အမ်းရန်" မှတ်ချက်၊ သက်တမ်းတိုး: payment `rejected` +
"Screenshot ပြန်ပို့ခိုင်းပြီ"။

### ၄.၄ Shops — ဆိုင်များ (flowchart 4b)
ပိုင်ရှင်ရှိတဲ့ နေရာ အားလုံး: နာမည်, ပိုင်ရှင်, group, status (live / expired / hidden / pending), rating,
သက်တမ်းကုန်ရက်။ အသေးစိတ်မှာ place page က အချက်အကုန်ပြပြီး **Edit** (နာမည်, group, ဖော်ပြချက်, ဖုန်း, ဖွင့်ချိန်,
map pin, ဓာတ်ပုံ — `business.html` ရဲ့ form အပိုင်းတွေကို ပြန်သုံး), **Hide** / **Show again** (အရင်မေးရမယ်၊
ဖျောက်ရင် ပိုင်ရှင်ကို အသိပေးတယ်)။

### ၄.၅ Public places — ပိုင်ရှင်မရှိတဲ့ နေရာများ (flowchart 4b "Add public place")
ဘုရား, ပန်းခြံ, အထင်ကရနေရာ, ဆေးရုံ လို **ပိုင်ရှင်မရှိတဲ့** နေရာတွေ: စာရင်း + **Add public place** form —
`business.html` ရဲ့ field တွေ (ငွေပေးချေမှု အပိုင်း မပါ)၊ `ownerId: null`, status approved နဲ့ သိမ်းပါ။

### ၄.၆ Categories (flowchart 4b)
Group ၇ ခု: English နာမည်, မြန်မာ နာမည်, group key, အရောင်အစက် (tokens ကနေ)။ Admin က နာမည် ၂ ခုကိုပဲ ပြင်လို့ရတယ်။
Group အသစ် ထည့်တာ / ဖျက်တာ မရဘူး (group တစ်ခုစီမှာ app ထဲမှာ အရောင်နဲ့ icon ရှိလို့)။

### ၄.၇ Reports & appeals (flowchart 4c)
**Reports** / **Appeals** tab ၂ ခု။
- Report တစ်ကြောင်း: ဘာကို report လုပ်တာလဲ (post, review, message, user, shop), အကြောင်းပြချက်, report လုပ်သူ, ရက်။
  အသေးစိတ်မှာ report ခံရတဲ့ အကြောင်းအရာကိုယ်တိုင် ပြပါ။ လုပ်ဆောင်ချက်: **Remove content** (ဖျက်), **Warn user** (သတိပေး),
  **Ban user**, **Keep (dismiss)** (ထားလိုက်) — ဘာလုပ်လုပ် report ပိတ်ပြီး report လုပ်သူကို အသိပေးတယ်။
- Appeal တစ်ကြောင်း: ban ခံထားရတဲ့ user, သူ့အကြောင်းပြချက်, ဘယ်တုန်းက ဘာကြောင့် ban ခံရလဲ။ လုပ်ဆောင်ချက်: **Accept** →
  user ပြန် `active`, သူ့ဆိုင် ပြန်ပေါ်; **Reject** → ban ဆက်ထား။ နှစ်ခုလုံး appeal ကို ပိတ်တယ်။

### ၄.၈ Users နဲ့ Audit log (flowchart 4d)
- Users: နာမည်, email, role, status (active / banned), စာရင်းသွင်းတဲ့ရက်, သူ့ဆိုင်။ **Ban** / **Unban** (အရင်မေး)။
  ဆိုင်ပိုင်ရှင်ကို ban ရင် သူ့ဆိုင်ကိုပါ ဖျောက်ပြီး message ပိတ်တယ်။ Admin က ကိုယ့်ကိုယ်ကိုယ် (သို့) တခြား admin ကို ban မရ။
  (Database မှာ status ကို `banned` လို့ ခေါ်တယ်။)
- Audit log: admin ပြင်တိုင်း တစ်ကြောင်း — ဘယ်သူ, ဘာလုပ် (`approve_shop`, `reject_payment`, `hide_place`, `ban_user`,
  `close_report`, …), ဘာကို (type + နာမည်), ဘယ်တုန်း။ Action အလိုက် filter chip၊ အသစ်ဆုံး အပေါ်။

## ၅. Data function များ (`src/api/admin.js`)

Function နာမည်တွေကို ဒီအတိုင်း ပေးပါ၊ အပေါ်က comment မှာ PHP endpoint ရေးပါ (backend က နောက်မှ ဆောက်မယ်)။

| Function | Endpoint (နောက်မှ) | ပြန်ပေးတာ / လုပ်တာ |
|---|---|---|
| `loginDemoAdmin()` | mock သာ | admin session |
| `getAdminDashboard()` | `GET /api/admin/dashboard.php` | အရေအတွက်များ + audit နောက်ဆုံး ၈ ကြောင်း |
| `getApplications({ kind })` | `GET /api/admin/applications.php?kind=new\|renewal` | place + payment ပါ စာရင်း |
| `approveApplication(id)` / `rejectApplication(id, reason)` | `POST /api/admin/applications.php` | ပြင်ပြီး application |
| `getAdminPlaces({ owned, q, status })` | `GET /api/admin/places.php` | ပိုင်ရှင်နဲ့ သက်တမ်းပါ place များ |
| `updatePlace(id, fields)` / `setPlaceHidden(id, hidden)` | `PUT` / `POST /api/admin/places.php` | ပြင်ပြီး place |
| `createPublicPlace(fields)` | `POST /api/admin/places.php` | place အသစ်, `ownerId: null` |
| `updateCategory(id, { nameEn, nameMy })` | `PUT /api/admin/categories.php` | ပြင်ပြီး category |
| `getReports({ kind })` | `GET /api/admin/reports.php?kind=report\|appeal` | ဖွင့်ဆဲ report / appeal |
| `resolveReport(id, { action, note })` | `POST /api/admin/reports.php` | ပိတ်ပြီး report |
| `getUsers({ q, status })` / `setUserBanned(id, banned)` | `GET` / `POST /api/admin/users.php` | user များ / ပြင်ပြီး user |
| `getAuditLog({ action })` | `GET /api/admin/audit-log.php` | အသစ်ဆုံးအပေါ် |

`src/data/admin.js` ထဲက fake data: ဆိုင်အသစ် application ၄ ခုလောက်နဲ့ သက်တမ်းတိုး ၂ ခု (`src/data/places.js` /
`src/data/community.js` ထဲက ရှိပြီးသား ဆိုင်တွေ၊ ပိုင်ရှင်တွေကို သုံး), အမျိုးအစားစုံ report ၆ ခု, appeal ၂ ခု, user ~၁၂
ယောက် (ban ထားတာ ၂, တခြား admin ၁), audit ~၁၀ ကြောင်း။ Fake data ထဲက ဆိုင်ပုံနဲ့ screenshot တွေကို `null` ထားပါ:
အရွယ်တူ မီးခိုးရောင် "No photo" box ပြပါ — ဒါဆို တကယ့် upload ပုံတွေအတွက် layout အဆင်သင့်ဖြစ်မယ် (download ထားတဲ့ပုံ,
generate လုပ်ထားတဲ့ပုံ မသုံးရ)။

## ၆. အလုပ်လုပ်ရမဲ့ အစဉ် (ပြီးတိုင်း ခြစ်ပါ)

- [ ] 1. အပိုင်း ၂ က file တွေ + `vite.config.js` တစ်ကြောင်း; `/admin.html` ဗလာ page ပွင့်ရမယ်
- [ ] 2. Admin သာ ဝင်ခွင့်စစ်တာ, demo admin login, header, sidebar (desktop + tablet tab)
- [ ] 3. `src/data/admin.js` + `src/api/admin.js` (mock အပိုင်းအရင်, endpoint comment ပါ)
- [ ] 4. Dashboard
- [ ] 5. Applications (tab ၂ ခု, အသေးစိတ်, စစ်ပြီးမှ approve / reject)
- [ ] 6. Shops + Public places
- [ ] 7. Categories
- [ ] 8. Reports & appeals
- [ ] 9. Users + Audit log (ပြင်တိုင်း audit တစ်ကြောင်း ရေးရမယ်)
- [ ] 10. Key တိုင်းအတွက် `my.json` မှာ မြန်မာစာ ထည့်; ဘာသာ ပြောင်းကြည့်ပြီး စာ ပြတ်မနေတာ စစ်
- [ ] 11. အကျယ် 1440, 1024, 768 px မှာ စစ်; keyboard နဲ့ချည်း (Tab / Enter / Esc) အကုန်သုံးလို့ရရမယ်
- [ ] 12. Folder ထဲမှာ terminal ဖွင့်ပြီး `npm run build` ကို run — error မရှိရ; ပြီးရင် zip ပို့ (အပိုင်း ၈)

## ၇. ပြီးပြီလို့ ဘယ်တော့ ပြောလို့ရလဲ

- [ ] Admin က flowchart 4, 4a, 4b, 4c, 4d ရဲ့ အဆင့်တိုင်းကို mock data နဲ့ လုပ်လို့ရပြီး reload လုပ်လည်း ပြင်ထားတာ မပျောက်ဘူး။
- [ ] ရိုးရိုး user (သို့) visitor က ဒီ page ကို သုံးလို့ မရဘူး။
- [ ] စာတိုင်း English ရော မြန်မာ ရော ရှိတယ်; JS ထဲမှာ စာ တိုက်ရိုက် မရေးထားဘူး။
- [ ] အပိုင်း ၂ က file တွေကိုပဲ ထည့် / ပြင်ထားတယ်။
- [ ] `src/api/` အပြင်မှာ `fetch` မရှိ၊ data ကို `innerHTML` နဲ့ မထည့်၊ token အရောင်တွေပဲ သုံးထားတယ်။
- [ ] Owner mode နဲ့ ပုံစံတူတယ် (အမည်း header, ရွှေဂဏန်း, အဖြူကတ်) ပြီး 768–1440 px မှာ အလုပ်လုပ်တယ်။

## ၈. ပြန်ပို့ရမှာ

Folder ပုံစံ မပျက်အောင် **zip တစ်ခု** (`admin-frontend-<ရက်စွဲ>.zip`) လုပ်ပါ၊ ဒီ file တွေပဲ ပါရမယ်:

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

`node_modules/` နဲ့ `dist/` ကို zip ထဲ မထည့်ပါနဲ့။ တခြား file တစ်ခုခု ပြင်ခဲ့ရရင် message ထဲမှာ ဘာ file လဲ၊ ဘာကြောင့်လဲ
ရေးပါ။ Team Telegram မှာ zip နဲ့အတူ screenshot ၂–၃ ပုံ (desktop နဲ့ tablet အကျယ်) နဲ့ ဘာအလုပ်လုပ်ပြီ၊ ဘာမပြီးသေးဘူးဆိုတဲ့
စာရင်းတိုလေး ပို့ပါ။ အပိုင်းတစ်ခုပြီးတိုင်း zip ပို့လို့ရတယ် — ပြဿနာကို စောစော တွေ့ရအောင်ပါ။

💬 မေးစရာရှိရင် → Win Thant Aung ကို Telegram မှာ မေးပါ။
