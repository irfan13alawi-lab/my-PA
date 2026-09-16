'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.env.IRFAN_DATA_DIR || path.join(__dirname, 'data'));
const DB_PATH = path.join(DATA_DIR, 'state.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PORT = Number(process.env.PORT || 18086);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY = 5 * 1024 * 1024;

const DEFAULT_STATE = {
  version: 1,
  updatedAt: null,
  tasks: [],
  goals: [],
  habits: [],
  journalEntries: [],
  bookmarks: [],
  opportunities: [],
  opportunityPipeline: {},
  habitLogs: {},
  warChat: [],
  settings: {}
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function ensureStorage() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_STATE, null, 2) + '\n', 'utf8');
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function normalizeState(input) {
  const source = input && typeof input === 'object' ? input : {};
  const state = { ...clone(DEFAULT_STATE), ...source };
  for (const key of ['tasks', 'goals', 'habits', 'journalEntries', 'bookmarks', 'opportunities', 'warChat']) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  if (!state.opportunityPipeline || typeof state.opportunityPipeline !== 'object' || Array.isArray(state.opportunityPipeline)) state.opportunityPipeline = {};
  if (!state.habitLogs || typeof state.habitLogs !== 'object' || Array.isArray(state.habitLogs)) state.habitLogs = {};
  if (!state.settings || typeof state.settings !== 'object' || Array.isArray(state.settings)) state.settings = {};
  state.version = 1;
  return state;
}

function readState() {
  ensureStorage();
  try { return normalizeState(JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))); }
  catch (error) { console.error('[irfan-os] state read failed:', error.message); return clone(DEFAULT_STATE); }
}

function backupCurrent(reason) {
  if (!fs.existsSync(DB_PATH)) return null;
  const stamp = new Date().toISOString().replace(/[.:]/g, '-');
  const destination = path.join(BACKUP_DIR, `${stamp}-${reason || 'write'}.json`);
  try {
    fs.copyFileSync(DB_PATH, destination);
    fs.readdirSync(BACKUP_DIR).filter((name) => name.endsWith('.json')).sort().reverse().slice(30)
      .forEach((name) => fs.rmSync(path.join(BACKUP_DIR, name), { force: true }));
    return destination;
  } catch (error) { console.error('[irfan-os] backup failed:', error.message); return null; }
}

