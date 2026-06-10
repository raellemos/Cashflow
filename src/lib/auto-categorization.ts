// Sugere uma categoria pelo nome a partir da descrição da transação.
const RULES: Array<{ keywords: string[]; category: string }> = [
  {
    category: "Alimentação",
    keywords: [
      "ifood",
      "uber eats",
      "rappi",
      "restaurante",
      "lanche",
      "mercado",
      "supermercado",
      "padaria",
      "pizza",
      "burger",
    ],
  },
  {
    category: "Transporte",
    keywords: [
      "uber",
      "99",
      "gasolina",
      "posto",
      "estacionamento",
      "pedagio",
      "pedágio",
      "metro",
      "metrô",
      "ônibus",
    ],
  },
  {
    category: "Assinaturas",
    keywords: [
      "netflix",
      "spotify",
      "adobe",
      "youtube",
      "apple",
      "google",
      "amazon prime",
      "vercel",
      "hostinger",
      "icloud",
      "openai",
      "chatgpt",
      "claude",
    ],
  },
  {
    category: "Moradia",
    keywords: [
      "aluguel",
      "condominio",
      "condomínio",
      "luz",
      "agua",
      "água",
      "gás",
      "gas",
      "internet",
      "iptu",
    ],
  },
  {
    category: "Cartão de Crédito",
    keywords: ["pagamento fatura", "pagamento cartao", "pagamento cartão", "fatura"],
  },
  {
    category: "Saúde",
    keywords: [
      "farmacia",
      "farmácia",
      "drogaria",
      "consulta",
      "hospital",
      "clinica",
      "clínica",
      "unimed",
      "amil",
    ],
  },
  {
    category: "Lazer",
    keywords: ["cinema", "show", "ingresso", "steam", "playstation", "xbox", "bar"],
  },
  {
    category: "Educação",
    keywords: ["curso", "udemy", "coursera", "alura", "faculdade", "escola", "livro"],
  },
  {
    category: "Compras",
    keywords: ["shopee", "amazon", "magazine", "magalu", "mercado livre", "americanas"],
  },
  { category: "Salário", keywords: ["salario", "salário", "salary", "pagamento mensal"] },
  { category: "Freelance", keywords: ["freelance", "freela", "projeto", "honorario", "honorário"] },
  { category: "Rendimentos", keywords: ["rendimento", "dividendo", "juros", "cdb", "tesouro"] },
];

export function suggestCategory(description: string): string | null {
  const text = description.toLowerCase().trim();
  if (!text) return null;
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) return rule.category;
  }
  return null;
}
