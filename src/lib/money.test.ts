import { describe, expect, it } from "vitest";
import { centsToInput, formatCents, parseBRLToCents, pctOf, sumCents } from "./money";

describe("parseBRLToCents", () => {
  it("vírgula decimal BR", () => {
    expect(parseBRLToCents("29,90")).toBe(2990);
    expect(parseBRLToCents("0,01")).toBe(1);
    expect(parseBRLToCents("1234,5")).toBe(123450);
  });

  it("formato BR completo com milhar", () => {
    expect(parseBRLToCents("1.234,56")).toBe(123456);
    expect(parseBRLToCents("1.000.000,00")).toBe(100000000);
  });

  it("decimal com ponto (US)", () => {
    expect(parseBRLToCents("1234.56")).toBe(123456);
    expect(parseBRLToCents("12.5")).toBe(1250);
  });

  it("ponto como milhar sem decimal", () => {
    expect(parseBRLToCents("1.234")).toBe(123400);
    expect(parseBRLToCents("1.234.567")).toBe(123456700);
  });

  it("inteiro puro", () => {
    expect(parseBRLToCents("1234")).toBe(123400);
    expect(parseBRLToCents("0")).toBe(0);
  });

  it("prefixo R$ e espaços", () => {
    expect(parseBRLToCents("R$ 29,90")).toBe(2990);
    expect(parseBRLToCents("  100  ")).toBe(10000);
  });

  it("clássico do float: 0,1 + 0,2", () => {
    expect(parseBRLToCents("0,10") + parseBRLToCents("0,20")).toBe(30);
  });

  it("rejeita lixo", () => {
    expect(() => parseBRLToCents("")).toThrow();
    expect(() => parseBRLToCents("abc")).toThrow();
    expect(() => parseBRLToCents("12,34abc")).toThrow();
  });

  it("roundtrip com centsToInput", () => {
    for (const c of [1, 99, 100, 2990, 123456, 100000000]) {
      expect(parseBRLToCents(centsToInput(c))).toBe(c);
    }
  });
});

describe("formatCents", () => {
  it("formata pt-BR", () => {
    // Intl usa NBSP entre R$ e número
    expect(formatCents(123456).replace(/\u00a0/g, " ")).toBe("R$ 1.234,56");
    expect(formatCents(0).replace(/\u00a0/g, " ")).toBe("R$ 0,00");
  });

  it("rejeita não-inteiro", () => {
    expect(() => formatCents(12.5)).toThrow();
  });
});

describe("centsToInput", () => {
  it("gera vírgula decimal", () => {
    expect(centsToInput(2990)).toBe("29,90");
    expect(centsToInput(1)).toBe("0,01");
    expect(centsToInput(-2990)).toBe("-29,90");
  });
});

describe("sumCents", () => {
  it("soma exata", () => {
    expect(sumCents([10, 20, 30])).toBe(60);
    expect(sumCents([])).toBe(0);
  });
  it("rejeita float na lista", () => {
    expect(() => sumCents([10, 0.5])).toThrow();
  });
});

describe("pctOf", () => {
  it("percentual de orçamento", () => {
    expect(pctOf(5000, 10000)).toBe(50);
    expect(pctOf(15000, 10000)).toBe(150);
  });
  it("limite zero não divide por zero", () => {
    expect(pctOf(5000, 0)).toBe(0);
  });
});
