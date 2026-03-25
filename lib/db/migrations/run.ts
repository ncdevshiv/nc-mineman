import { ensureDb } from '@/lib/database';
import { readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'lib', 'db', 'migrations');

export async function runMigrations(): Promise<void> {
  const db = await ensureDb();
  if (!db) {
    console.log('[Migrations] Skipping at build time (no database)');
    return;
  }

  try {
    // Ensure migrations tracking table exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      // Skip if already applied
      const check = await db.execute({
        sql: "SELECT 1 FROM _migrations WHERE name = ?",
        args: [file]
      });
      if ((check.rows?.length ?? 0) > 0) {
        console.log(`[Migrations] Skipping (already applied): ${file}`);
        continue;
      }

      const filePath = join(MIGRATIONS_DIR, file);
      console.log(`[Migrations] Running: ${file}`);
      const sqlContent = await Bun.file(filePath).text();
      const statements = sqlContent.split(';').map(s => s.trim()).filter(Boolean);

      // Run all statements in a transaction
      await db.execute('BEGIN TRANSACTION');
      try {
        for (const stmt of statements) {
          await db.execute(stmt);
        }
        await db.execute("INSERT INTO _migrations (name) VALUES (?)", [file]);
        await db.execute('COMMIT');
        console.log(`[Migrations] Completed: ${file}`);
      } catch (err: any) {
        await db.execute('ROLLBACK');
        console.error(`[Migrations] Failed: ${file} — ${err.message}`);
        throw err;
      }
    }

    console.log('[Migrations] All migrations completed');
  } catch (err: any) {
    console.error('[Migrations] Error:', err.message);
    throw err;
  }
}

runMigrations();
