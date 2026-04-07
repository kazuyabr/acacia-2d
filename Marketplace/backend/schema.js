import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { query } from './db.js';

const currentFilePath = fileURLToPath(import.meta.url),
  backendDirectoryPath = path.dirname(currentFilePath),
  postgresDirectoryPath = path.resolve(backendDirectoryPath, '..', 'postgres'),
  schemaFilePaths = ['001_schema.sql', '003_indexes_and_views.sql'].map((fileName) =>
    path.resolve(postgresDirectoryPath, fileName),
  );

export function getSchemaFilePaths() {
  return [...schemaFilePaths];
}

export async function ensureSchema() {
  for (let schemaFilePath of schemaFilePaths) {
    let sql = await fs.readFile(schemaFilePath, 'utf8');
    await query(sql);
  }
}
