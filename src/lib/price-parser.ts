/**
 * Parser robusto para preços em formatos mistos (BR + internacional).
 * Lida com: R$ 2.000,00 | $1,40 | € 2,600.00 | 3300 | - | vazio
 */

/**
 * Detecta o formato numérico e converte para float.
 * - Formato BR: 1.000,00 → 1000.00  (ponto=milhar, vírgula=decimal)
 * - Formato INTL: 1,000.00 → 1000.00  (vírgula=milhar, ponto=decimal)
 * - Sem separador: 3300 → 3300.00
 */
export function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;

  const trimmed = raw.trim();

  // Casos nulos
  if (trimmed === "-" || trimmed === "" || trimmed.toLowerCase() === "null") {
    return null;
  }

  // Remove símbolos de moeda e espaços
  const cleaned = trimmed
    .replace(/^R\$\s*/i, "")
    .replace(/^\$\s*/, "")
    .replace(/^€\s*/i, "")
    .replace(/\s+/g, "")
    .trim();

  if (!cleaned || cleaned === "-") return null;

  // Tenta detectar o formato
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    // Verifica qual separador vem primeiro
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");

    if (lastComma > lastDot) {
      // Formato BR: 1.000,50 → remove pontos, troca vírgula por ponto
      const normalized = cleaned.replace(/\./g, "").replace(",", ".");
      const num = parseFloat(normalized);
      return isNaN(num) ? null : num;
    } else {
      // Formato INTL: 1,000.50 → remove vírgulas
      const normalized = cleaned.replace(/,/g, "");
      const num = parseFloat(normalized);
      return isNaN(num) ? null : num;
    }
  } else if (hasComma) {
    // Apenas vírgula → formato BR decimal (7,00 → 7.00)
    const normalized = cleaned.replace(",", ".");
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
  } else if (hasDot) {
    // Apenas ponto → formato INTL decimal (6.50 → 6.50)
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  } else {
    // Sem separadores
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
}

/**
 * Parseia uma linha CSV respeitando aspas e vírgulas internas.
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Converte o conteúdo CSV inteiro em um array de objetos linha.
 */
export function parseCSV(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines.map((line) => parseCSVLine(line));
}

/**
 * Encontra o índice de uma coluna pelo nome no header.
 */
export function findColumnIndex(
  headers: string[],
  columnName: string
): number {
  return headers.findIndex(
    (h) => h.trim().toLowerCase() === columnName.trim().toLowerCase()
  );
}