function writeState(input, reason) {
  ensureStorage();
  backupCurrent(reason);
  const state = normalizeState({ ...input, updatedAt: new Date().toISOString() });
  const tempPath = `${DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, DB_PATH);
  return state;
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

function isAuthorized(req) {
  const username = process.env.IRFAN_AUTH_USER;
  const password = process.env.IRFAN_AUTH_PASSWORD;
  if (!username || !password || req.url === '/api/health') return true;
  const value = String(req.headers.authorization || '');
  if (!value.startsWith('Basic ')) return false;
  try { return Buffer.from(value.slice(6), 'base64').toString('utf8') === `${username}:${password}`; }
  catch (_) { return false; }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY) { reject(new Error('request body too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (_) { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function idFromPath(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;
  const value = decodeURIComponent(pathname.slice(prefix.length)).replace(/^\/+/, '');
  return value || null;
}

function taskPayload(body) {
  const source = body && typeof body === 'object' ? body : {};
  const title = String(source.title || '').trim();
  if (!title) throw new Error('title is required');
  return {
    id: String(source.id || `task-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`),
    title,
    category: String(source.category || 'Personal'),
    agent: String(source.agent || 'OWNER'),
    priority: String(source.priority || 'MED'),
    status: ['todo', 'in_progress', 'done'].includes(source.status) ? source.status : 'todo',
    dueDate: source.dueDate ? String(source.dueDate) : null,
    reminderAt: source.reminderAt ? String(source.reminderAt) : null,
    recurrence: source.recurrence ? String(source.recurrence) : 'none',
    completedAt: source.completedAt ? String(source.completedAt) : null,
    notes: source.notes ? String(source.notes) : '',
    createdAt: source.createdAt ? String(source.createdAt) : new Date().toISOString()
  };
}

function safeStaticPath(pathname) {
  let relative = decodeURIComponent(pathname || '/');
  if (relative === '/' || relative.endsWith('/')) relative += 'IRFAN_OS_Dashboard.html';
  const candidate = path.resolve(ROOT, `.${relative}`);
  if (candidate !== ROOT && !candidate.startsWith(`${ROOT}${path.sep}`)) return null;
  return candidate;
}

async function aiReply(prompt, context) {
  const key = process.env.IRFAN_AI_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!key) return { provider: 'local-fallback', text: `Rencana lokal: fokus pada 1 task paling mendesak, pecah menjadi langkah kecil, lalu tetapkan deadline yang realistis. Konteks diterima: ${String(prompt || '').slice(0, 180)}` };
  const isOpenRouter = Boolean(process.env.OPENROUTER_API_KEY) && !process.env.OPENAI_API_KEY && !process.env.IRFAN_AI_API_KEY;
  const baseUrl = (process.env.IRFAN_AI_BASE_URL || (isOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1')).replace(/\/$/, '');
  const model = process.env.IRFAN_AI_MODEL || (isOpenRouter ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...(isOpenRouter ? { 'HTTP-Referer': 'http://localhost:18086', 'X-Title': 'IRFAN OS' } : {}) },
    body: JSON.stringify({ model, temperature: 0.2, messages: [
      { role: 'system', content: 'Kamu adalah ATLAS, AI planner untuk IRFAN OS. Beri jawaban singkat dalam Bahasa Indonesia, prioritaskan tindakan konkret, risiko, dan deadline. Jangan mengklaim sudah melakukan aksi yang belum dilakukan.' },
      { role: 'user', content: `Permintaan owner: ${String(prompt || '').slice(0, 4000)}\nKonteks dashboard: ${JSON.stringify(context || {}).slice(0, 7000)}` }
    ] })
  });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
  const result = await response.json();
  const text = result && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
  return { provider: isOpenRouter ? 'openrouter' : 'openai', text: String(text || 'AI tidak mengembalikan jawaban.') };
}

async function handleApi(req, res, pathname) {
  const state = readState();
  if (req.method === 'GET' && pathname === '/api/health') return sendJson(res, 200, { ok: true, service: 'irfan-os', storage: 'json', updatedAt: state.updatedAt, aiConfigured: Boolean(process.env.IRFAN_AI_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY) });
  if (req.method === 'GET' && pathname === '/api/state') return sendJson(res, 200, state);
  if (req.method === 'GET' && pathname === '/api/tasks') return sendJson(res, 200, state.tasks);
  if (req.method === 'GET' && pathname === '/api/opportunities') return sendJson(res, 200, state.opportunities);
  if (req.method === 'GET' && pathname === '/api/export') return sendJson(res, 200, state, { 'Content-Disposition': 'attachment; filename="irfan-os-backup.json"' });
  if (req.method === 'POST' && pathname === '/api/backup') return sendJson(res, 200, { ok: Boolean(backupCurrent('manual')) });
  if (req.method === 'PUT' && pathname === '/api/state') {
    const body = await parseJsonBody(req);
    return sendJson(res, 200, writeState(body.state || body, 'sync'));
  }

  if (pathname === '/api/tasks' && req.method === 'POST') {
    const task = taskPayload(await parseJsonBody(req));
    if (state.tasks.some((item) => item.id === task.id)) return sendJson(res, 409, { error: 'task id already exists' });
    state.tasks.push(task);
    return sendJson(res, 201, writeState(state, 'task-create'));
  }
  const taskId = idFromPath(pathname, '/api/tasks/');
  if (taskId && req.method === 'PATCH') {
    const body = await parseJsonBody(req);
    const index = state.tasks.findIndex((task) => task.id === taskId);
    if (index < 0) return sendJson(res, 404, { error: 'task not found' });
    const current = state.tasks[index];
    const next = { ...current, ...body, id: current.id };
    next.title = String(next.title || '').trim();
    if (!next.title) return sendJson(res, 400, { error: 'title is required' });
    if (next.status === 'done' && current.status !== 'done') next.completedAt = new Date().toISOString();
    if (next.status !== 'done') next.completedAt = null;
    state.tasks[index] = next;
    return sendJson(res, 200, writeState(state, 'task-update'));
  }
  if (taskId && req.method === 'DELETE') {
    const before = state.tasks.length;
    state.tasks = state.tasks.filter((task) => task.id !== taskId);
    if (before === state.tasks.length) return sendJson(res, 404, { error: 'task not found' });
    return sendJson(res, 200, writeState(state, 'task-delete'));
  }
  if (req.method === 'POST' && pathname === '/api/tasks/bulk') {
    const body = await parseJsonBody(req);
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    if (body.action === 'complete') state.tasks.forEach((task) => { if (ids.includes(task.id)) { task.status = 'done'; task.completedAt = new Date().toISOString(); } });
    else if (body.action === 'delete') state.tasks = state.tasks.filter((task) => !ids.includes(task.id));
    else if (body.action === 'move' && ['todo', 'in_progress', 'done'].includes(body.status)) state.tasks.forEach((task) => { if (ids.includes(task.id)) task.status = body.status; });
    else return sendJson(res, 400, { error: 'unsupported bulk action' });
    return sendJson(res, 200, writeState(state, 'task-bulk'));
  }
  if (req.method === 'PUT' && pathname === '/api/opportunities') {
    const body = await parseJsonBody(req);
    state.opportunities = Array.isArray(body.opportunities || body) ? (body.opportunities || body) : state.opportunities;
    if (body.opportunityPipeline && typeof body.opportunityPipeline === 'object') state.opportunityPipeline = body.opportunityPipeline;
    if (Array.isArray(body.bookmarks)) state.bookmarks = body.bookmarks;
    return sendJson(res, 200, writeState(state, 'opportunities-sync'));
  }
  if (req.method === 'POST' && pathname === '/api/ai/warroom') {
    const body = await parseJsonBody(req);
    try { return sendJson(res, 200, await aiReply(body.prompt, body.context)); }
    catch (error) { console.error('[irfan-os] AI request failed:', error.message); return sendJson(res, 502, { error: 'AI provider unavailable', detail: error.message }); }
  }
  return sendJson(res, 404, { error: 'API route not found' });
}

async function handleRequest(req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  if (!isAuthorized(req)) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="IRFAN OS"' }); return res.end('Authentication required'); }
  if (pathname.startsWith('/api/')) {
    try { return await handleApi(req, res, pathname); }
    catch (error) { return sendJson(res, 400, { error: error.message }); }
  }
  const filePath = safeStaticPath(pathname);
  if (!filePath) return sendText(res, 400, 'Bad request');
  fs.stat(filePath, (error, info) => {
    if (error || !info.isFile()) return sendText(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(filePath).pipe(res);
  });
}

ensureStorage();
const server = http.createServer((req, res) => { handleRequest(req, res).catch((error) => { console.error(error); sendJson(res, 500, { error: 'internal server error' }); }); });
server.listen(PORT, HOST, () => console.log(`[irfan-os] listening on http://${HOST}:${PORT}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
