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
    const first = await isFirstUser();
    const id = crypto.randomUUID();
    const role = first ? 'admin' : 'user';
    await pool.query(
      'INSERT INTO app_users (id, email, full_name, role, password_hash) VALUES ($1, $2, $3, $4, $5)',
      [id, email, body.full_name || email.split('@')[0], role, hashPassword(body.password)]
    );
    return sendJson(res, { success: true, message: 'Registered' });
  }

  if (route === '/api/auth/verify-otp' && req.method === 'POST') {
    const email = String(body.email || '').toLowerCase().trim();
    const { rows } = await pool.query('SELECT id, email, full_name, role, created_date, updated_date FROM app_users WHERE email = $1', [email]);
    if (!rows[0]) return sendJson(res, { error: 'User not found' }, 404);
    return sendJson(res, { access_token: signToken(rows[0]), user: rows[0] });
  }

  if (route === '/api/auth/login' && req.method === 'POST') {
    const email = String(body.email || '').toLowerCase().trim();
    const { rows } = await pool.query('SELECT * FROM app_users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !verifyPassword(body.password || '', user.password_hash)) return sendJson(res, { error: 'Invalid email or password' }, 401);
    delete user.password_hash;
    return sendJson(res, { access_token: signToken(user), user });
  }

  if (route === '/api/auth/me' && req.method === 'GET') {
    const user = await requireUser(req);
    return sendJson(res, user);
  }

  if (route === '/api/auth/me' && req.method === 'PATCH') {
    const user = await requireUser(req);
    const allowed = { full_name: body.full_name };
    await pool.query('UPDATE app_users SET full_name = COALESCE($2, full_name), updated_date = now() WHERE id = $1', [user.id, allowed.full_name]);
    const { rows } = await pool.query('SELECT id, email, full_name, role, created_date, updated_date FROM app_users WHERE id = $1', [user.id]);
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
    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO app_users (id, email, full_name, role, password_hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING',
      [id, email, email.split('@')[0], body.role || 'user', hashPassword(tempPassword)]
    );
    return sendJson(res, { success: true, tempPassword });
  }

  return sendJson(res, { error: 'Not found' }, 404);
}

async function handleUserEntity(req, res, action, id, body, user) {
  if (user.role !== 'admin' && action !== 'get') return sendJson(res, { error: 'Forbidden' }, 403);
  if ((action === 'list' || action === 'filter') && req.method === 'POST') {
    const { rows } = await pool.query('SELECT id, email, full_name, role, created_date, updated_date FROM app_users ORDER BY created_date DESC');
    return sendJson(res, rows);
  }
  if (action === 'get' && req.method === 'GET') {
    const targetId = id || user.id;
    if (targetId !== user.id && user.role !== 'admin') return sendJson(res, { error: 'Forbidden' }, 403);
    const { rows } = await pool.query('SELECT id, email, full_name, role, created_date, updated_date FROM app_users WHERE id = $1', [targetId]);
    return sendJson(res, rows[0] || null);
  }
  if (action === 'update' && req.method === 'PATCH') {
    await pool.query('UPDATE app_users SET full_name = COALESCE($2, full_name), role = COALESCE($3, role), updated_date = now() WHERE id = $1', [id, body.full_name, body.role]);
    const { rows } = await pool.query('SELECT id, email, full_name, role, created_date, updated_date FROM app_users WHERE id = $1', [id]);
    return sendJson(res, rows[0] || null);
  }
  if (action === 'delete' && req.method === 'DELETE') {
    if (id === user.id) return sendJson(res, { error: 'Cannot delete yourself' }, 400);
    await pool.query('DELETE FROM app_users WHERE id = $1', [id]);
    return sendJson(res, { success: true });
  }
  if (action === 'schema' && req.method === 'GET') return sendJson(res, { name: 'User', properties: { full_name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' } } });
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