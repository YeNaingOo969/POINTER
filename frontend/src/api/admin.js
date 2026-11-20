// Admin features (flowcharts 4, 4a–4d in docs/flows): dashboard, applications, shops,
// public places, categories, reports, users, audit log.
// Re-exported by api.js. Mock data lives in this browser (demo-store.js); each comment names the PHP endpoint.

import { USE_MOCK } from './config.js';
import { mockResponse, mockError, request } from './client.js';
import { readDemo, writeDemo } from './demo-store.js';
import { places as seedPlaces } from '../data/places.js';
import { categories as seedCategories } from '../data/categories.js';
import {
  adminApplications as seedApplications,
  adminReports as seedReports,
  adminUsers as seedUsers,
  adminAuditLog as seedAuditLog,
} from '../data/admin.js';

function getStore() {
  const store = readDemo('adminStore', null);
  if (store) return store;
  const initial = {
    applications: [...seedApplications],
    reports: [...seedReports],
    users: [...seedUsers],
    auditLog: [...seedAuditLog],
    places: [...seedPlaces],
    categories: [...seedCategories],
  };
  writeDemo('adminStore', initial);
  return initial;
}

function saveStore(store) {
  writeDemo('adminStore', store);
  return store;
}

function logAudit(action, targetType, targetName) {
  const store = getStore();
  const entry = {
    id: Date.now(),
    adminName: 'Admin',
    action,
    targetType,
    targetName,
    createdAt: new Date().toISOString(),
  };
  store.auditLog.unshift(entry);
  saveStore(store);
}

/** Mock only: sign in as Demo Admin. */
export function loginDemoAdmin() {
  const user = { id: 18, name: 'Admin (Demo)', email: 'admin@pointer.app', role: 'admin' };
  writeDemo('session', { user });
  return mockResponse({ user });
}

/**
 * Admin dashboard overview.
 * GET /api/admin/dashboard.php → { stats, latestAuditLog }
 */
export async function getAdminDashboard() {
  if (!USE_MOCK) return request('admin/dashboard.php');
  const store = getStore();
  return mockResponse({
    stats: {
      newShops: store.applications.filter((a) => a.kind === 'new' && a.status === 'pending').length,
      pendingPayments: store.applications.filter((a) => a.kind === 'renewal' && a.status === 'pending').length,
      openReports: store.reports.filter((r) => r.kind === 'report' && r.status === 'open').length,
      openAppeals: store.reports.filter((r) => r.kind === 'appeal' && r.status === 'open').length,
      shopsLive: store.places.filter((p) => p.ownerId !== null).length,
      totalUsers: store.users.length,
      bannedUsers: store.users.filter((u) => u.status === 'banned').length,
    },
    latestAuditLog: store.auditLog.slice(0, 8),
  });
}

/**
 * List merchant / upgrade applications.
 * GET /api/admin/applications.php?kind=new|renewal → Application[]
 */
export async function getApplications({ kind = 'new' } = {}) {
  if (!USE_MOCK) return request('admin/applications.php', { query: { kind } });
  const store = getStore();
  const list = store.applications.filter((a) => (kind ? a.kind === kind : true));
  return mockResponse(list);
}

/**
 * Approve merchant / upgrade application.
 * POST /api/admin/applications.php { id, action: 'approve' } → Application
 */
export async function approveApplication(id) {
  if (!USE_MOCK) return request('admin/applications.php', { method: 'POST', body: { id, action: 'approve' } });
  const store = getStore();
  const app = store.applications.find((a) => a.id === Number(id));
  if (!app) return mockError('Application not found', 404);
  app.status = 'approved';
  logAudit('approve_application', 'application', app.shopName);
  saveStore(store);
  return mockResponse(app);
}

/**
 * Reject merchant / upgrade application.
 * POST /api/admin/applications.php { id, action: 'reject', reason } → Application
 */
export async function rejectApplication(id, reason = '') {
  if (!USE_MOCK) return request('admin/applications.php', { method: 'POST', body: { id, action: 'reject', reason } });
  const store = getStore();
  const app = store.applications.find((a) => a.id === Number(id));
  if (!app) return mockError('Application not found', 404);
  app.status = 'rejected';
  app.rejectReason = reason;
  logAudit('reject_application', 'application', `${app.shopName} (${reason})`);
  saveStore(store);
  return mockResponse(app);
}

/**
 * List places for administration.
 * GET /api/admin/places.php?owned=1&q=...&status=... → Place[]
 */
export async function getAdminPlaces({ owned, q, status } = {}) {
  if (!USE_MOCK) return request('admin/places.php', { query: { owned, q, status } });
  const store = getStore();
  let list = [...store.places];
  if (owned === true || owned === 1) list = list.filter((p) => p.ownerId !== null);
  if (owned === false || owned === 0) list = list.filter((p) => p.ownerId === null);
  if (q) {
    const term = q.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(term) || (p.address && p.address.toLowerCase().includes(term)));
  }
  return mockResponse(list);
}

/**
 * Update place details.
 * PUT /api/admin/places.php?id=... { ...fields } → Place
 */
