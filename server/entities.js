import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pool } from './db.js';

const schemaCache = new Map();

function stripJsonComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

export function loadSchema(entityName) {
  if (schemaCache.has(entityName)) return schemaCache.get(entityName);
  const filePath = path.join(process.cwd(), 'base44', 'entities', `${entityName}.jsonc`);
  if (!fs.existsSync(filePath)) return null;
  const parsed = JSON.parse(stripJsonComments(fs.readFileSync(filePath, 'utf8')));
  schemaCache.set(entityName, parsed);
  return parsed;
}

function publicRecord(row) {
  return {
    id: row.id,
    created_date: row.created_date,
    updated_date: row.updated_date,
    created_by_id: row.created_by_id,
    ...(row.data || {}),
  };
}

function getValue(record, field) {
  return field in record ? record[field] : record.data?.[field];
}

function matchesValue(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if ('$gte' in expected && !(actual >= expected.$gte)) return false;
    if ('$gt' in expected && !(actual > expected.$gt)) return false;
    if ('$lte' in expected && !(actual <= expected.$lte)) return false;
    if ('$lt' in expected && !(actual < expected.$lt)) return false;
    if ('$ne' in expected && !(actual !== expected.$ne)) return false;
    if ('$in' in expected && !expected.$in.includes(actual)) return false;
    return true;
  }
  return actual === expected;
}

function matchesQuery(record, query = {}) {
  if (!query || !Object.keys(query).length) return true;
  if (query.$or) return query.$or.some((item) => matchesQuery(record, item));
  return Object.entries(query).every(([field, expected]) => matchesValue(getValue(record, field), expected));
}

function sortRecords(records, sort) {
  if (!sort) return records;
  const sortField = typeof sort === 'string' ? sort.replace(/^-/, '') : Object.keys(sort)[0];
  const direction = typeof sort === 'string' ? (sort.startsWith('-') ? -1 : 1) : sort[sortField];
  return [...records].sort((a, b) => {
    const av = getValue(a, sortField);
    const bv = getValue(b, sortField);
    if (av === bv) return 0;
    return av > bv ? direction : -direction;
  });
}

export async function listEntity(entityName, { query = {}, sort = '-created_date', limit = 500 } = {}) {
  const { rows } = await pool.query('SELECT * FROM entity_records WHERE entity_name = $1', [entityName]);
  const records = rows.map(publicRecord).filter((record) => matchesQuery(record, query));
  return sortRecords(records, sort).slice(0, Number(limit || 500));
}

export async function getEntity(entityName, id) {
  const { rows } = await pool.query('SELECT * FROM entity_records WHERE entity_name = $1 AND id = $2', [entityName, id]);
  return rows[0] ? publicRecord(rows[0]) : null;
}

export async function createEntity(entityName, data, user) {
  const id = crypto.randomUUID();
  const cleanData = { ...data };
  delete cleanData.id;
  delete cleanData.created_date;
  delete cleanData.updated_date;
  delete cleanData.created_by_id;
  const { rows } = await pool.query(
    'INSERT INTO entity_records (entity_name, id, created_by_id, data) VALUES ($1, $2, $3, $4) RETURNING *',
    [entityName, id, user?.id || null, cleanData]
  );
  return publicRecord(rows[0]);
}

export async function updateEntity(entityName, id, data) {
  const cleanData = { ...data };
  delete cleanData.id;
  delete cleanData.created_date;
  delete cleanData.updated_date;
  delete cleanData.created_by_id;
  const { rows } = await pool.query(
    'UPDATE entity_records SET data = data || $3::jsonb, updated_date = now() WHERE entity_name = $1 AND id = $2 RETURNING *',
    [entityName, id, cleanData]
  );
  return rows[0] ? publicRecord(rows[0]) : null;
}

export async function deleteEntity(entityName, id) {
  await pool.query('DELETE FROM entity_records WHERE entity_name = $1 AND id = $2', [entityName, id]);
  return { success: true };
}

export async function bulkCreateEntity(entityName, items, user) {
  const created = [];
  for (const item of items) created.push(await createEntity(entityName, item, user));
  return created;
}

export async function bulkUpdateEntity(entityName, items) {
  const updated = [];
  for (const item of items) updated.push(await updateEntity(entityName, item.id, item));
  return updated.filter(Boolean);
}

export async function updateManyEntity(entityName, query, update) {
  const records = await listEntity(entityName, { query, limit: 5000 });
  const patch = update?.$set || update || {};
  for (const record of records) await updateEntity(entityName, record.id, patch);
  return { count: records.length, has_more: false };
}

export async function deleteManyEntity(entityName, query) {
  const records = await listEntity(entityName, { query, limit: 5000 });
  for (const record of records) await deleteEntity(entityName, record.id);
  return { count: records.length, has_more: false };
}