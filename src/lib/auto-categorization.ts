// Sugere categoria + tipo (receita/despesa) pela descrição da transação.
export type TxKind = "income" | "expense";

const RULES: Array<{ keywords: string[]; category: string; kind: TxKind }> = [
  { kind: "expense", category: "Alimentação", keywords: ["ifood", "uber eats", "rappi", "restaurante", "lanche", "mercado", "supermercado", "padaria", "pizza", "burger", "hamburguer", "hambúrguer", "açaí", "acai"] },
  { kind: "expense", category: "Transporte", keywords: ["uber", "99", "gasolina", "posto", "estacionamento", "pedagio", "pedágio", "metro", "metrô", "ônibus", "onibus", "combustivel", "combustível"] },
  { kind: "expense", category: "Assinaturas", keywords: ["netflix", "spotify", "adobe", "youtube", "apple", "google", "amazon prime", "vercel", "hostinger", "icloud", "openai", "chatgpt", "claude", "disney", "hbo"] },
  { kind: "expense", category: "Moradia", keywords: ["aluguel", "condominio", "condomínio", "luz", "agua", "água", "gás", "gas", "internet", "iptu", "energia", "enel", "sabesp"] },
  { kind: "expense", category: "Cartão de Crédito", keywords: ["pagamento fatura", "pagamento cartao", "pagamento cartão", "fatura"] },
  { kind: "expense", category: "Saúde", keywords: ["farmacia", "farmácia", "drogaria", "consulta", "hospital", "clinica", "clínica", "unimed", "amil", "medico", "médico", "dentista"] },
  { kind: "expense", category: "Lazer", keywords: ["cinema", "show", "ingresso", "steam", "playstation", "xbox", "bar", "balada"] },
  { kind: "expense", category: "Educação", keywords: ["curso", "udemy", "coursera", "alura", "faculdade", "escola", "livro", "mensalidade"] },
  { kind: "expense", category: "Compras", keywords: ["shopee", "amazon", "magazine", "magalu", "mercado livre", "americanas", "shein"] },
  { kind: "income", category: "Salário", keywords: ["salario", "salário", "salary", "pagamento mensal", "folha", "clt"] },
  { kind: "income", category: "Freelance", keywords: ["freelance", "freela", "projeto", "honorario", "honorário", "servico prestado", "serviço prestado"] },
  { kind: "income", category: "Rendimentos", keywords: ["rendimento", "dividendo", "juros", "cdb", "tesouro", "poupanca", "poupança", "aplicacao", "aplicação"] },
];

export type CategorySuggestion = { category: string; kind: TxKind };

export function suggestCategoryDetailed(description: string): CategorySuggestion | null {
  const text = description.toLowerCase().trim();
  if (!text) return null;
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      return { category: rule.category, kind: rule.kind };
    }
  }
  return null;
}

// Compat legado
export function suggestCategory(description: string): string | null {
  return suggestCategoryDetailed(description)?.category ?? null;
}
