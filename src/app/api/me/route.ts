import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/me — Retorna o role atual do usuário com base no cookie.
 * O frontend usa isso para saber quais botões exibir.
 */
export async function GET(request: NextRequest) {
  const roleCookie = request.cookies.get("wta_role")?.value;
  const tokenCookie = request.cookies.get("wta_token")?.value;

  // Re-valida o role a partir do token salvo (segurança extra)
  let role: string | null = roleCookie || null;

  if (!role && tokenCookie) {
    const adminToken = process.env.ADMIN_TOKEN;
    const accessToken = process.env.ACCESS_TOKEN;

    if (adminToken && tokenCookie === adminToken) {
      role = "admin";
    } else if (accessToken && tokenCookie === accessToken) {
      role = "consulta";
    }
  }

  // Se nenhum token configurado, é admin
  if (!process.env.ADMIN_TOKEN && !process.env.ACCESS_TOKEN) {
    role = "admin";
  }

  return NextResponse.json({
    role: role || null,
    isAdmin: role === "admin",
  });
}
