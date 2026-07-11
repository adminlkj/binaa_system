import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initDb, pool } from './db.js';
import { hashPassword, verifyPassword, signToken, requireUser, isFirstUser } from './auth.js';
import { bulkCreateEntity, bulkUpdateEntity, createEntity, deleteEntity, deleteManyEntity, getEntity, listEntity, loadSchema, updateEntity, updateManyEntity } from './entities.js';
import { runStandaloneFunction } from './functionRunner.js';

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(process.cwd(), 'dist');
const USER_PUBLIC_FIELDS = `id, email, full_name, role, app_role AS "appRole", job_title AS "jobTitle", department, phone, is_active AS "isActive", allowed_modules AS "allowedModules", module_permissions AS "modulePermissions", token_version AS "tokenVersion", created_date, updated_date`;
const SYSTEM_OWNER_EMAIL = 'fysl71443@gmail.com';
const SYSTEM_OWNER_PASSWORD = 'faisal.11223344';

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = path.normalize(requested).replace(/^\.+/, '');

  // Serve uploaded files from /uploads/*
  if (safePath.startsWith('/uploads/')) {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, safePath.replace(/^\/uploads\//, ''));
    if (!filePath.startsWith(uploadsDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'File not found' }));
    }
    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.pdf': 'application/pdf', '.webp': 'image/webp', '.ico': 'image/x-icon' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    return fs.createReadStream(filePath).pipe(res);
  }

  let filePath = path.join(DIST_DIR, safePath);
  if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }
  const ext = path.extname(filePath).toLowerCase();
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

