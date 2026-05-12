import { NextRequest, NextResponse } from "next/server";
import { db, initDatabase } from "@/lib/db";
import { SHEETS_MAPPING, type PrecosMap, type MarketKey } from "@/config/sheets-mapping";
import { parseCSV, findColumnIndex, parsePrice } from "@/lib/price-parser";

/** Verifica se o request tem role admin */
function requireAdmin(request: NextRequest): boolean {
  const role = request.cookies.get("wta_role")?.value;
  // Se não há tokens configurados, qualquer acesso é admin
  if (!process.env.ADMIN_TOKEN && !process.env.ACCESS_TOKEN) return true;
  return role === "admin";
}

export async function POST(request: NextRequest) {
  // Proteção: somente admin pode sincronizar
  if (!requireAdmin(request)) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem sincronizar a planilha." },
      { status: 403 }
    );
  }

  try {
    await initDatabase();

    const csvUrl = process.env.GOOGLE_SHEETS_CSV_URL;
    if (!csvUrl) {
      return NextResponse.json(
        { error: "GOOGLE_SHEETS_CSV_URL não configurado no .env" },
        { status: 500 }
      );
    }

    // Faz o fetch do CSV
    let csvText: string;
    try {
      const response = await fetch(csvUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      csvText = await response.text();
    } catch (fetchError) {
      const msg = fetchError instanceof Error ? fetchError.message : "Erro desconhecido";
      return NextResponse.json(
        { error: `Falha ao buscar CSV: ${msg}` },
        { status: 502 }
      );
    }

    // Parseia o CSV
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return NextResponse.json(
        { error: "CSV vazio ou sem dados" },
        { status: 400 }
      );
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Encontra os índices das colunas
    const idxCodigo = findColumnIndex(headers, SHEETS_MAPPING.codigo);
    const idxNome = findColumnIndex(headers, SHEETS_MAPPING.nome);
    const idxCategoria = findColumnIndex(headers, SHEETS_MAPPING.categoria);

    if (idxCodigo === -1 || idxNome === -1) {
      return NextResponse.json(
        { error: `Colunas obrigatórias não encontradas. Header: ${headers.join(", ")}` },
        { status: 400 }
      );
    }

    // Índices de preço por mercado
    const priceIndexes: Record<string, number> = {};
    for (const [key, config] of Object.entries(SHEETS_MAPPING.precos)) {
      const idx = findColumnIndex(headers, config.coluna);
      if (idx !== -1) {
        priceIndexes[key] = idx;
      }
    }

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const codigo = row[idxCodigo]?.trim();
      const nome = row[idxNome]?.trim();
      const categoria = idxCategoria !== -1 ? row[idxCategoria]?.trim() : null;

      if (!codigo || !nome) continue;

      // Monta o objeto de preços
      const precos: PrecosMap = {};
      for (const [key, idx] of Object.entries(priceIndexes)) {
        const rawValue = row[idx];
        const valor = parsePrice(rawValue);
        if (valor !== null) {
          const marketConfig = SHEETS_MAPPING.precos[key as MarketKey];
          precos[key as MarketKey] = { valor, moeda: marketConfig.moeda };
        }
      }

      const precosJson = JSON.stringify(precos);

      try {
        const existing = await db.execute({
          sql: "SELECT id FROM Produto WHERE codigo = ?",
          args: [codigo],
        });

        if (existing.rows.length > 0) {
          await db.execute({
            sql: `UPDATE Produto SET nome = ?, categoria = ?, precos = ?, updatedAt = datetime('now') WHERE codigo = ?`,
            args: [nome, categoria || null, precosJson, codigo],
          });
          updated++;
        } else {
          await db.execute({
            sql: `INSERT INTO Produto (codigo, nome, categoria, precos, ativo, updatedAt) VALUES (?, ?, ?, ?, 1, datetime('now'))`,
            args: [codigo, nome, categoria || null, precosJson],
          });
          imported++;
        }
      } catch (dbError) {
        const msg = dbError instanceof Error ? dbError.message : "Erro DB";
        errors.push(`Linha ${i + 2} (${codigo}): ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      totalRows: dataRows.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
