/**
 * Mapeamento configurável das colunas da planilha Google Sheets.
 * Para adicionar um novo mercado, basta adicionar uma entrada no objeto `precos`.
 * Não é necessário migration — o campo `precos` no SQLite é JSON flexível.
 */
export const SHEETS_MAPPING = {
  codigo: "Cód.",
  nome: "Descrição",
  categoria: "Embal.",
  precos: {
    nacional: { coluna: "Nacional", moeda: "BRL", bandeira: "🇧🇷" },
    sul_americana: { coluna: "Sul Americana", moeda: "USD", bandeira: "🌎" },
    internacional: { coluna: "Internacional", moeda: "USD", bandeira: "🌍" },
    tech_eur: { coluna: "TECH EUR", moeda: "EUR", bandeira: "🇪🇺" },
    tech_eua: { coluna: "TECH EUA", moeda: "USD", bandeira: "🇺🇸" },
    pallet_josy: { coluna: "Pallet Josy", moeda: "USD", bandeira: "📦" },
  },
} as const;

export type MarketKey = keyof typeof SHEETS_MAPPING.precos;
export type PriceEntry = { valor: number; moeda: string };
export type PrecosMap = Partial<Record<MarketKey, PriceEntry>>;

/** Formata moeda para exibição */
export function formatCurrency(valor: number, moeda: string): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: moeda,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor);
  } catch {
    return `${moeda} ${valor.toFixed(2)}`;
  }
}
