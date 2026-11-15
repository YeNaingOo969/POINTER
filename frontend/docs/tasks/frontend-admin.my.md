# Admin page

ဒါက admin page အတွက် ကျနော် ရေးထားတာပါ။ ကျနော်တို့ frontend ထဲက တခြား page တွေလိုပဲ fake data နဲ့ ဆွဲရမှာမို့ PHP တို့ database တို့ မလိုပါဘူး။ Backend ကောင်တွေက နောက်မှ ချိတ်ပေးလိမ့်မယ်။

Admin က လုပ်ရမဲ့ အလုပ်တွေကို Ye Naing Oo ဆွဲထားတဲ့ flowchart page 4 မှာ ကြည့်လို့ရတယ်။ zip ထဲက docs/flows/ folder မှာ 4-admin-menu.png, 4a, 4b, 4c, 4d ပုံတွေ ပါတယ်။


## ဖွင့်ကြည့်ဖို့

1. zip ကို ဖြည်လိုက်ပါ။ Folder path ထဲမှာ space တို့ မြန်မာစာ တို့ မပါရင် ပိုအဆင်ပြေတယ် (ဥပမာ D:\pointer-admin)။
2. Node.js မရှိသေးရင် nodejs.org က LTS version ကို install လုပ်ပါ။
3. start-windows.bat ကို double click နှိပ်ပါ။ ပထမဆုံးအကြိမ်မှာ package တွေ ဆွဲလို့ နည်းနည်းကြာမယ်၊ internet လိုတယ်။ ပြီးရင် browser မှာ http://localhost:5173 ပွင့်လာမယ်။
4. အလုပ်လုပ်နေတုန်း အဲဒီ window လေးကို မပိတ်ထားပါနဲ့။ file save လိုက်တိုင်း page က သူ့ဘာသာ refresh ဖြစ်တယ်။

ပြီးရင် owner.html ကို တစ်ချက်ဝင်ကြည့်ပါ (Log in နှိပ်ပြီး "Try as a demo shop owner" ကို ရွေး)။ Admin page ကိုလည်း အဲဒီလိုမျိုး ဆင်ဆင်ပဲ လုပ်ချင်တယ်။ အပေါ်က အမည်းရောင် header မှာ ရွှေရောင်ဂဏန်းတွေ၊ အောက်မှာ အဖြူကတ်တွေ။


## ဆောက်ရမဲ့ file တွေ

- admin.html
- src/pages/admin.js
- src/styles/pages/admin.css
- src/api/admin.js
- src/data/admin.js

owner.html, src/pages/owner.js, src/api/owner.js, src/styles/pages/owner.css တွေက ပုံစံတူတူပဲမို့ အဲဒါတွေကို ကြည့်ပြီး ကူးရေးရင် အမြန်ဆုံးပဲ။

ဒီ file ၃ ခုမှာတော့ တစ်ကြောင်းစီလောက် ထည့်ပေးရမယ်:
- vite.config.js ထဲက pages မှာ admin: 'admin.html',
- src/api/api.js အောက်ဆုံးမှာ export * from './admin.js';
- src/i18n/en.json နဲ့ my.json မှာ "admin" ဆိုတဲ့ အပိုင်းအသစ် (page ပေါ်က စာတွေ English ရော မြန်မာ ရော)


## ကျနော်တို့ ရေးနေကျ ပုံစံ

