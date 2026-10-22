// Tradução de texto para o assistente comercial da ELO (PT ⇄ ES e outros).
// Usa a mesma API da Groq (compatível com OpenAI) já empregada no chat.
// Útil para e-mails/propostas/mensagens com clientes e fornecedores do Mercosul.
import OpenAI from "openai";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const IDIOMAS: Record<string, string> = {
  es: "espanhol", espanhol: "espanhol", "español": "espanhol",
  pt: "português do Brasil", portugues: "português do Brasil", "português": "português do Brasil",
  en: "inglês", ingles: "inglês", "inglês": "inglês", english: "inglês",
};

// Traduz `texto` para o idioma de destino. Retorna { traducao } ou { erro }.
export async function traduzir(
  textoOriginal: string,
  idiomaDestino: string,
): Promise<Record<string, unknown>> {
  const conteudo = String(textoOriginal ?? "").trim();
  if (!conteudo) return { erro: "Informe o texto a traduzir." };
  if (conteudo.length > 6000) return { erro: "Texto muito longo (máx. 6000 caracteres)." };

  const alvo = IDIOMAS[String(idiomaDestino ?? "").toLowerCase().trim()] || String(idiomaDestino || "espanhol");

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { erro: "Tradução indisponível (GROQ_API_KEY não configurada)." };

  const client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
  try {
    const resp = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 2000,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            `Você é um tradutor profissional especializado em comunicação comercial e logística. ` +
            `Traduza o texto do usuário para ${alvo}. Mantenha o tom, a formatação e os termos técnicos ` +
            `(logística, comércio exterior, armazenagem, transporte). Preserve nomes próprios, números, ` +
            `CNPJ e valores. Responda APENAS com a tradução, sem comentários, aspas ou explicações.`,
        },
        { role: "user", content: conteudo },
      ],
    });
    const traducao = (resp.choices[0]?.message?.content ?? "").trim();
    if (!traducao) return { erro: "Não foi possível traduzir o texto." };
    return { idioma_destino: alvo, traducao, fonte: "Tradução automática (revise antes de enviar ao cliente)" };
  } catch (e) {
    const status = e instanceof OpenAI.APIError ? e.status : undefined;
    if (status === 429) return { erro: "Limite de requisições atingido. Tente em instantes." };
    return { erro: "Falha ao traduzir o texto." };
  }
}
