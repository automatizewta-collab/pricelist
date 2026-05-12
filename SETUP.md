# WTA Price Consult v1.2 — Guia de Setup

## Visão Geral

Sistema de consulta de preços da WTA para vendedores, com:
- Estrutura de preços flexível (JSON) para mercados dinâmicos
- Sincronização com Google Sheets (CSV público)
- Upload de imagem 500×500 PNG (Canvas → arquivo estático, cache automático pelo navegador)
- **2 roles de acesso por token** (Consulta e Admin)
- UX otimizada para usuários >40 anos (fontes grandes, alto contraste)

## Requisitos

- **Bun** v1.0+ (runtime JavaScript)
- **Node.js** 18+ (compatibilidade)

## Instalação

```bash
# 1. Clone ou extraia o projeto
cd WTA_Price_Consult

# 2. Instale as dependências
bun install

# 3. Copie o arquivo de ambiente
cp .env.example .env

# 4. Edite o .env com suas configurações
#    - WTA_DB_URL: caminho do banco SQLite
#    - ACCESS_TOKEN: token para vendedores (consulta)
#    - ADMIN_TOKEN: token para gestores (admin)
#    - GOOGLE_SHEETS_CSV_URL: URL do CSV do Google Sheets

# 5. Crie a pasta db/ (para o SQLite)
mkdir -p db

# 6. Inicie o servidor
bun run dev
```

> **⚠️ Não precisa de `db:push`, `db:generate` ou `db:migrate`!**
> Este projeto usa `@libsql/client` (não Prisma). A tabela é criada **automaticamente**
> na primeira requisição à API pela função `initDatabase()` em `src/lib/db.ts`.

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição | Exemplo |
|---|---|---|---|
| `WTA_DB_URL` | Sim | Caminho do banco SQLite | `file:db/wta.db` |
| `ACCESS_TOKEN` | Não* | Token de consulta (vendedores) | `wta2025` |
| `ADMIN_TOKEN` | Não* | Token de admin (gestores) | `wta2025admin` |
| `GOOGLE_SHEETS_CSV_URL` | Sim | URL de exportação CSV do Google Sheets | `https://docs.google.com/spreadsheets/d/SEU_ID/export?format=csv` |

*\*Se ambos `ACCESS_TOKEN` e `ADMIN_TOKEN` estiverem vazios, o acesso será livre como admin.*

## Comandos

```bash
# Iniciar em modo desenvolvimento
bun run dev

# Verificar qualidade do código
bun run lint

# Build de produção (NÃO USAR em desenvolvimento)
bun run build
```

## Roles de Acesso

O sistema utiliza **2 tokens distintos** para controlar o acesso:

| Role | Token | O que pode fazer |
|---|---|---|
| **Consulta** | `?token=wta2025` | Visualizar preços, buscar produtos, ver imagens |
| **Admin** | `?token=wta2025admin` | Tudo acima + sincronizar planilha + alterar fotos |

### Como funciona

1. O vendedor recebe o link: `https://seu-dominio.com/?token=wta2025`
2. O gestor recebe o link: `https://seu-dominio.com/?token=wta2025admin`
3. Após o primeiro acesso, o token é salvo em cookie (30 dias)
4. A URL é limpa automaticamente (token não fica visível na barra)
5. O badge no header indica o role atual: 🛡️ Consulta ou ✅ Admin

### O que muda na interface por role

| Elemento | Consulta | Admin |
|---|---|---|
| Badge no header | 🛡️ Consulta (cinza) | ✅ Admin (vermelho) |
| Botão "Sincronizar Planilha" | ❌ Oculto | ✅ Visível |
| Botão "📷 Alterar Foto" nos cards | ❌ Oculto | ✅ Visível |
| API sync/sheets (POST) | ❌ 403 Proibido | ✅ Permitido |
| API produtos/[codigo]/imagem (POST) | ❌ 403 Proibido | ✅ Permitido |

### Distribuição dos links

- **Vendedores**: mande o link de consulta por WhatsApp/email — interface limpa, sem botões de admin
- **Gestores**: guarde o link de admin — só eles podem alterar dados
- Para revogar acesso de vendedores: troque o `ACCESS_TOKEN` no .env e mande o novo link
- Para revogar acesso de admins: troque o `ADMIN_TOKEN` no .env

## Configurando a Planilha Google Sheets

### 1. Tornar a planilha pública
1. Abra a planilha no Google Sheets
2. Vá em **Compartilhar** → **Qualquer pessoa com o link** → **Leitor**
3. Copie o ID da planilha da URL

### 2. Gerar a URL de CSV
A URL de exportação segue o formato:
```
https://docs.google.com/spreadsheets/d/SEU_ID/export?format=csv
```

Para uma aba específica, adicione `&gid=NUMERO_DA_ABA`:
```
https://docs.google.com/spreadsheets/d/SEU_ID/export?format=csv&gid=0
```

### 3. Colunas esperadas

| Coluna | Obrigatória | Descrição |
|---|---|---|
| `Cód.` | Sim | Código do produto (chave única) |
| `Descrição` | Sim | Nome do produto em português |
| `Embal.` | Não | Tipo de embalagem/unidade |
| `Nacional` | Não | Preço Brasil (BRL) |
| `Sul Americana` | Não | Preço América do Sul (USD) |
| `Internacional` | Não | Preço Internacional (USD) |
| `TECH EUR` | Não | Preço Europa TECH (EUR) |
| `TECH EUA` | Não | Preço EUA TECH (USD) |
| `Pallet Josy` | Não | Preço Pallet Josy (USD) |