export async function updatePlace(id, fields) {
  if (!USE_MOCK) return request('admin/places.php', { method: 'PUT', query: { id }, body: fields });
  const store = getStore();
  const idx = store.places.findIndex((p) => p.id === Number(id));
  if (idx === -1) return mockError('Place not found', 404);
  store.places[idx] = { ...store.places[idx], ...fields };
  logAudit('update_place', 'place', store.places[idx].name);
  saveStore(store);
  return mockResponse(store.places[idx]);
}

/**
 * Hide / Unhide place.
 * POST /api/admin/places.php { id, hidden } → Place
 */
export async function setPlaceHidden(id, hidden) {
  return updatePlace(id, { isHidden: Boolean(hidden) });
}

/**
 * Create public place without owner.
 * POST /api/admin/places.php { name, categoryId, address, description, lat, lng } → Place
 */
export async function createPublicPlace(fields) {
  if (!USE_MOCK) return request('admin/places.php', { method: 'POST', body: fields });
  const store = getStore();
  const place = {
    id: Date.now(),
    ownerId: null,
    name: fields.name.trim(),
    categoryId: Number(fields.categoryId) || 4,
    address: fields.address?.trim() || '',
    description: fields.description?.trim() || '',
    lat: Number(fields.lat) || 16.8,
    lng: Number(fields.lng) || 96.15,
    rating: { average: 5.0, count: 1 },
    photos: [],
    createdAt: new Date().toISOString(),
  };
  store.places.unshift(place);
  logAudit('add_public_place', 'place', place.name);
  saveStore(store);
  return mockResponse(place);
}

/**
 * Update Category names & group (DB: name_en, name_my, group_name).
 * PUT /api/admin/categories.php?id=... { nameEn, nameMy, groupName } → Category
 */
export async function updateCategory(id, { nameEn, nameMy, groupName, name_en, name_my, group_name }) {
  const en = nameEn || name_en;
  const my = nameMy || name_my;
  const group = groupName || group_name;
  if (!USE_MOCK) return request('admin/categories.php', { method: 'PUT', query: { id }, body: { nameEn: en, nameMy: my, groupName: group, name_en: en, name_my: my, group_name: group } });
  const store = getStore();
  const cat = store.categories.find((c) => c.id === Number(id));
  if (!cat) return mockError('Category not found', 404);
  if (en) { cat.nameEn = en; cat.name_en = en; }
  if (my) { cat.nameMy = my; cat.name_my = my; }
  if (group) { cat.groupName = group; cat.group_name = group; }
  logAudit('update_category', 'category', `${cat.nameEn || cat.name_en} / ${cat.nameMy || cat.name_my}`);
  saveStore(store);
  return mockResponse(cat);
}

/**
 * Get reports and appeals.
 * GET /api/admin/reports.php?kind=report|appeal → Report[]
 */
export async function getReports({ kind = 'report' } = {}) {
  if (!USE_MOCK) return request('admin/reports.php', { query: { kind } });
  const store = getStore();
  const list = store.reports.filter((r) => (kind ? r.kind === kind : true));
  return mockResponse(list);
}

/**
 * Resolve report or appeal (DB status: resolved | dismissed).
 * POST /api/admin/reports.php { id, action, note } → Report
 */
export async function resolveReport(id, { action, note = '' }) {
  const newStatus = action === 'dismiss' ? 'dismissed' : 'resolved';
  if (!USE_MOCK) return request('admin/reports.php', { method: 'POST', body: { id, action, status: newStatus, note } });
  const store = getStore();
  const rep = store.reports.find((r) => r.id === Number(id));
  if (!rep) return mockError('Report not found', 404);
  rep.status = newStatus;
  rep.resolution = { action, note, status: newStatus, resolvedAt: new Date().toISOString() };
  logAudit(`resolve_${rep.kind}`, 'report', `${rep.targetTitle} (${action})`);
  saveStore(store);
  return mockResponse(rep);
}

/**
 * Get users list.
 * GET /api/admin/users.php?q=...&status=... → User[]
 */
export async function getUsers({ q, status } = {}) {
  if (!USE_MOCK) return request('admin/users.php', { query: { q, status } });
  const store = getStore();
  let list = [...store.users];
  if (status) list = list.filter((u) => u.status === status);
  if (q) {
    const term = q.toLowerCase();
    list = list.filter((u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }
  return mockResponse(list);
}

/**
 * Ban or unban a user. (DB status: active | suspended)
 * POST /api/admin/users.php { id, banned } → User
 */
export async function setUserBanned(id, banned) {
  if (!USE_MOCK) return request('admin/users.php', { method: 'POST', body: { id, banned, status: banned ? 'suspended' : 'active' } });
  const store = getStore();
  const user = store.users.find((u) => u.id === Number(id));
  if (!user) return mockError('User not found', 404);
  user.status = banned ? 'suspended' : 'active';
  logAudit(banned ? 'ban_user' : 'unban_user', 'user', `${user.name} (${user.email})`);
  saveStore(store);
  return mockResponse(user);
}

/**
 * Get audit log entries.
 * GET /api/admin/audit-log.php?action=... → AuditEntry[]
 */
export async function getAuditLog({ action } = {}) {
  if (!USE_MOCK) return request('admin/audit-log.php', { query: { action } });
  const store = getStore();
  let list = [...store.auditLog];
  if (action) list = list.filter((e) => e.action === action);
  return mockResponse(list);
}