ဒါလေးတွေ ညီအောင်လို့ပါ။
- Framework (React, Bootstrap စတာ) မသုံးဘဲ ရိုးရိုး HTML, CSS, JS နဲ့ပဲ ရေးထားတယ်။
- Data ကို page ထဲမှာ တိုက်ရိုက် မထည့်ဘဲ src/api/admin.js ထဲက function တွေကနေ ယူတယ်။ owner.js ထဲမှာ USE_MOCK နဲ့ ခွဲရေးထားတာကို ကြည့်ပါ။ Function တစ်ခုစီရဲ့ အပေါ်မှာ နောက်ပိုင်း ချိတ်မဲ့ PHP file နာမည်လေး comment ရေးထားပေးရင် backend ကောင်တွေ အလွယ်ရမယ်။
- ပြင်လိုက်တဲ့ data တွေ reload လုပ်ရင် မပျောက်အောင် readDemo / writeDemo (src/api/demo-store.js) နဲ့ သိမ်းတယ်။
- Page ပေါ်က စာတွေကို JS ထဲ တိုက်ရိုက် မရေးဘဲ en.json / my.json ကနေ t('admin.xxx') နဲ့ ခေါ်တယ်။ ဒါမှ မြန်မာ / English ခလုတ်နဲ့ ပြောင်းလို့ရမှာ။
- အရောင်တွေ၊ font တွေကို src/styles/tokens.css ထဲက ဟာတွေပဲ သုံးတယ်။ Button တွေ chip တွေကို app.css ထဲမှာ ရှိပြီးသား app-button, app-chip စတာတွေ ပြန်သုံးလို့ရတယ်။
- ဆိုင်ပုံ၊ ငွေလွှဲ screenshot တွေက fake data မှာ မရှိသေးလို့ "No photo" ဆိုတဲ့ မီးခိုးရောင်အကွက်လေးပဲ ထားထားလိုက်ပါ။


## Page ပုံစံ

ဘယ်ဘက်မှာ menu (sidebar)၊ ညာဘက်မှာ ရွေးထားတဲ့ အပိုင်း။ Laptop screen အတွက် အဓိကထားပြီး tablet မှာ menu က အပေါ်မှာ tab တန်းလေး ဖြစ်သွားရင် ရပြီ။ ဖုန်းအတွက်တော့ သိပ်မလိုပါဘူး။

```
POINTER  Admin                                  [မြန်မာ] [Log out]
----------------------------------------------------------------------
Dashboard     |  Dashboard
Applications  |   [3 ဆိုင်အသစ်] [2 ငွေပေးချေမှု] [5 report] [21 ဆိုင်] [46 user]
Shops         |
Public places |   နောက်ဆုံး admin လုပ်ခဲ့တာတွေ (audit log)
Categories    |
Reports       |
Users         |
Audit log     |
```

Status လေးတွေကို အရောင်နဲ့ ခွဲပြရင် ကြည့်ရလွယ်တယ်။ စောင့်နေတာ ရွှေရောင်၊ approve / active ဆို အစိမ်း၊ reject / ban ဆို အနီ၊ hide / ပိတ်ပြီး ဆို မီးခိုး။ Reject, Ban, Hide လို နှိပ်မိရင် ဒုက္ခရောက်တဲ့ ခလုတ်တွေမှာ "သေချာလား" လို့ တစ်ခါ မေးတာလေး ထည့်ပေးပါ။


## Menu တစ်ခုချင်းစီ

**Dashboard** - စောင့်နေတဲ့ ဆိုင်အသစ်၊ စောင့်နေတဲ့ ငွေပေးချေမှု၊ report၊ appeal၊ ဆိုင်စုစုပေါင်း၊ user စုစုပေါင်း ဂဏန်းတွေ။ နှိပ်ရင် သက်ဆိုင်ရာ menu ကို ရောက်သွားမယ်။

**Applications** (flowchart 4a) - ဆိုင်အသစ် လျှောက်ထားတာတွေနဲ့ သက်တမ်းတိုးတာတွေ။ တစ်ခု နှိပ်ရင် ဆိုင်အချက်အလက်၊ ဆိုင်ပုံ၊ map နေရာ (Google Maps link ပဲ ထားလို့ရတယ်)၊ ငွေလွှဲ screenshot၊ လ (1/3/12)၊ ငွေပမာဏ၊ transaction ID ပြမယ်။ Approve ဆို ဆိုင် live ဖြစ်ပြီး သက်တမ်းစမယ်။ Reject ဆို အကြောင်းပြချက် ရေးခိုင်းမယ်။ ဆိုင်အသစ်ကို reject လုပ်ရင် "ငွေ ပြန်အမ်းရန်" ဆိုတာလေး ပြပေးပါ။

**Shops** (4b) - ပိုင်ရှင်ရှိတဲ့ ဆိုင်အားလုံး။ အချက်အလက် ပြင်လို့ရမယ်၊ ဖျောက်ထားလို့ (hide) ရမယ်။

