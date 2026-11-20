/**
 * POINTER Admin Portal - Global Authentication, Navigation & Session Manager
 */
(function() {
  // 1. Check Authentication
  async function checkAdminAuth() {
    let currentUser = null;

    // Check PHP Backend session first
    try {
      const res = await fetch('/api/session.php', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user && data.user.role === 'admin') {
          currentUser = data.user;
        }
      }
    } catch (e) {
      // Backend not running or network error, fallback to mock store
    }

    // Check Mock / Demo store if no backend session
    if (!currentUser) {
      try {
        const raw = localStorage.getItem('yg.demo') || localStorage.getItem('pointer-demo');
        if (raw) {
          const store = JSON.parse(raw);
          if (store && store.session && store.session.user && store.session.user.role === 'admin') {
            currentUser = store.session.user;
          }
        }
      } catch (e) {}
    }

    // If authenticated, update UI
    if (currentUser) {
      updateAdminProfile(currentUser);
      return;
    }

    // Not authenticated as admin -> Show access barrier modal
    showAuthBarrierModal();
  }

  function updateAdminProfile(user) {
    document.querySelectorAll('[data-admin-name]').forEach(el => {
      el.textContent = user.name || 'Admin';
    });
    // In case there are profile names
    const profNames = document.querySelectorAll('.font-title-sm.text-body-md.text-on-surface.font-semibold');
    profNames.forEach(el => {
      if (el.textContent.includes('Aung Kyaw Moe') || el.textContent.includes('Super Administrator')) {
        el.textContent = user.name || 'Admin';
      }
    });
  }

  function showAuthBarrierModal() {
    // Check if modal already exists
    if (document.getElementById('admin-auth-barrier')) return;

    const modal = document.createElement('div');
    modal.id = 'admin-auth-barrier';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl';
    modal.innerHTML = `
      <div class="relative w-full max-w-md p-6 rounded-2xl bg-[#11131c] border border-[#d4af37]/40 shadow-[0_0_50px_rgba(212,175,55,0.25)] text-center text-[#e1e1ef]">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center text-[#f2ca50]">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-[#f2ca50] mb-2 font-['Plus_Jakarta_Sans',sans-serif]">စီမံခန့်ခွဲသူ သီးသန့်ဖြစ်သည်</h3>
        <p class="text-sm text-gray-300 mb-6 leading-relaxed">
          POINTER Admin Portal ကို အသုံးပြုရန် Admin အကောင့်ဖြင့် ဝင်ရောက်ရန် လိုအပ်ပါသည်။
          <br><span class="text-xs text-gray-400">Admin account required to access this portal.</span>
        </p>
        <div class="flex flex-col gap-3">
          <a href="/login.html?next=${encodeURIComponent(location.pathname)}" class="w-full py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-[#d4af37] to-[#e9c349] text-black hover:opacity-95 shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all">
            Admin အကောင့်ဖြင့် ဝင်မည် (Log in)
          </a>
          <button type="button" id="btn-demo-admin" class="w-full py-3 px-4 rounded-xl font-semibold bg-[#282933] text-[#f2ca50] border border-[#d4af37]/30 hover:bg-[#32343e] hover:border-[#d4af37] transition-all">
            Demo Admin အဖြစ် စမ်းသပ်ကြည့်မည် (Try as Demo)
          </button>
          <a href="/home.html" class="w-full py-2.5 px-4 text-xs text-gray-400 hover:text-white transition-colors">
            ← ပင်မစာမျက်နှာသို့ ပြန်သွားမည် (Back to Home)
          </a>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-demo-admin').addEventListener('click', () => {
      // Set demo admin session in localStorage
      const adminUser = { id: 18, name: 'Admin U Min Thant', email: 'admin@pointer.app', role: 'admin' };
      try {
        const store1 = JSON.parse(localStorage.getItem('pointer-demo') || '{}');
        store1.session = { user: adminUser };
        localStorage.setItem('pointer-demo', JSON.stringify(store1));
      } catch (e) {}
      try {
        const store2 = JSON.parse(localStorage.getItem('yg.demo') || '{}');
        store2.session = { user: adminUser };
        localStorage.setItem('yg.demo', JSON.stringify(store2));
      } catch (e) {}
      modal.remove();
      updateAdminProfile(adminUser);
    });
  }

  // 2. Global Admin Logout Handler
  window.handleAdminLogout = async function() {
    if (confirm('စနစ်မှ ထွက်ခွာမည်လား? / Are you sure you want to sign out?')) {
      try {
        await fetch('/api/logout.php', { method: 'POST', credentials: 'include' });
      } catch (e) {}
      try {
        const store = JSON.parse(localStorage.getItem('pointer-demo') || '{}');
        delete store.session;
        localStorage.setItem('pointer-demo', JSON.stringify(store));
      } catch (e) {}
      try {
        const store = JSON.parse(localStorage.getItem('yg.demo') || '{}');
        delete store.session;
        localStorage.setItem('yg.demo', JSON.stringify(store));
      } catch (e) {}
      location.href = '/login.html';
    }
  };

  // 3. Global Admin API Client for Real Backend Connectivity
  let cachedCsrfToken = null;
  async function getCsrfToken() {
    if (cachedCsrfToken) return cachedCsrfToken;
    try {
      const res = await fetch('/api/session.php', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        if (d && d.csrfToken) cachedCsrfToken = d.csrfToken;
      }
    } catch (e) {}
    return cachedCsrfToken || '';
  }

  window.adminFetch = async function(endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = {
      'Content-Type': 'application/json',
      'X-Admin-Dev': '1',
      ...(options.headers || {})
    };
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const token = await getCsrfToken();
      if (token) headers['X-CSRF-Token'] = token;
    }
    const fetchOpts = {
      credentials: 'include',
      headers,
      ...options
    };
    if (options.body && typeof options.body !== 'string') {
      fetchOpts.body = JSON.stringify(options.body);
    }
    try {
      const res = await fetch('/api/admin/' + endpoint, fetchOpts);
      if (!res.ok) {
        try {
          return await res.json();
        } catch (_) {
          return { error: 'Request failed with status ' + res.status };
        }
      }
      return await res.json();
    } catch (err) {
      console.warn('Backend call failed: /api/admin/' + endpoint, err);
      return null;
    }
  };

  window.AdminAPI = {
    getDashboard: () => window.adminFetch('dashboard.php'),
    getApplications: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return window.adminFetch(`applications.php${q ? '?' + q : ''}`);
    },
    approveApplication: (id) => window.adminFetch('applications.php', { method: 'POST', body: { id, action: 'approve' } }),
    rejectApplication: (id, reason) => window.adminFetch('applications.php', { method: 'POST', body: { id, action: 'reject', reason } }),
    getPlaces: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return window.adminFetch(`places.php${q ? '?' + q : ''}`);
    },
    updatePlace: (id, fields) => window.adminFetch(`places.php?id=${encodeURIComponent(id)}`, { method: 'PUT', body: fields }),
    createPublicPlace: (fields) => window.adminFetch('places.php', { method: 'POST', body: fields }),
    getCategories: () => window.adminFetch('categories.php'),
    updateCategory: (id, fields) => window.adminFetch(`categories.php?id=${encodeURIComponent(id)}`, { method: 'PUT', body: fields }),
    getReports: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return window.adminFetch(`reports.php${q ? '?' + q : ''}`);
    },
    resolveReport: (id, action, note) => window.adminFetch('reports.php', { method: 'POST', body: { id, action, note } }),
    getUsers: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return window.adminFetch(`users.php${q ? '?' + q : ''}`);
    },
    setUserBanned: (id, banned) => window.adminFetch('users.php', { method: 'POST', body: { id, banned, status: banned ? 'suspended' : 'active' } }),
    getAuditLog: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return window.adminFetch(`audit-log.php${q ? '?' + q : ''}`);
    }
  };

  // -----------------------------------------------------------------
  // 4. Global Admin Language & Internationalization Engine (EN / MY)
  // -----------------------------------------------------------------
  const ADMIN_DICT = {
    en: {
      // Navigation
      nav_dashboard: "Dashboard",
      nav_applications: "Applications",
      nav_shops: "Shops",
      nav_places: "Public Places",
      nav_categories: "Categories",
      nav_reports: "Reports",
      nav_users: "Users",
      nav_audit: "Audit Log",
      nav_home: "Main Website",
      nav_logout: "Sign Out",
      nav_core_nav: "Core Navigation",
      nav_operations: "Operations Console",
      nav_node_status: "Node Status",
      nav_encrypted: "Encrypted",
      nav_cluster: "Cluster",

      // Header
      search_placeholder: "Search telemetry, shops, places, users...",
      admin_title: "Admin U Min Thant",
      admin_role: "Super Administrator • admin@pointer.app",
      admin_notifications: "Notifications",
      lang_switch_label: "English (EN)",
      lang_switch_title: "Current: English. Click to switch to Myanmar Unicode.",

      // Common actions
      btn_save: "Save Changes",
      btn_cancel: "Cancel",
      btn_delete: "Delete",
      btn_edit: "Edit",
      btn_view: "View Details",
      btn_confirm: "Confirm",
      btn_approve: "Approve",
      btn_reject: "Reject",
      btn_add: "Add New",
      btn_refresh: "Refresh Data",
      btn_close: "Close",
      btn_reassign_delete: "Reassign & Delete",
      btn_confirm_delete: "Confirm Delete",

      // Statuses
      status_active: "Active",
      status_pending: "Pending",
      status_suspended: "Suspended",
      status_hidden: "Hidden",
      status_expired: "Expired",
      status_approved: "Approved",
      status_rejected: "Rejected",

      // Dashboard
      header_title: "Welcome Back",
      header_subtitle: "Real-time metrics, directory insights & platform surveillance",
      sec_key_metrics: "Key Platform Metrics",
      stat_total_shops: "Total Registered Shops",
      stat_live_shops: "Verified Live Shops",
      stat_total_places: "Public Landmarks",
      stat_total_users: "Total Registered Users",
      stat_pending_apps: "Pending Applications",
      stat_open_reports: "Open Reports",
      sec_traffic_chart: "Platform Traffic & Directory Activity (Weekly)",
      sec_audit_stream: "Live Security & Governance Stream",

      // Categories
      cat_title: "Category Taxonomy & Governance",
      cat_subtitle: "Manage, expand and audit platform directory categories and sub-sectors",
      cat_add_btn: "New Taxonomy Node",
      cat_stat_total: "Active Taxonomies",
      cat_stat_records: "Total Mapped Records",
      cat_stat_coverage: "Health & Integrity",
      cat_filter_all: "All Taxonomies",
      cat_search_ph: "Search categories by name, slug or code...",

      // Applications
      app_title: "Merchant Applications",
      app_subtitle: "Review merchant store verification, business licenses and owner plans",
      app_tab_all: "All Applications",
      app_tab_pending: "Pending Review",
      app_tab_approved: "Approved",
      app_tab_rejected: "Rejected",

      // Shops
      shop_title: "Merchant Directory",
      shop_subtitle: "Manage boutique listings, business owners and merchant storefronts",
      shop_add_btn: "Register Shop",

      // Places
      place_title: "Public Places & Landmarks",
      place_subtitle: "Manage cultural heritages, parks, religious shrines and sovereign assets",
      place_add_btn: "New Public Place",

      // Users
      user_title: "User Registry & Security Governance",
      user_subtitle: "Manage user privileges, verification statuses and security restrictions",

      // Reports
      report_title: "Intelligence & User Reports",
      report_subtitle: "Investigate flagged listings, inappropriate content and user disputes",

      // Audit Log
      audit_title: "Cryptographic Audit Ledger",
      audit_subtitle: "Immutable chronological trail of all administrative and security actions"
    },
    my: {
      // Navigation
      nav_dashboard: "ဒက်ရှ်ဘုတ်",
      nav_applications: "ဆိုင်လျှောက်ထားမှုများ",
      nav_shops: "ဆိုင်များ စီမံရန်",
      nav_places: "အများပြည်သူဆိုင်ရာ နေရာများ",
      nav_categories: "ကဏ္ဍခွဲများ စီမံရန်",
      nav_reports: "တိုင်ကြားမှုနှင့် စုံစမ်းမှုများ",
      nav_users: "အသုံးပြုသူများ စာရင်း",
      nav_audit: "စာရင်းစစ် မှတ်တမ်း",
      nav_home: "ပင်မ ဝက်ဘ်ဆိုက်",
      nav_logout: "စနစ်မှ ထွက်မည်",
      nav_core_nav: "ပင်မ လမ်းညွှန်မီနူး",
      nav_operations: "လည်ပတ်မှု ကွန်ဆိုးလ်",
      nav_node_status: "ဆာဗာ အခြေအနေ",
      nav_encrypted: "လုံခြုံရေး စနစ် အသက်ဝင်နေသည်",
      nav_cluster: "ကလပ်စတာ",

      // Header
      search_placeholder: "ဆိုင်များ၊ အသုံးပြုသူများ၊ နေရာများကို ရှာဖွေပါ...",
      admin_title: "အက်ဒမင် ဦးမင်းသန့်",
      admin_role: "အဆင့်မြင့် အုပ်ချုပ်သူ • admin@pointer.app",
      admin_notifications: "အသိပေးချက်များ",
      lang_switch_label: "မြန်မာ (MY)",
      lang_switch_title: "လက်ရှိ: မြန်မာစာ။ English သို့ ပြောင်းရန် နှိပ်ပါ။",

      // Common actions
      btn_save: "သိမ်းဆည်းမည်",
      btn_cancel: "မလုပ်တော့ပါ",
      btn_delete: "ဖျက်မည်",
      btn_edit: "ပြင်ဆင်မည်",
      btn_view: "အသေးစိတ် ကြည့်မည်",
      btn_confirm: "သေချာပါသည်",
      btn_approve: "အတည်ပြုမည်",
      btn_reject: "ငြင်းပယ်မည်",
      btn_add: "အသစ်ထည့်မည်",
      btn_refresh: "ဒေတာ အသစ်ပြန်တင်မည်",
      btn_close: "ပိတ်မည်",
      btn_reassign_delete: "နေရာလွှဲပြောင်းပြီး ဖျက်မည်",
      btn_confirm_delete: "ဖျက်မည်မှာ သေချာပါသည်",

      // Statuses
      status_active: "အသုံးပြုနေဆဲ",
      status_pending: "စိစစ်ဆဲ",
      status_suspended: "ပိတ်ပင်ထားသည်",
      status_hidden: "ဝှက်ထားသည်",
      status_expired: "သက်တမ်းကုန်",
      status_approved: "အတည်ပြုပြီး",
      status_rejected: "ငြင်းပယ်ထားသည်",

      // Dashboard
      header_title: "ပြန်လည်ကြိုဆိုပါသည်",
      header_subtitle: "အချိန်နှင့်တပြေးညီ ပလက်ဖောင်း အခြေအနေနှင့် ညွှန်းကိန်းများ စောင့်ကြည့်စစ်ဆေးမှု",
      sec_key_metrics: "အဓိက ပလက်ဖောင်း ညွှန်းကိန်းများ",
      stat_total_shops: "ဆိုင်များ စုစုပေါင်း",
      stat_live_shops: "အတည်ပြုထားသော ဆိုင်များ",
      stat_total_places: "အများပြည်သူဆိုင်ရာ နေရာများ",
      stat_total_users: "မှတ်ပုံတင်ထားသူ စုစုပေါင်း",
      stat_pending_apps: "စိစစ်ဆဲ ဆိုင်လျှောက်ထားမှုများ",
      stat_open_reports: "ဖြေရှင်းရန်ကျန် တိုင်ကြားချက်များ",
      sec_traffic_chart: "ပလက်ဖောင်း လှုပ်ရှားမှုနှင့် အသုံးပြုမှု အခြေအနေ (အပတ်စဉ်)",
      sec_audit_stream: "လတ်တလော စနစ်လုံခြုံရေးနှင့် စီမံခန့်ခွဲမှု မှတ်တမ်း",

      // Categories
      cat_title: "ကဏ္ဍခွဲများ စီမံခန့်ခွဲမှု (Categories)",
      cat_subtitle: "ပလက်ဖောင်းရှိ အမျိုးအစားနှင့် ကဏ္ဍခွဲများကို ထည့်သွင်းခြင်း၊ ပြင်ဆင်ခြင်းနှင့် ဖျက်သိမ်းခြင်း",
      cat_add_btn: "ကဏ္ဍခွဲ အသစ်ထည့်မည်",
      cat_stat_total: "စုစုပေါင်း ကဏ္ဍခွဲများ",
      cat_stat_records: "ချိတ်ဆက်ထားသော နေရာများ",
      cat_stat_coverage: "စနစ်တည်ငြိမ်မှု အခြေအနေ",
      cat_filter_all: "ကဏ္ဍခွဲ အားလုံး",
      cat_search_ph: "ကဏ္ဍခွဲအမည် သို့မဟုတ် ကုဒ်ဖြင့် ရှာဖွေပါ...",

      // Applications
      app_title: "ဆိုင် လျှောက်ထားမှုများ",
      app_subtitle: "ဆိုင်ပိုင်ရှင်များ၏ စီးပွားရေးလိုင်စင်၊ ဆိုင်အချက်အလက်နှင့် ပလန်များကို စိစစ်အတည်ပြုခြင်း",
      app_tab_all: "လျှောက်ထားမှု အားလုံး",
      app_tab_pending: "စိစစ်ဆဲ",
      app_tab_approved: "အတည်ပြုပြီး",
      app_tab_rejected: "ငြင်းပယ်ထားသည်",

      // Shops
      shop_title: "ဆိုင်များ စီမံခန့်ခွဲမှု",
      shop_subtitle: "ပလက်ဖောင်းပေါ်ရှိ ဆိုင်ခွဲများ၊ ဆိုင်ပိုင်ရှင်များနှင့် ဝန်ဆောင်မှုများကို စီမံခန့်ခွဲခြင်း",
      shop_add_btn: "ဆိုင် အသစ်ထည့်မည်",

      // Places
      place_title: "အများပြည်သူဆိုင်ရာ နေရာများ",
      place_subtitle: "သမိုင်းဝင် အထင်ကရနေရာများ၊ ဘုရားပုထိုးများ၊ ပန်းခြံများနှင့် အပန်းဖြေစရာများ",
      place_add_btn: "နေရာ အသစ်ထည့်မည်",

      // Users
      user_title: "အသုံးပြုသူများ စီမံခန့်ခွဲမှု",
      user_subtitle: "အသုံးပြုသူ အကောင့်များ၊ အခွင့်အရေးများနှင့် လုံခြုံရေးဆိုင်ရာ ပိတ်ပင်မှုများကို ထိန်းချုပ်ခြင်း",

      // Reports
      report_title: "တိုင်ကြားချက်များနှင့် စုံစမ်းမှုများ",
      report_subtitle: "မလျော်ကန်သော အကြောင်းအရာများ၊ အငြင်းပွားမှုများနှင့် တိုင်ကြားမှုများကို စစ်ဆေးဖြေရှင်းခြင်း",

      // Audit Log
      audit_title: "စာရင်းစစ် မှတ်တမ်း (Audit Log)",
      audit_subtitle: "အက်ဒမင်များ၏ စနစ်တွင်း ဆောင်ရွက်ချက်များနှင့် လုံခြုံရေးမှတ်တမ်းများ"
    }
  };

  let currentAdminLang = localStorage.getItem('pointer_admin_lang') || 'en';

  function updateLangButtonUI() {
    const btnText = document.getElementById('admin-lang-btn-text');
    const btn = document.getElementById('admin-global-lang-btn');
    if (!btnText || !btn) return;
    const isEn = (currentAdminLang === 'en');
    btnText.textContent = isEn ? 'English (EN)' : 'မြန်မာ (MY)';
    btn.setAttribute('title', isEn 
      ? 'Current: English. Click to switch to Myanmar Unicode.' 
      : 'လက်ရှိ: မြန်မာစာ။ English သို့ ပြောင်းရန် နှိပ်ပါ။'
    );
  }

  function translateSidebar(lang) {
    const t = ADMIN_DICT[lang];
    if (!t) return;

    // Translate all sidebar navigation links
    const navLinks = document.querySelectorAll('aside nav a, aside a[data-path], aside a[href*=".html"]');
    navLinks.forEach(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      const dataPath = (a.getAttribute('data-path') || '').toLowerCase();
      
      // Look for the label text node / span
      const spans = Array.from(a.querySelectorAll('span'));
      const textSpan = spans.reverse().find(s => {
        const cl = s.className || '';
        return !cl.includes('material-symbols-outlined') && 
               !cl.includes('lucide') && 
               !cl.includes('w-1.5') && 
               !cl.includes('rounded-full');
      });

      if (!textSpan) return;

      if (href.includes('dashboard') || dataPath === 'dashboard') {
        textSpan.textContent = t.nav_dashboard;
      } else if (href.includes('application') || dataPath === 'application') {
        textSpan.textContent = t.nav_applications;
      } else if (href.includes('shop') || dataPath === 'shop') {
        textSpan.textContent = t.nav_shops;
      } else if (href.includes('publicplaces') || dataPath === 'public-place' || dataPath === 'publicplace') {
        textSpan.textContent = t.nav_places;
      } else if (href.includes('category') || dataPath === 'categories' || dataPath === 'category') {
        textSpan.textContent = t.nav_categories;
      } else if (href.includes('reports') || dataPath === 'report' || dataPath === 'reports') {
        textSpan.textContent = t.nav_reports;
      } else if (href.includes('user') || dataPath === 'users' || dataPath === 'user') {
        textSpan.textContent = t.nav_users;
      } else if (href.includes('auditlog') || dataPath === 'audit-log' || dataPath === 'audit') {
        textSpan.textContent = t.nav_audit;
      } else if (href.includes('home') || dataPath === 'home') {
        textSpan.textContent = t.nav_home;
      } else if (dataPath === 'logout') {
        textSpan.textContent = t.nav_logout;
      }
    });

    // Translate sidebar category / section titles
    document.querySelectorAll('aside div.uppercase, aside span.uppercase').forEach(el => {
      const txt = el.textContent.trim().toLowerCase();
      if (txt.includes('core navigation') || txt.includes('ပင်မ လမ်းညွှန်မီနူး')) {
        el.textContent = t.nav_core_nav;
      } else if (txt.includes('operations console') || txt.includes('လည်ပတ်မှု')) {
        el.textContent = t.nav_operations;
      } else if (txt.includes('node status') || txt.includes('ဆာဗာ')) {
        el.textContent = t.nav_node_status;
      }
    });
  }

  function translateDomElements(lang) {
    const t = ADMIN_DICT[lang];
    if (!t) return;

    // Elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key]) {
        el.textContent = t[key];
      }
    });

    // Elements with data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (t[key]) {
        el.placeholder = t[key];
      }
    });

    // Global Search Bar in header
    document.querySelectorAll('header input[type="text"], header input[type="search"]').forEach(input => {
      input.placeholder = t.search_placeholder;
    });

    // User Profile in header
    document.querySelectorAll('header .font-semibold, header .font-bold').forEach(el => {
      if (el.textContent.includes('Admin U Min Thant') || el.textContent.includes('အက်ဒမင် ဦးမင်းသန့်')) {
        el.textContent = t.admin_title;
      }
    });
  }

  window.setGlobalAdminLanguage = function(lang) {
    if (lang !== 'en' && lang !== 'my') lang = 'en';
    currentAdminLang = lang;
    try {
      localStorage.setItem('pointer_admin_lang', lang);
    } catch (_) {}

    document.documentElement.lang = lang;
    updateLangButtonUI();
    translateSidebar(lang);
    translateDomElements(lang);

    // Dispatch event for page-specific components to re-render
    try {
      window.dispatchEvent(new CustomEvent('adminLanguageChanged', { detail: { lang } }));
    } catch (_) {}

    if (typeof window.onAdminLanguageChanged === 'function') {
      try {
        window.onAdminLanguageChanged(lang);
      } catch (e) {
        console.warn('onAdminLanguageChanged handler error:', e);
      }
    }
  };

  window.toggleAdminLanguage = function() {
    const next = (currentAdminLang === 'en' ? 'my' : 'en');
    window.setGlobalAdminLanguage(next);
  };

  // Expose global shorthand for legacy templates
  window.toggleLanguage = window.toggleAdminLanguage;

  function findNotificationElement(header) {
    if (!header) return null;
    const buttons = Array.from(header.querySelectorAll('button'));
    for (const btn of buttons) {
      if (btn.id === 'admin-global-lang-btn') continue;
      if (
        btn.querySelector('.lucide-bell') ||
        btn.querySelector('[data-lucide="bell"]') ||
        btn.innerHTML.includes('notifications') ||
        btn.getAttribute('aria-label') === 'Notifications' ||
        btn.getAttribute('title') === 'Notifications'
      ) {
        return btn;
      }
    }
    const bellIcon = header.querySelector('.lucide-bell, [data-lucide="bell"]');
    if (bellIcon) return bellIcon.closest('button') || bellIcon.parentElement;
    return null;
  }

  function initHeaderLanguageButton() {
    if (document.getElementById('admin-global-lang-btn')) {
      updateLangButtonUI();
      return;
    }

    const header = document.querySelector('header');
    if (!header) return;

    const notifBtn = findNotificationElement(header);
    if (!notifBtn) return;

    const btn = document.createElement('button');
    btn.id = 'admin-global-lang-btn';
    btn.type = 'button';
    btn.className = 'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-[#141418]/90 hover:bg-[#202028] border border-[#D4AF37]/40 hover:border-[#FFD700] text-[#F3E5AB] hover:text-[#FFD700] transition-all cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.5)] font-medium text-xs shrink-0 mr-1 sm:mr-2';
    btn.innerHTML = `
      <svg class="w-4 h-4 text-[#FFD700] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
      </svg>
      <span id="admin-lang-btn-text" class="font-semibold tracking-wide">English (EN)</span>
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.toggleAdminLanguage();
    });

    const targetWrapper = notifBtn.parentElement && 
                          notifBtn.parentElement.classList.contains('relative') && 
                          notifBtn.parentElement !== header
      ? notifBtn.parentElement
      : notifBtn;

    targetWrapper.parentNode.insertBefore(btn, targetWrapper);
    updateLangButtonUI();
  }

  function setupAdminLanguageSystem() {
    initHeaderLanguageButton();
    window.setGlobalAdminLanguage(currentAdminLang);

    // Watch for header mount if rendered late
    let retries = 0;
    const interval = setInterval(() => {
      retries++;
      if (!document.getElementById('admin-global-lang-btn')) {
        initHeaderLanguageButton();
        if (document.getElementById('admin-global-lang-btn')) {
          window.setGlobalAdminLanguage(currentAdminLang);
          clearInterval(interval);
        }
      } else {
        clearInterval(interval);
      }
      if (retries > 10) clearInterval(interval);
    }, 300);
  }

  // Run Auth & Language Setup on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      checkAdminAuth();
      setupAdminLanguageSystem();
    });
  } else {
    checkAdminAuth();
    setupAdminLanguageSystem();
  }
})();
