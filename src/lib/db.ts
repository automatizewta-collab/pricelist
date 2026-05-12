import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "fs";
import { dirname } from "path";

const dbUrl = process.env.WTA_DB_URL ?? "file:db/wta.db";

// Garante que o diretório do banco existe antes de criar o client
if (dbUrl.startsWith("file:")) {
  const dbPath = dbUrl.replace("file:", "");
  const dir = dirname(dbPath);
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // Diretório já existe ou não precisou criar
  }
}

const globalForDb = globalThis as unknown as {
  wtaDb: Client | undefined;
};

export const db: Client =
  globalForDb.wtaDb ??
  createClient({
    url: dbUrl,
  });

if (process.env.NODE_ENV !== "production") globalForDb.wtaDb = db;

export async function initDatabase(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS Produto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      categoria TEXT,
      imagem TEXT,
      precos TEXT DEFAULT '{}',
      ativo INTEGER DEFAULT 1,
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_produto_codigo ON Produto(codigo)
  `);
}
