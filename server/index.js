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
    if (!email || !body.password) return sendJson(res, { error: 'Email and password are required' }, 400);
    const { rows: existing } = await pool.query('SELECT id FROM app_users WHERE email = $1 LIMIT 1', [email]);
    if (existing[0]) return sendJson(res, { error: 'Email is already registered' }, 409);
    const first = await isFirstUser();
    const id = crypto.randomUUID();
    const role = first ? 'admin' : 'user';
    await pool.query(
      'INSERT INTO app_users (id, email, full_name, role, app_role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, email, body.full_name || email.split('@')[0], role, first ? 'OWNER' : 'VIEWER', hashPassword(body.password)]
    );
    return sendJson(res, { success: true, message: 'Registered' });
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
    const { rows: ownerRows } = await pool.query('SELECT id FROM app_users ORDER BY created_date ASC LIMIT 1');
    const isOriginalOwner = ownerRows[0]?.id === id;
    if (isOriginalOwner && (body.role === 'user' || (body.appRole && body.appRole !== 'OWNER') || body.isActive === false)) {
      return sendJson(res, { error: 'Original owner permissions cannot be downgraded or disabled' }, 400);
    }
    const newPassword = body.password === undefined || body.password === '' ? null : String(body.password);
    if (newPassword && newPassword.length < 6) return sendJson(res, { error: 'Password must be at least 6 characters' }, 400);
    const newPasswordHash = newPassword ? hashPassword(newPassword) : null;
    await pool.query(
      `UPDATE app_users SET
        full_name = COALESCE($2, full_name), role = COALESCE($3, role), app_role = COALESCE($4, app_role),
        job_title = COALESCE($5, job_title), department = COALESCE($6, department), phone = COALESCE($7, phone),
        is_active = COALESCE($8, is_active), allowed_modules = COALESCE($9::jsonb, allowed_modules),
        module_permissions = COALESCE($10::jsonb, module_permissions), password_hash = COALESCE($11, password_hash),
        token_version = CASE WHEN $11 IS NULL THEN token_version ELSE token_version + 1 END, updated_date = now()
      WHERE id = $1`,
      [id, body.full_name, body.role, body.appRole, body.jobTitle, body.department, body.phone,
        body.isActive,
        body.allowedModules === undefined ? null : JSON.stringify(body.allowedModules),
        body.modulePermissions === undefined ? null : JSON.stringify(body.modulePermissions),
        newPasswordHash]
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

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = url.pathname;
  try {
    if (route.startsWith('/api/auth/')) return await handleAuth(req, res, route);
    if (route.startsWith('/api/users/')) return await handleUsers(req, res, route);
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