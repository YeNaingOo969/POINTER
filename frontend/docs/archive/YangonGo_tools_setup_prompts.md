# YangonGo: Tools, Setup List နဲ့ Prompts

ရန်ကုန် city guide website (PHP) အတွက် tools စာရင်း၊ setup အဆင့်ဆင့်၊ Claude/Claude Code/AI tool တွေမှာ ကူးသုံးလို့ရတဲ့ prompts အားလုံးကို ဒီဖိုင်တစ်ခုထဲမှာ စုထားပါတယ်။

မှတ်ချက်: စက်က Windows 11၊ RAM 8GB ဆိုပြီး ယူဆထားပါတယ်။ Requirement (Round 1 မေးခွန်း ၂ မှ ၇) ပြည့်စုံရင် စာရင်းကို ညှိရပါမယ်။

---

## အပိုင်း ၁: Tools စာရင်း

### ၁.၁ Map design (UI mockup)

| Tool | သုံးပုံ | ကုန်ကျစရိတ် |
|---|---|---|
| Figma | App screen mockup၊ map page layout၊ prototype | Free |
| Excalidraw | Wireframe ကို မြန်မြန်ဆွဲ | Free |
| MapTiler Cloud / Stadia Maps | Map style ကို ကိုယ့်အရောင်နဲ့ ပြင်ပြီး tile ယူ | Free tier ရှိ |
| Maputnik | Map style ကို visual editor နဲ့ ပြင် | Free |
| Leaflet + OpenStreetMap | Website ထဲက တကယ့် map | Free |

OpenStreetMap ရဲ့ public tile server ကို လူသုံးများတဲ့ site မှာ အကြီးအကျယ် မသုံးသင့်ပါဘူး (usage policy ရှိတယ်)။ Launch မလုပ်ခင် MapTiler ဒါမှမဟုတ် Stadia free tier ကို ပြောင်းသုံးပါ။ အသေးစိတ်ကို သူတို့ website မှာ စစ်ပါ။

### ၁.၂ Logo နဲ့ brand

| Tool | သုံးပုံ |
|---|---|
| Inkscape | Free vector editor၊ SVG logo ကို ဖွင့်ပြင် |
| Figma | Logo + app icon artboard |
| Canva | Social media cover၊ poster အမြန်လုပ် |
| Looka / Midjourney | AI နဲ့ logo idea ကြည့် (account လိုတယ်) |
| svgo | SVG ဖိုင်အရွယ်လျှော့ |
| sharp | SVG ကနေ PNG/favicon အရွယ်စုံ ထုတ် |
| RealFaviconGenerator | Favicon အစုံ တစ်ခါတည်းထုတ် |

### ၁.၃ Icon နဲ့ Illustration

| Tool | သုံးပုံ |
|---|---|
| Font Awesome / Tabler Icons / Lucide | Category icon၊ UI icon |
| unDraw / Storyset | Empty state၊ onboarding illustration |
| Iconify | Icon set အများကြီး တစ်နေရာတည်းမှာ ရှာ |
| Inkscape | Custom map pin၊ category marker |

### ၁.၄ ဓာတ်ပုံနဲ့ ပုံပြင်ဆင်ခြင်း

| Tool | သုံးပုံ |
|---|---|
| Unsplash / Pexels | Free stock ဓာတ်ပုံ |
| GIMP / Photopea | Crop၊ အရောင်ညှိ၊ background ဖယ် (Photopea က browser မှာသုံးလို့ရ) |
| remove.bg | ဓာတ်ပုံနောက်ခံ ဖယ် |
| Squoosh | ပုံအရွယ်လျှော့၊ WebP ပြောင်း |
| sharp | ပုံ batch resize/WebP |
| PHP GD / Imagick | ဆိုင်ရှင် upload ပုံတွေကို server မှာ resize |

### ၁.၅ Color၊ Font၊ Design system

| Tool | သုံးပုံ |
|---|---|
| Coolors | Color palette ထုတ် |
| WebAIM Contrast Checker | စာလုံး/နောက်ခံ အရောင် ဖတ်လို့ရမရ စစ် |
| Google Fonts | Font ရွေး။ Burmese အတွက် Noto Sans Myanmar (Unicode) |
| Figma Variables / Styles | Color, font ကို design system အဖြစ်သိမ်း |

### ၁.၆ Marketing နဲ့ ကြော်ငြာပုံ