**Public places** (4b) - ဘုရား၊ ပန်းခြံ လို ပိုင်ရှင်မရှိတဲ့ နေရာတွေ။ Admin ကိုယ်တိုင် အသစ်ထည့်လို့ရမယ်။ business.html ထဲက form ကို ငွေပေးတဲ့အပိုင်း ဖြုတ်ပြီး ပြန်သုံးလို့ရတယ်။

**Categories** (4b) - category ၇ ခုရဲ့ English နဲ့ မြန်မာ နာမည် ပြင်လို့ရရုံပဲ။

**Reports** (4c) - Report နဲ့ Appeal tab ၂ ခု။ Report ဆို ဘာကို report လုပ်တာလဲ ပြပြီး ဖျက်မလား၊ သတိပေးမလား၊ ban မလား၊ ဒီအတိုင်း ထားမလား ရွေးမယ်။ Appeal ဆို ban ခံထားရတဲ့သူက ပြန်ဖွင့်ပေးဖို့ တောင်းတာ၊ လက်ခံရင် unban လုပ်ပြီး သူ့ဆိုင် ပြန်ပေါ်မယ်။

**Users** (4d) - user စာရင်း၊ ban / unban။ ဆိုင်ပိုင်ရှင်ကို ban ရင် သူ့ဆိုင်ပါ ဖျောက်မယ်။ Admin ချင်းတော့ ban လို့ မရအောင် ထားပါ။

**Audit log** (4d) - admin ဘာလုပ်ခဲ့လဲ မှတ်တမ်း။ Approve, reject, hide, ban စတာ လုပ်လိုက်တိုင်း တစ်ကြောင်း ထည့်ပေးရမယ်။

Admin မဟုတ်တဲ့သူ ဝင်လာရင် "Admin only" ဆိုတာလေး ပြပြီး home ကို ပြန်လွှတ်ပါ။ စမ်းလို့ရအောင် "Try as demo admin" ခလုတ်လေး ထည့်ထားပေးပါ (fake data သုံးနေတုန်းပဲ ပေါ်မယ်)။


## src/api/admin.js ထဲက function နာမည်တွေ

ဒီနာမည်တွေ အတိုင်းဆို backend ဘက်နဲ့ ချိတ်ရ လွယ်မယ်:

```
loginDemoAdmin()
getAdminDashboard()
getApplications({ kind })            kind = 'new' သို့ 'renewal'
approveApplication(id)
rejectApplication(id, reason)
getAdminPlaces({ owned, q, status })
updatePlace(id, fields)
setPlaceHidden(id, hidden)
createPublicPlace(fields)
updateCategory(id, { nameEn, nameMy })
getReports({ kind })                 kind = 'report' သို့ 'appeal'
resolveReport(id, { action, note })
getUsers({ q, status })
setUserBanned(id, banned)
getAuditLog({ action })
```

Fake data ကိုတော့ src/data/places.js ထဲက ဆိုင်တွေ ပြန်သုံးပြီး ဆိုင်အသစ် ၄ ခုလောက်၊ သက်တမ်းတိုး ၂ ခု၊ report ၅-၆ ခု၊ appeal ၂ ခု၊ user ၁၀ ယောက်ကျော်လောက် ထည့်ထားရင် လုံလောက်ပါတယ်။


## ပြီးရင်

ဒီ file တွေကို folder ပုံစံ မပျက်အောင် zip လုပ်ပြီး ပို့ပေးပါ:

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

node_modules folder ကိုတော့ မထည့်ပါနဲ့၊ အရမ်းကြီးလို့။ တခြား file တစ်ခုခု ပြင်ခဲ့ရင် ဘာ file လဲ ပြောပေးပါ။ Screenshot လေး ၂-၃ ပုံပါ ပို့ပေးရင် ပိုကောင်းတယ်။

တစ်ခါတည်း အကုန်ပြီးမှ ပို့စရာ မလိုပါဘူး၊ menu တစ်ခု နှစ်ခု ပြီးတိုင်း ပို့လည်း ရတယ်။ နားမလည်တာ ရှိရင် ကျနော့်ကို အချိန်မရွေး မေးပါ။