### 4. Formatos de preço aceitos

- `R$ 2.000,00` → Formato brasileiro
- `$1,40` → Dólar com decimal brasileiro
- `€ 6.50` → Euro com decimal internacional
- `€ 2,600.00` → Euro com separador internacional
- `3300` → Número sem formatação
- `-` → Sem preço (ignorado)

### 5. Adicionar novos mercados

Edite `src/config/sheets-mapping.ts`:

```typescript
precos: {
  // ... mercados existentes ...
  novo_mercado: { coluna: "Nome da Coluna", moeda: "BRL", bandeira: "🏳️" },
}
```

**Não é necessário migration!** O campo `precos` é JSON flexível.

## Upload de Imagem

O upload funciona assim:

1. **Cliente**: O usuário seleciona um arquivo PNG
2. **Canvas**: O navegador redimensiona para 500×500px usando HTML Canvas
3. **Base64**: A imagem é exportada como `data:image/png;base64,...`
4. **API**: Enviada via POST para `/api/produtos/[codigo]/imagem`
5. **Validação**: O servidor valida formato (PNG), tamanho (<2MB) e role (admin)
6. **Decodificação**: O servidor decodifica o Base64 para bytes do PNG
7. **Arquivo**: Salva como `public/images/{codigo}.png` (arquivo estático)
8. **Banco**: Marca `imagem = '1'` no SQLite (flag, não o arquivo)

**Vantagens sobre Base64 no banco:**
- Arquivo PNG ~50KB vs Base64 ~500KB (10x menor)
- Navegador cacheia automaticamente (não baixa de novo)
- Banco de dados fica leve
- Imagem carrega instantaneamente na segunda visita

**Apenas administradores podem alterar fotos.**

## Schema do Banco de Dados

```sql
CREATE TABLE IF NOT EXISTS Produto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  imagem TEXT,                  -- Base64 PNG 500x500
  precos TEXT DEFAULT '{}',     -- JSON com mercados dinâmicos
  ativo INTEGER DEFAULT 1,
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_produto_codigo ON Produto(codigo);
```

### Exemplo de campo `precos`:

```json
{
  "nacional": { "valor": 210.00, "moeda": "BRL" },
  "sul_americana": { "valor": 42.00, "moeda": "USD" },
  "internacional": { "valor": 41.25, "moeda": "USD" },
  "tech_eur": { "valor": 35.00, "moeda": "EUR" },
  "tech_eua": { "valor": 41.25, "moeda": "USD" },
  "pallet_josy": { "valor": 22.00, "moeda": "USD" }
}
```

## Checklist de Validação

- [ ] Dependências instaladas (`bun install`)
- [ ] `.env` configurado com `WTA_DB_URL`
- [ ] `.env` configurado com `GOOGLE_SHEETS_CSV_URL`
- [ ] `ACCESS_TOKEN` definido para vendedores
- [ ] `ADMIN_TOKEN` definido para gestores
- [ ] Acesso via `?token=wta2025` mostra badge "Consulta"
- [ ] Acesso via `?token=wta2025admin` mostra badge "Admin"
- [ ] Consulta NÃO vê botão "Sincronizar Planilha"
- [ ] Consulta NÃO vê botão "Alterar Foto"
- [ ] Admin vê ambos os botões
- [ ] Sincronização com Google Sheets funciona
- [ ] Busca por código e nome funciona
- [ ] Filtro por categoria funciona
- [ ] Upload de imagem funciona (PNG, 500×500, <2MB) — só admin
- [ ] Fontes grandes e legíveis (mínimo 18px corpo)
- [ ] Botões com tamanho mínimo 48px

## Estrutura de Arquivos

```
src/
├── app/
│   ├── api/
│   │   ├── me/
│   │   │   └── route.ts          # GET - role atual do usuário
│   │   ├── produtos/
│   │   │   ├── route.ts          # GET - busca de produtos
│   │   │   └── [codigo]/
│   │   │       ├── route.ts      # GET - produto individual com imagem
│   │   │       └── imagem/
│   │   │           └── route.ts  # POST - upload de imagem (admin)
│   │   └── sync/
│   │       └── sheets/
│   │           └── route.ts      # POST - sync Google Sheets (admin)
│   ├── globals.css               # Estilos globais + cores WTA
│   ├── layout.tsx                # Layout raiz
│   └── page.tsx                  # Página principal de consulta
├── components/
│   ├── ImageUploader.tsx         # Upload de imagem com Canvas
│   └── ui/                       # Componentes shadcn/ui
├── config/
│   └── sheets-mapping.ts         # Mapeamento de colunas da planilha
├── lib/
│   ├── db.ts                     # Wrapper @libsql/client
│   ├── price-parser.ts           # Parser de preços multiformato
│   └── utils.ts                  # Utilitários gerais
└── proxy.ts                      # Token auth + role routing (Next.js 16)
```

## Gerar ZIP para Distribuição

```powershell
# PowerShell
Compress-Archive -Path .\* -DestinationPath WTA_Price_Consult_v1.2.zip -Force
```

Ou no Linux/Mac:
```bash
zip -r WTA_Price_Consult_v1.2.zip . -x "node_modules/*" ".next/*" "db/*"
```