async function handleAuth(req, res, route) {
  const body = await readBody(req);

  if (route === '/api/auth/register' && req.method === 'POST') {
    const email = String(body.email || '').toLowerCase().trim();
    const fullName = String(body.full_name || '').trim() || email.split('@')[0];
    if (!email || !body.password) return sendJson(res, { error: 'البريد الإلكتروني وكلمة المرور مطلوبة' }, 400);
    if (String(body.password).length < 6) return sendJson(res, { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, 400);
    const { rows: existing } = await pool.query('SELECT id FROM app_users WHERE email = $1 LIMIT 1', [email]);
    if (existing[0]) return sendJson(res, { error: 'هذا البريد مسجل بالفعل' }, 409);
    const { rows: pending } = await pool.query("SELECT id FROM registration_requests WHERE email = $1 AND status = 'PENDING' LIMIT 1", [email]);
    if (pending[0]) return sendJson(res, { error: 'يوجد طلب تسجيل قيد المراجعة لهذا البريد' }, 409);
    await pool.query(
      'INSERT INTO registration_requests (id, email, full_name, password_hash) VALUES ($1, $2, $3, $4)',
      [crypto.randomUUID(), email, fullName, hashPassword(body.password)]
    );
    return sendJson(res, { success: true, status: 'PENDING', message: 'تم إرسال طلب التسجيل للمالك لاعتماده' });
  }

  if (route === '/api/auth/verify-otp' && req.method === 'POST') {
    const email = String(body.email || '').toLowerCase().trim();
    const { rows } = await pool.query(`SELECT ${USER_PUBLIC_FIELDS} FROM app_users WHERE email = $1`, [email]);
    if (!rows[0]) return sendJson(res, { error: 'User not found' }, 404);
    if (rows[0].isActive === false) return sendJson(res, { error: 'Account is inactive' }, 403);
    return sendJson(res, { access_token: signToken(rows[0]), user: rows[0] });
  }

  if (route === '/api/auth/login' && req.method === 'POST') {
    const email = String(body.email || '').toLowerCase().trim();
    const { rows } = await pool.query('SELECT * FROM app_users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !verifyPassword(body.password || '', user.password_hash)) return sendJson(res, { error: 'Invalid email or password' }, 401);
    if (user.is_active === false) return sendJson(res, { error: 'Account is inactive' }, 403);
    const { rows: publicRows } = await pool.query(`SELECT ${USER_PUBLIC_FIELDS} FROM app_users WHERE id = $1`, [user.id]);
    return sendJson(res, { access_token: signToken(publicRows[0]), user: publicRows[0] });
  }

  if (route === '/api/auth/me' && req.method === 'GET') {
    const user = await requireUser(req);
    return sendJson(res, user);
  }

  if (route === '/api/auth/me' && req.method === 'PATCH') {
    const user = await requireUser(req);
    const allowed = { full_name: body.full_name };
    await pool.query('UPDATE app_users SET full_name = COALESCE($2, full_name), updated_date = now() WHERE id = $1', [user.id, allowed.full_name]);
    const { rows } = await pool.query(`SELECT ${USER_PUBLIC_FIELDS} FROM app_users WHERE id = $1`, [user.id]);
    return sendJson(res, rows[0]);
  }

  if (route === '/api/auth/reset-request' && req.method === 'POST') return sendJson(res, { success: true });
  if (route === '/api/auth/reset' && req.method === 'POST') return sendJson(res, { success: true });
  if (route === '/api/auth/resend-otp' && req.method === 'POST') return sendJson(res, { success: true });

  return sendJson(res, { error: 'Not found' }, 404);
}

async function handleUsers(req, res, route) {
  const user = await requireUser(req);
  if (user.role !== 'admin') return sendJson(res, { error: 'Forbidden' }, 403);
  const body = await readBody(req);

  if (route === '/api/users/invite' && req.method === 'POST') {
    const email = String(body.email || '').toLowerCase().trim();
    if (!email) return sendJson(res, { error: 'Email is required' }, 400);
    if (email === String(user.email || '').toLowerCase().trim()) {
      return sendJson(res, { error: 'Cannot invite the currently signed-in email' }, 409);
    }
    const { rows: existing } = await pool.query('SELECT id FROM app_users WHERE email = $1 LIMIT 1', [email]);
    if (existing[0]) return sendJson(res, { error: 'A user with this email already exists' }, 409);
    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const id = crypto.randomUUID();
    const appRole = body.appRole || (body.role === 'admin' ? 'OWNER' : 'VIEWER');
    const role = appRole === 'OWNER' || body.role === 'admin' ? 'admin' : 'user';
    await pool.query(
      'INSERT INTO app_users (id, email, full_name, role, app_role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, email, email.split('@')[0], role, appRole, hashPassword(tempPassword)]
    );
    return sendJson(res, { success: true, tempPassword, email });
  }

  if (route === '/api/users/registration-requests/list' && req.method === 'POST') {
    const { rows } = await pool.query(`SELECT id, email, full_name AS "fullName", status, requested_date AS "requestedDate" FROM registration_requests WHERE status = 'PENDING' ORDER BY requested_date ASC`);
    return sendJson(res, rows);
  }

  if (route === '/api/users/registration-requests/approve' && req.method === 'POST') {
    const requestId = body.id;
    const appRole = body.appRole || 'VIEWER';
    const role = appRole === 'OWNER' ? 'admin' : 'user';
    const allowedModules = Array.isArray(body.allowedModules) ? body.allowedModules : [];
    const modulePermissions = body.modulePermissions && typeof body.modulePermissions === 'object' ? body.modulePermissions : {};
    const { rows } = await pool.query("SELECT * FROM registration_requests WHERE id = $1 AND status = 'PENDING'", [requestId]);
    const request = rows[0];
    if (!request) return sendJson(res, { error: 'طلب التسجيل غير موجود أو تمت مراجعته' }, 404);
    const { rows: existing } = await pool.query('SELECT id FROM app_users WHERE email = $1 LIMIT 1', [request.email]);
    if (existing[0]) return sendJson(res, { error: 'يوجد مستخدم بهذا البريد بالفعل' }, 409);
    const newUserId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO app_users (id, email, full_name, role, app_role, password_hash, is_active, allowed_modules, module_permissions)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7::jsonb, $8::jsonb)`,
      [newUserId, request.email, request.full_name, role, appRole, request.password_hash, JSON.stringify(allowedModules), JSON.stringify(modulePermissions)]
    );
    await pool.query(
      `UPDATE registration_requests SET status = 'APPROVED', app_role = $2, allowed_modules = $3::jsonb, module_permissions = $4::jsonb, reviewed_by_id = $5, reviewed_date = now() WHERE id = $1`,
      [requestId, appRole, JSON.stringify(allowedModules), JSON.stringify(modulePermissions), user.id]
    );
    const { rows: publicRows } = await pool.query(`SELECT ${USER_PUBLIC_FIELDS} FROM app_users WHERE id = $1`, [newUserId]);
    return sendJson(res, { success: true, user: publicRows[0] });
  }

  if (route === '/api/users/registration-requests/reject' && req.method === 'POST') {
    await pool.query("UPDATE registration_requests SET status = 'REJECTED', reviewed_by_id = $2, reviewed_date = now() WHERE id = $1 AND status = 'PENDING'", [body.id, user.id]);
    return sendJson(res, { success: true });
  }

  return sendJson(res, { error: 'Not found' }, 404);
}

async function handleUserEntity(req, res, action, id, body, user) {
  if (user.role !== 'admin' && action !== 'get') return sendJson(res, { error: 'Forbidden' }, 403);
  if ((action === 'list' || action === 'filter') && req.method === 'POST') {
    const { rows } = await pool.query(`SELECT ${USER_PUBLIC_FIELDS} FROM app_users ORDER BY created_date DESC`);
    return sendJson(res, rows);
  }
  if (action === 'get' && req.method === 'GET') {
    const targetId = id || user.id;
    if (targetId !== user.id && user.role !== 'admin') return sendJson(res, { error: 'Forbidden' }, 403);
    const { rows } = await pool.query(`SELECT ${USER_PUBLIC_FIELDS} FROM app_users WHERE id = $1`, [targetId]);
    return sendJson(res, rows[0] || null);
  }
  if (action === 'update' && req.method === 'PATCH') {
    const { rows: protectedRows } = await pool.query('SELECT id, email FROM app_users WHERE id = $1 OR email = $2 ORDER BY CASE WHEN email = $2 THEN 0 ELSE 1 END LIMIT 1', [id, SYSTEM_OWNER_EMAIL]);
    const isProtectedOwner = protectedRows[0]?.id === id && protectedRows[0]?.email === SYSTEM_OWNER_EMAIL;
    if (isProtectedOwner && (body.role === 'user' || (body.appRole && body.appRole !== 'OWNER') || body.isActive === false)) {
      return sendJson(res, { error: 'System owner permissions cannot be downgraded or disabled' }, 400);
    }
    const newPassword = body.password === undefined || body.password === '' ? null : String(body.password);
    if (isProtectedOwner && newPassword && newPassword !== SYSTEM_OWNER_PASSWORD) return sendJson(res, { error: 'System owner password is protected' }, 400);
    if (newPassword && newPassword.length < 6) return sendJson(res, { error: 'Password must be at least 6 characters' }, 400);
    const newPasswordHash = newPassword ? hashPassword(newPassword) : null;
    await pool.query(
      `UPDATE app_users SET
        full_name = COALESCE($2, full_name), role = CASE WHEN email = $12 THEN 'admin' ELSE COALESCE($3, role) END,
        app_role = CASE WHEN email = $12 THEN 'OWNER' ELSE COALESCE($4, app_role) END,
        job_title = COALESCE($5, job_title), department = COALESCE($6, department), phone = COALESCE($7, phone),
        is_active = CASE WHEN email = $12 THEN true ELSE COALESCE($8, is_active) END,
        allowed_modules = CASE WHEN email = $12 THEN '[]'::jsonb ELSE COALESCE($9::jsonb, allowed_modules) END,
        module_permissions = CASE WHEN email = $12 THEN '{}'::jsonb ELSE COALESCE($10::jsonb, module_permissions) END,
        password_hash = COALESCE($11, password_hash),
        token_version = CASE WHEN $11 IS NULL THEN token_version ELSE token_version + 1 END, updated_date = now()
      WHERE id = $1`,
      [id, body.full_name, body.role, body.appRole, body.jobTitle, body.department, body.phone,
        body.isActive,
        body.allowedModules === undefined ? null : JSON.stringify(body.allowedModules),
        body.modulePermissions === undefined ? null : JSON.stringify(body.modulePermissions),
        newPasswordHash,
        SYSTEM_OWNER_EMAIL]
    );
    const { rows } = await pool.query(`SELECT ${USER_PUBLIC_FIELDS} FROM app_users WHERE id = $1`, [id]);
    return sendJson(res, rows[0] || null);
  }
  if (action === 'delete' && req.method === 'DELETE') {
    if (id === user.id) return sendJson(res, { error: 'Cannot delete yourself' }, 400);
    await pool.query('DELETE FROM app_users WHERE id = $1', [id]);
    return sendJson(res, { success: true });
  }
  if (action === 'schema' && req.method === 'GET') return sendJson(res, { name: 'User', properties: { full_name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' }, appRole: { type: 'string' }, jobTitle: { type: 'string' }, department: { type: 'string' }, phone: { type: 'string' }, isActive: { type: 'boolean' }, allowedModules: { type: 'array' }, modulePermissions: { type: 'object' }, password: { type: 'string' } } });
  return sendJson(res, { error: 'Not found' }, 404);
}

async function handleEntity(req, res, parts) {
  const user = await requireUser(req);
  const entityName = parts[3];
  const action = parts[4];
  const id = parts[5];
  const body = req.method === 'GET' ? {} : await readBody(req);

  if (entityName === 'User') return handleUserEntity(req, res, action, id, body, user);

  if (action === 'schema' && req.method === 'GET') return sendJson(res, loadSchema(entityName) || {});
  if (action === 'list' && req.method === 'POST') return sendJson(res, await listEntity(entityName, body));
  if (action === 'filter' && req.method === 'POST') return sendJson(res, await listEntity(entityName, body));
  if (action === 'get' && req.method === 'GET') return sendJson(res, await getEntity(entityName, id));
  if (action === 'create' && req.method === 'POST') return sendJson(res, await createEntity(entityName, body, user));
  if (action === 'bulk-create' && req.method === 'POST') return sendJson(res, await bulkCreateEntity(entityName, body.items || [], user));
  if (action === 'update' && req.method === 'PATCH') return sendJson(res, await updateEntity(entityName, id, body));
  if (action === 'bulk-update' && req.method === 'PATCH') return sendJson(res, await bulkUpdateEntity(entityName, body.items || []));
  if (action === 'update-many' && req.method === 'PATCH') return sendJson(res, await updateManyEntity(entityName, body.query || {}, body.update || {}));
  if (action === 'delete' && req.method === 'DELETE') return sendJson(res, await deleteEntity(entityName, id));
  if (action === 'delete-many' && req.method === 'POST') return sendJson(res, await deleteManyEntity(entityName, body.query || {}));

  return sendJson(res, { error: 'Not found' }, 404);
}

async function handleUpload(req, res) {
  const user = await requireUser(req);
  const boundary = (req.headers['content-type'] || '').split('boundary=')[1];
  if (!boundary) return sendJson(res, { error: 'Invalid multipart request' }, 400);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = 0;
  while (true) {
    const bStart = buffer.indexOf(boundaryBuffer, start);
    if (bStart === -1) break;
    const nextStart = buffer.indexOf(boundaryBuffer, bStart + boundaryBuffer.length);
    if (nextStart === -1) break;
    parts.push(buffer.slice(bStart + boundaryBuffer.length, nextStart));
    start = nextStart;
  }

  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  let savedFile = null;
  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const header = part.slice(0, headerEnd).toString('utf8');
    const fileMatch = header.match(/filename="([^"]+)"/);
    if (!fileMatch) continue;
    const originalName = fileMatch[1];
    const body = part.slice(headerEnd + 4, part.length - 2); // remove trailing \r\n
    const ext = path.extname(originalName).toLowerCase();
    const safeExt = /^[\w.\-]+$/.test(ext) ? ext : '';
    const fileName = `${crypto.randomUUID()}${safeExt}`;
    fs.writeFileSync(path.join(uploadsDir, fileName), body);
    savedFile = `/uploads/${fileName}`;
    break;
  }

  if (!savedFile) return sendJson(res, { error: 'No file part found' }, 400);
  return sendJson(res, { file_url: savedFile, url: savedFile });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = url.pathname;
  try {
    if (route.startsWith('/api/auth/')) return await handleAuth(req, res, route);
    if (route.startsWith('/api/users/')) return await handleUsers(req, res, route);
    if (route === '/api/upload' && req.method === 'POST') return await handleUpload(req, res);
    if (route.startsWith('/api/entities/')) return await handleEntity(req, res, route.split('/'));
    if (route.startsWith('/api/functions/') && req.method === 'POST') {
      const user = await requireUser(req);
      const functionName = route.split('/')[3];
      const payload = await readBody(req);
      try {
        return sendJson(res, await runStandaloneFunction(functionName, payload, user));
      } catch (error) {
        return sendJson(res, { success: false, error: error.message || 'فشل تنفيذ العملية' });
      }
    }
    return sendJson(res, { error: 'Not found' }, 404);
  } catch (error) {
    return sendJson(res, { error: error.message || 'Server error' }, error.status || 500);
  }
}

await initDb();

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return handleApi(req, res);
  return serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});