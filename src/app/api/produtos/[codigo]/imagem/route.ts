import { NextRequest, NextResponse } from "next/server";
import { db, initDatabase } from "@/lib/db";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

/** Verifica se o request tem role admin */
function requireAdmin(request: NextRequest): boolean {
  const role = request.cookies.get("wta_role")?.value;
  if (!process.env.ADMIN_TOKEN && !process.env.ACCESS_TOKEN) return true;
  return role === "admin";
}

/** GET - Retorna a imagem do produto como resposta de imagem PNG */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    await initDatabase();

    const { codigo } = await params;

    const result = await db.execute({
      sql: "SELECT imagem FROM Produto WHERE codigo = ? AND ativo = 1",
      args: [codigo],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: `Produto '${codigo}' não encontrado` },
        { status: 404 }
      );
    }

    const imagem = result.rows[0].imagem as string | null;

    if (!imagem || imagem === "1" || !imagem.startsWith("data:image/png;base64,")) {
      return NextResponse.json(
        { error: "Produto sem imagem" },
        { status: 404 }
      );
    }

    const base64Data = imagem.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST - Salva a imagem do produto como Base64 no banco (Turso) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    if (!requireAdmin(request)) {
      return NextResponse.json(
        { error: "Acesso negado. Apenas administradores podem alterar imagens." },
        { status: 403 }
      );
    }

    await initDatabase();

    const { codigo } = await params;

    if (!codigo) {
      return NextResponse.json(
        { error: "Código do produto é obrigatório" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { imagem } = body as { imagem?: string };

    if (!imagem) {
      return NextResponse.json(
        { error: "Campo 'imagem' é obrigatório" },
        { status: 400 }
      );
    }

    if (!imagem.startsWith("data:image/png;base64,")) {
      return NextResponse.json(
        { error: "Formato inválido. Apenas PNG em base64 é aceito." },
        { status: 400 }
      );
    }

    const base64Data = imagem.split(",")[1];
    if (!base64Data) {
      return NextResponse.json(
        { error: "Dados base64 ausentes" },
        { status: 400 }
      );
    }

    const sizeInBytes = Math.ceil(base64Data.length * 0.75);
    if (sizeInBytes > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: `Imagem excede o limite de 2MB (atual: ${(sizeInBytes / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 }
      );
    }

    const existing = await db.execute({
      sql: "SELECT id FROM Produto WHERE codigo = ?",
      args: [codigo],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: `Produto com código '${codigo}' não encontrado` },
        { status: 404 }
      );
    }

    // Salva o Base64 diretamente no banco (Turso)
    await db.execute({
      sql: "UPDATE Produto SET imagem = ?, updatedAt = datetime('now') WHERE codigo = ?",
      args: [imagem, codigo],
    });

    return NextResponse.json({
      success: true,
      message: `Imagem do produto ${codigo} salva com sucesso`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}