| Tool | သုံးပုံ |
|---|---|
| Canva | Facebook cover၊ Instagram post၊ ဆိုင်ရှင် promo template |
| Mockuphone / Figma mockups | App ကို ဖုန်းထဲမှာ ပြထားတဲ့ ပုံ |
| Screely | Screenshot ကို browser frame ထည့် |
| LottieFiles | Loading၊ check-in success animation |
| Midjourney / DALL·E / Ideogram / Adobe Firefly | Banner idea၊ ကြော်ငြာ background |

သတိ: နေရာ/ဆိုင် detail page မှာ တကယ့်ဓာတ်ပုံ သုံးပါ။ AI ပုံက ကြော်ငြာ background လောက်ပဲ သုံးပါ။

### ၁.၇ Development (PHP project)

| Tool | အကြောင်းရင်း |
|---|---|
| PHP 8.x | မဖြစ်မနေသုံးမယ့် language |
| XAMPP / Laragon | Apache + PHP + MySQL တစ်ခါတည်း (Laragon က RAM သက်သာ) |
| MySQL/MariaDB + phpMyAdmin | Database |
| Composer | PHP package manager |
| Git + VS Code | Version control နဲ့ editor |
| Claude Code | Code ရေး၊ ပြင်ပေးမယ့် tool |
| Leaflet | Map library (CDN နဲ့ သုံးလို့ရ) |

---

## အပိုင်း ၂: Setup List (အဆင့်ဆင့်)

### အဆင့် ၁: Install

```bash
winget install Git.Git
winget install Microsoft.VisualStudioCode
winget install OpenJS.NodeJS.LTS
winget install Inkscape.Inkscape
winget install Figma.Figma
winget install GIMP.GIMP
```

winget ID မမှန်ရင် `winget search <name>` နဲ့ ရှာပါ။

XAMPP (apachefriends.org) ဒါမှမဟုတ် Laragon (laragon.org) နဲ့ Composer (getcomposer.org) ကို website ကနေ download လုပ်ပါ။

### အဆင့် ၂: Project folder ဖွင့်

```bash
cd C:\xampp\htdocs
mkdir yangongo
cd yangongo
git init
```

### အဆင့် ၃: Asset tools

```bash
npm init -y
npm install -D sharp svgo
```

`php.ini` ထဲက `extension=gd` ကို ဖွင့်ထားပါ (upload ပုံ resize အတွက်)။ ပြီးရင် Apache ကို restart လုပ်ပါ။

### အဆင့် ၄: ကိုယ်တိုင်လုပ်ရမယ့်အပိုင်း

- Figma, MapTiler (လိုရင် Looka, Canva) account ဖွင့်ပါ
- API key ရရင် `.env` ထဲပဲ ထည့်ပါ၊ chat ထဲ မကူးပါနဲ့
- `.env` ကို `.gitignore` ထဲ ထည့်ပါ
- ဓာတ်ပုံ/icon/font တွေရဲ့ license ကို ကိုယ်တိုင်စစ်ပါ

### အဆင့် ၅: Claude Code စမ်းခြင်း

Project folder ထဲမှာ `claude` ကို run ပြီး Prompt A ကို ပေးပါ။ Claude Code က command တစ်ခုချင်းစီအတွက် ခွင့်ပြုချက် တောင်းပါလိမ့်မယ်။

---

## အပိုင်း ၃: Prompts

### Prompt A: Project scaffold (Claude Code)

```
ဒီ folder မှာ "YangonGo" ဆိုတဲ့ ရန်ကုန် city guide website ကို PHP 8 နဲ့ စတင်တည်ဆောက်ပေးပါ။

Requirement:
- Language: PHP (PDO + MySQL)၊ Frontend မှာ HTML/CSS/JS၊ Bootstrap 5 သုံးပါ
- Map: Leaflet + OpenStreetMap tile (tile URL ကို config ထဲမှာ ပြောင်းလို့ရအောင်)
- User role ၄ မျိုး: guest, user, owner, admin
- Place category: ဘုရား/အထိမ်းအမှတ်, ပန်းခြံ, စားသောက်ဆိုင်, ကော်ဖီဆိုင်, ညဈေး, ဟိုတယ်, ဈေးဝယ်စင်တာ
- MVP feature:
  1. Map ပေါ်မှာ place pin တွေပြ + category filter + search
  2. Place detail page (ဓာတ်ပုံ, ဖွင့်ချိန်, ဖုန်း, "Get Directions" button)
  3. Review + 1-5 rating (login လိုတယ်)
  4. Owner က promotion post တင်၊ သက်တမ်းသတ်မှတ်
  5. Mood tag filter (ငြိမ်သက်, စည်ကား, ဈေးသက်သာ)
  6. Burmese/English ပြောင်းလို့ရအောင် language file ခွဲပါ

Security: PDO prepared statements, password_hash, CSRF token, image upload validation။

အဆင့်:
1. Folder structure ကို အရင်အဆိုပြုပြီး ကျွန်တော့်ကို ပြပါ
2. database/schema.sql ရေး (users, places, categories, reviews, posts, mood_tags)
3. Seed data (ရန်ကုန်နေရာ ၁၀ ခု ဥပမာ)
4. Home page + map page ကို အရင်လုပ်ပါ
ကျွန်တော်ခွင့်မပြုခင် ကျန်တာတွေ မရေးပါနဲ့။
```

