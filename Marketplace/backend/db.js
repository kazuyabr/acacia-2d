/* global process */

import pg from 'pg';

const { Pool } = pg,
  DEFAULT_PORT = 5433,
  DEFAULT_DATABASE = 'acacia_marketplace',
  DEFAULT_USER = 'acacia_marketplace',
  DEFAULT_PASSWORD = 'acacia_marketplace';

let pool;

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

export function getDatabaseConfig() {
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || DEFAULT_PORT),
    database: process.env.POSTGRES_DATABASE || DEFAULT_DATABASE,
    user: process.env.POSTGRES_USER || DEFAULT_USER,
    password: process.env.POSTGRES_PASSWORD || DEFAULT_PASSWORD,
    ssl: parseBoolean(process.env.POSTGRES_SSL, false) ? { rejectUnauthorized: false } : false,
    max: Number(process.env.POSTGRES_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECTION_TIMEOUT_MS || 5000),
  };
}

export function getPool() {
  if (!pool) pool = new Pool(getDatabaseConfig());

  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

export async function withTransaction(callback) {
  let client = await getPool().connect();

  try {
    await client.query('BEGIN');
    let result = await callback(client);
    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (!pool) return;

  await pool.end();
  pool = undefined;
}
