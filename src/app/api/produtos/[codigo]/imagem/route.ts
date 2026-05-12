import { NextRequest, NextResponse } from "next/server";
import { db, initDatabase } from "@/lib/db";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

/** Verifica se o request tem role admin */
function requireAdmin(request: NextRequest): boolean {
  const role = request.cookies.get("wta_role")?.value;
  if (!process.env.ADMIN_TOKEN && !process.env.ACCESS_TOKEN) return true;
  return role === "admin";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    // Proteção: somente admin pode alterar imagem
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

    // Valida formato base64 PNG
    if (!imagem.startsWith("data:image/png;base64,")) {
      return NextResponse.json(
        { error: "Formato inválido. Apenas PNG em base64 é aceito." },
        { status: 400 }
      );
    }

    // Valida tamanho (<2MB)
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

    // Verifica se o produto existe
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

    // Decodifica Base64 e salva como arquivo PNG
    const buffer = Buffer.from(base64Data, "base64");
    const imagesDir = join(process.cwd(), "public", "images");
    if (!existsSync(imagesDir)) {
      mkdirSync(imagesDir, { recursive: true });
    }
    const filePath = join(imagesDir, `${codigo}.png`);
    writeFileSync(filePath, buffer);

    // Atualiza o banco: marca que tem imagem (flag '1')
    await db.execute({
      sql: "UPDATE Produto SET imagem = '1', updatedAt = datetime('now') WHERE codigo = ?",
      args: [codigo],
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
