/**
 * Dinheiro em CENTAVOS INTEIROS — nunca float.
 *
 * Regra do sistema: todo valor monetário trafega como inteiro de centavos
 * (DB BIGINT, TS number inteiro — seguro até 2^53-1, ~90 trilhões de reais).
 * Float só existe DENTRO de parseBRLToCents, com Math.round na borda.
 */

/** "1.234,56" | "1234,56" | "1234.56" | "1234" → centavos (123456). Lança em entrada inválida. */
export function parseBRLToCents(input: string): number {
  const raw = input.trim().replace(/^R\$\s*/i, "");
  if (!raw) throw new Error("Valor vazio");
  if (!/^-?[\d.,\s]+$/.test(raw)) throw new Error(`Valor inválido: "${input}"`);

  let normalized = raw.replace(/\s/g, "");
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    // Formato BR completo: ponto = milhar, vírgula = decimal ("1.234,56")
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // Só vírgula: decimal BR ("1234,56")
    normalized = normalized.replace(",", ".");
  } else if (hasDot) {
    // Só ponto: ambíguo. "1.234" (milhar BR) vs "1234.56" (decimal US).
    // Heurística: ponto seguido de exatamente 3 dígitos no fim = milhar.
    const m = normalized.match(/\.(\d+)$/);
    if (m && m[1].length === 3 && normalized.indexOf(".") !== normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, ""); // "1.234.567"
    } else if (m && m[1].length === 3 && !normalized.match(/\.\d+\./)) {
      normalized = normalized.replace(/\./g, ""); // "1.234" → 1234
    }
    // senão mantém como decimal US ("1234.56", "12.5")
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error(`Valor inválido: "${input}"`);
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents)) throw new Error("Valor fora do intervalo seguro");
  return cents;
}

/** 123456 → "R$ 1.234,56" */
export function formatCents(cents: number): string {
  assertCents(cents);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** 123456 → "1234,56" (para preencher input em edição) */
export function centsToInput(cents: number): string {
  assertCents(cents);
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  const reais = Math.trunc(abs / 100);
  const cent = String(abs % 100).padStart(2, "0");
  return `${sign}${reais},${cent}`;
}

export function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Valor monetário deve ser inteiro de centavos, recebido: ${cents}`);
  }
}

/** Soma segura de centavos (valida cada parcela). */
export function sumCents(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
  }
  assertCents(total);
  return total;
}

/** Percentual (0-100+) de used sobre limit, em float só para exibição. */
export function pctOf(usedCents: number, limitCents: number): number {
  assertCents(usedCents);
  assertCents(limitCents);
  if (limitCents <= 0) return 0;
  return (usedCents / limitCents) * 100;
}
