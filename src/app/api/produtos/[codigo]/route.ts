import { NextRequest, NextResponse } from "next/server";
import { db, initDatabase } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    await initDatabase();

    const { codigo } = await params;

    const result = await db.execute({
      sql: `SELECT id, codigo, nome, categoria, imagem, precos, ativo, updatedAt
            FROM Produto 
            WHERE codigo = ? AND ativo = 1`,
      args: [codigo],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: `Produto '${codigo}' não encontrado` },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    const imagemRaw = row.imagem as string | null;
    const hasImagem = !!imagemRaw && imagemRaw !== "" && imagemRaw !== "1";

    const produto = {
      id: row.id as number,
      codigo: row.codigo as string,
      nome: row.nome as string,
      categoria: (row.categoria as string) || null,
      hasImagem,
      imagemUrl: hasImagem ? `/api/produtos/${encodeURIComponent(codigo)}/imagem` : null,
      precos: JSON.parse((row.precos as string) || "{}"),
      ativo: row.ativo as number,
      updatedAt: row.updatedAt as string,
    };

    return NextResponse.json(produto);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}