### Prompt B: Map page mockup (Claude / Figma အတွက်)

```
YangonGo app ရဲ့ map page mockup ကို mobile-first နဲ့ ဒီဇိုင်းလုပ်ပေးပါ။
Layout: အပေါ်မှာ search bar + category chips, အလယ်မှာ map (pin တွေ),
အောက်မှာ bottom sheet နဲ့ နေရာကတ် (ဓာတ်ပုံ, rating, အကွာအဝေး, Directions button)။
အရောင်: coral #E8553D ကို primary၊ အဖြူ/မီးခိုးနုကို background။
Filter panel, mood selector ပါ ပြပါ။
```

### Prompt C: Logo (Midjourney / Looka)

```
Minimal flat logo for "YangonGo", a Yangon city guide app.
Coral map pin with a forward arrow inside, clean geometric shapes,
modern and youthful, simple enough for app icon and favicon,
white background, vector style, no gradients.
```

### Prompt D: Logo asset ထုတ် (Claude Code)

```
assets/logo/logo.svg ကို svgo နဲ့ optimise လုပ်ပါ။
ပြီးရင် sharp နဲ့ favicon-32.png, favicon-192.png, favicon-512.png နဲ့
og-image.png (1200x630, အဖြူနောက်ခံ logo အလယ်) ထုတ်ပေးပါ။
npm script "build:logo" အဖြစ် ရေးပါ။
```

### Prompt E: Category icon နဲ့ map marker (Claude Code)

```
YangonGo map အတွက် category marker ကို ပြင်ဆင်ပါ။
Category 7 မျိုး (ဘုရား, ပန်းခြံ, စားသောက်ဆိုင်, ကော်ဖီဆိုင်, ညဈေး, ဟိုတယ်, ဈေးဝယ်စင်တာ)
အတွက် Tabler Icons ကို သုံးပြီး category တစ်ခုချင်းစီကို အရောင်ခြားထားတဲ့
Leaflet custom marker (divIcon) ကို js/markers.js ထဲမှာ ရေးပါ။
အရောင်တွေကို CSS variable နဲ့ ထားပါ။ အရောင်တူလို့ မခွဲနိုင်တာ မဖြစ်စေနဲ့။
```

### Prompt F: Upload ပုံ ပြင်ဆင် (Claude Code)

```
ဆိုင်ရှင်တင်တဲ့ ပုံ upload ကို PHP မှာ ပြင်ပါ။
- jpg/png/webp ပဲ လက်ခံ၊ MIME type ကို finfo နဲ့ စစ်
- အများဆုံး 5MB
- GD သုံးပြီး အကျယ် 1200px အထိ resize၊ thumbnail 400px လည်း ထုတ်
- ဖိုင်နာမည်ကို random ပေးပြီး uploads/ ထဲသိမ်း
- ကျွန်တော့်ကို security ဘက်က စစ်ထားတာတွေ စာရင်းပြပါ
```

### Prompt G: ကြော်ငြာ banner (Canva / Midjourney)

```
Social media banner for "YangonGo", Yangon city guide app.
Street food night market scene, warm coral and cream color palette,
flat illustration style, space on the left for text, 16:9.
```

---

## နောက်တစ်ဆင့်

Tools အကုန်လုံးကို ချက်ချင်း install မလုပ်ပါနဲ့။ Requirement မေးခွန်း ၂ မှ ၇ (ရည်ရွယ်ချက်၊ user အမျိုးအစား၊ platform၊ ဘာသာစကား၊ category၊ နယ်ပယ်/အရင်းအမြစ်) ကို အရင်ဖြေပြီးမှ တကယ်လိုတာတွေကိုပဲ ရွေးပါ။
