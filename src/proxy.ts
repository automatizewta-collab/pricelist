import { NextRequest, NextResponse } from "next/server";

type Role = "admin" | "consulta";

/**
 * Resolve o role com base no token fornecido.
 * - Se bater com ADMIN_TOKEN → "admin"
 * - Se bater com ACCESS_TOKEN → "consulta"
 * - Caso contrário → null
 */
function resolveRole(token: string | null | undefined): Role | null {
  if (!token) return null;
  const adminToken = process.env.ADMIN_TOKEN;
  const accessToken = process.env.ACCESS_TOKEN;

  if (adminToken && token === adminToken) return "admin";
  if (accessToken && token === accessToken) return "consulta";

  return null;
}

/** HTML da página de acesso restrito */
const ACCESS_DENIED_HTML = [
  '<!DOCTYPE html>',
  '<html lang="pt-BR">',
  '<head>',
  '  <meta charset="UTF-8" />',
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '  <title>Acesso Restrito - WTA</title>',
  '  <style>',
  '    * { margin: 0; padding: 0; box-sizing: border-box; }',
  '    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }',
  '    .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }',
  '    .icon { font-size: 64px; margin-bottom: 16px; }',
  '    h1 { font-size: 28px; color: #C8102E; margin-bottom: 12px; }',
  '    p { font-size: 18px; color: #555; line-height: 1.6; margin-bottom: 24px; }',
  '    .hint { font-size: 14px; color: #999; }',
  '    code { background: #f0f0f0; padding: 2px 8px; border-radius: 4px; font-family: monospace; }',
  '  </style>',
  '</head>',
  '<body>',
  '  <div class="card">',
  '    <div class="icon">&#x1F512;</div>',
  '    <h1>Acesso Restrito</h1>',
  '    <p>Esta &aacute;rea requer autentica&ccedil;&atilde;o. Use o link com token de acesso fornecido pela WTA.</p>',
  '    <p class="hint">Adicione <code>?token=SEU_TOKEN</code> na URL para acessar.</p>',
  '  </div>',
  '</body>',
  '</html>',
].join("\n");

export function proxy(request: NextRequest) {
  const { searchParams, pathname } = new URL(request.url);

  // Ignora rotas de API — validação de role é feita dentro de cada endpoint
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Ignora arquivos estáticos
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images/") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  const adminToken = process.env.ADMIN_TOKEN;
  const accessToken = process.env.ACCESS_TOKEN;
  const hasAnyToken = !!(adminToken || accessToken);

  // Se não há nenhum token configurado, permite acesso livre como admin
  if (!hasAnyToken) {
    const response = NextResponse.next();
    response.cookies.set("wta_role", "admin", {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return response;
  }

  // Verifica token na URL
  const tokenParam = searchParams.get("token");

  // Verifica token no cookie
  const tokenCookie = request.cookies.get("wta_token")?.value;

  // Tenta resolver o role a partir do token
  const role = resolveRole(tokenParam) ?? resolveRole(tokenCookie);

  if (role) {
    // Se tem token na URL, redireciona para limpar a URL (com cookies)
    if (tokenParam && pathname === "/") {
      const cleanUrl = new URL(request.url);
      cleanUrl.searchParams.delete("token");
      const response = NextResponse.redirect(cleanUrl.toString());

      // Salva o token no cookie httpOnly (segurança)
      response.cookies.set("wta_token", tokenParam, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 dias
        path: "/",
      });

      // Salva o role em cookie legível pelo frontend
      response.cookies.set("wta_role", role, {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });

      return response;
    }

    // Acesso normal (via cookie já salvo)
    const response = NextResponse.next();

    // Atualiza cookie de role
    response.cookies.set("wta_role", role, {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  }

  // Token inválido ou ausente — retorna página de acesso restrito
  return new NextResponse(ACCESS_DENIED_HTML, {
    status: 403,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
