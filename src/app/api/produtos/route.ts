import { NextRequest, NextResponse } from "next/server";
import { db, initDatabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const categoria = searchParams.get("categoria")?.trim() || "";
    const includeImagem = searchParams.get("imagem") === "true";

    // Na listagem, não incluir imagem por padrão (Base64 pesado)
    const imagemCol = includeImagem ? "imagem" : "CASE WHEN imagem IS NOT NULL AND imagem != '' THEN 1 ELSE 0 END as hasImagem";

    let sql: string;
    const args: (string | number)[] = [];

    if (search) {
      sql = `SELECT id, codigo, nome, categoria, ${imagemCol}, precos, ativo, updatedAt
             FROM Produto 
             WHERE ativo = 1 AND (codigo LIKE ? OR nome LIKE ?)`;
      const term = `%${search}%`;
      args.push(term, term);

      if (categoria) {
        sql += ` AND categoria = ?`;
        args.push(categoria);
      }
      sql += ` ORDER BY nome ASC LIMIT 500`;
    } else if (categoria) {
      sql = `SELECT id, codigo, nome, categoria, ${imagemCol}, precos, ativo, updatedAt
             FROM Produto 
             WHERE ativo = 1 AND categoria = ?
             ORDER BY nome ASC LIMIT 500`;
      args.push(categoria);
    } else {
      sql = `SELECT id, codigo, nome, categoria, ${imagemCol}, precos, ativo, updatedAt
             FROM Produto 
             WHERE ativo = 1
             ORDER BY nome ASC LIMIT 500`;
    }

    const result = await db.execute({ sql, args });

    const produtos = result.rows.map((row) => {
      const base: Record<string, unknown> = {
        id: row.id as number,
        codigo: row.codigo as string,
        nome: row.nome as string,
        categoria: (row.categoria as string) || null,
        precos: JSON.parse((row.precos as string) || "{}"),
        ativo: row.ativo as number,
        updatedAt: row.updatedAt as string,
      };

      if (includeImagem) {
        base.imagem = (row.imagem as string) || null;
      } else {
        base.hasImagem = (row.hasImagem as number) === 1;
      }

      return base;
    });

    // Lista categorias disponíveis
    const catResult = await db.execute(
      `SELECT DISTINCT categoria FROM Produto WHERE ativo = 1 AND categoria IS NOT NULL AND categoria != '' ORDER BY categoria`
    );
    const categorias = catResult.rows.map((r) => r.categoria as string);

    return NextResponse.json({ produtos, categorias, total: produtos.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
