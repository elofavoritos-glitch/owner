// Configuração do agente comercial da ELO para o chat (Claude / Anthropic).
// System prompt baseado nas regras do agente de inteligência comercial
// (elo-inteligencia-comercial-logistica.md) + definição das ferramentas que
// expõem a inteligência determinística (lib/elo-intelligence.ts).
import type OpenAI from "openai";
import { EMPRESA, ICP, PESOS_SCORE, ROTEIRO_DIAGNOSTICO } from "./elo-intelligence";

export const SYSTEM_PROMPT = `Você é o **assistente de inteligência e capitalização comercial da ELO Soluções Logísticas Integradas** (Itajaí/SC). Ajuda o time comercial a descobrir, qualificar, priorizar e abordar empresas com potencial para **armazenagem** e **transporte rodoviário**.

## Estilo de resposta (IMPORTANTE)
Responda de forma RESUMIDA — curta a média (as respostas também são lidas em voz alta). Padrão: 2 a 5 frases, ou um parágrafo curto. Vá direto ao ponto, sem rodeios nem repetir a pergunta. Evite listas longas e blocos de JSON na resposta final; traduza os números em linguagem simples (ex.: "Score 72, prioridade alta — recomendo agendar diagnóstico"). Quando o tema exigir mais detalhe, dê o resumo primeiro e ofereça aprofundar ("quer que eu detalhe?"). Nunca invente dados.

## Serviços vendidos pela ELO
- Armazenagem
- Transporte rodoviário
- Solução integrada (armazenagem + transporte)
Todo score, diagnóstico e recomendação giram em torno desses serviços.

## O que você faz
1. Responde dúvidas comerciais do time em conversa livre, em português do Brasil.
2. Conduz diagnóstico logístico guiado quando o comercial quer avaliar uma empresa.
3. Calcula score de oportunidade (0–100) explicável, usando as ferramentas.
4. Recomenda serviços (armazenagem, transporte ou solução integrada).
5. Monta dossiê pré-reunião com a próxima melhor ação.
6. Consulta o funil de oportunidades real da ELO (banco de dados) quando perguntado sobre clientes, pipeline, valores ou etapas.
7. Responde "já falamos com essa empresa? qual o estágio do relacionamento?" consultando o histórico de interações registrado (ligações, e-mails, reuniões).
8. Registra interações no histórico quando o comercial relatar um contato (ex.: "liguei para a empresa X", "tivemos reunião com Y").
9. Gera propostas comerciais em PDF quando o comercial pedir, usando os itens e valores informados por ele.
9.1 Gera apresentações em PowerPoint (.pptx) com a identidade da ELO quando o comercial pedir slides/apresentação.
10. Apoio operacional logístico: consulta o clima de uma cidade, informações dos principais aeroportos do Brasil e calcula rota/distância/tempo entre origem e destino (caminhão).
11. Inteligência de comércio exterior (Logcomex): consulta importadores de um produto por NCM — útil para prospectar potenciais clientes com atividade de importação (público-alvo da ELO para armazenagem e transporte).
12. Inteligência de empresas (Econodata): prospecta empresas brasileiras por filtros (UF, cidade, porte, setor, CNAE, palavras-chave, faturamento, nº de funcionários), dimensiona o tamanho de um mercado, consulta/enriquece uma empresa por CNPJ/site/e-mail, descobre a empresa por nome+UF e mapeia os decisores (quem decide) de uma empresa. É a principal fonte para montar listas de leads qualificados.
13. Tradução de textos (PT ⇄ ES e outros idiomas) para comunicação com clientes e fornecedores do Mercosul.
14. Cadastro automático de cliente a partir da Econodata (consulta o CNPJ e preenche os dados).
15. Briefing do dia: resumo das próximas ações e follow-ups pendentes do comercial.
16. Qualificação de lead: cruza os dados da Econodata com o ICP da ELO e gera um score de oportunidade explicável.

## Regras OBRIGATÓRIAS (seguir sempre)
1. **Nunca invente** CNPJ, contato, volume, preço, operação, importação ou histórico. Sem evidência, o critério fica pendente e com nota zero.
2. Toda informação deve indicar a fonte sempre que possível. Diferencie dado confirmado, estimativa e pendência.
3. Não faça prospecção automática em massa nem sugira envio de e-mail sem confirmação humana explícita.
4. Use apenas dados públicos, do banco de dados da ELO, ou informados pelo comercial. Respeite a LGPD e minimize dados pessoais.
5. Português do Brasil. Datas no formato dd/mm/aaaa. Moeda no formato R$ 1.234,56.
6. Seja objetivo e acionável: ao final de uma análise, deixe claro a próxima melhor ação e o que ainda precisa ser confirmado.

## Aja com eficiência (MUITO IMPORTANTE)
- **Quando o comercial já deu as informações necessárias, EXECUTE a ferramenta imediatamente — não peça confirmação nem repita perguntas.** Ex.: "qualifique o CNPJ X", "cadastre a empresa Y", "gere a apresentação com estes slides" → chame a ferramenta direto.
- **Só peça confirmação prévia (uma linha curta) para ações que mandam mensagem para fora ou gravam contato/histórico:** enviar e-mail, registrar interação e prospecção em massa. Para o resto — qualificar, consultar, dimensionar, cadastrar cliente, gerar proposta/apresentação, traduzir — NÃO peça confirmação: faça e depois mostre o resultado (essas ações são reversíveis).
- **Não re-pergunte o que já foi dito ou já existe.** Se o comercial pediu uma ação sobre uma empresa, assuma os dados que ele deu. Se a ferramenta precisar de um cliente no cadastro e ele não existir, a própria ferramenta avisa — só então oriente a cadastrar; não pergunte "ela está cadastrada?" antes de tentar.
- **Não faça a mesma pergunta duas vezes.** Se faltar UM dado essencial, pergunte só esse, de forma objetiva, e siga.
- Faltou um detalhe menor para uma proposta/apresentação? Gere com o que tem (slide mais enxuto) em vez de travar pedindo mais — e ofereça ajustar depois.
- Prefira respostas curtas. Chame as ferramentas em vez de descrever o que "poderia" fazer.

## Como usar as ferramentas
- Para avaliar uma empresa específica, prefira **montar_dossie** (consolida diagnóstico + score + próxima ação). Peça ao comercial as respostas do diagnóstico quando não as tiver — não presuma.
- Use **consultar_oportunidades** para perguntas sobre o funil/pipeline, clientes cadastrados, valores e etapas.
- Use **consultar_relacionamento** para saber se a ELO já abordou uma empresa e em qual estágio está (nunca abordada, contatado sem resposta, esfriado, ativo). Útil antes de uma abordagem.
- Use **registrar_interacao** quando o comercial relatar um contato ocorrido (ligação, e-mail, reunião, etc.). Extraia empresa, canal, direção (quem iniciou: 'enviado' = nós contatamos; 'recebido' = o cliente respondeu/procurou), assunto e observação. Antes de gravar, CONFIRME em uma frase o que entendeu; só registre dados que o comercial informou — nunca invente empresa, data ou conteúdo. Depois de registrar, confirme o que foi salvo.
- Use **consultar_clima** para previsão do tempo de uma cidade (útil para planejar entregas/armazenagem). **consultar_aeroportos** para dados dos principais aeroportos do Brasil (código IATA, cidade, observações) — é base de referência, não status de voos ao vivo. **calcular_rota** para distância e tempo estimado de caminhão entre dois locais (não considera trânsito em tempo real).
- Use **gerar_proposta** quando o comercial pedir uma proposta/PDF para um cliente. Gere DIRETO, sem pedir confirmação. Monte os itens (descrição, quantidade, valor_unitario) APENAS com os valores que o comercial informar — item sem valor entra como "a definir" e não soma. Nunca invente preços. Se o cliente não estiver no cadastro, a ferramenta avisa — aí oriente a cadastrar. Ao concluir, informe o link de download.
- Use **gerar_apresentacao** quando o comercial pedir uma apresentação/slides/PPT para um cliente. Estruture os slides com o que ele informar: um slide de capa (titulo + subtitulo, capa:true) e slides de conteúdo com bullets objetivos. Gere DIRETO, sem pedir confirmação; se faltar um detalhe menor, deixe o slide mais enxuto em vez de travar. Não invente dados (preços, volumes). Se o cliente não estiver no cadastro, a ferramenta avisa — aí oriente a cadastrar. Ao concluir, informe o link de download.
- Use **calcular_score** quando já houver evidências estruturadas, ou **analisar_diagnostico** para transformar respostas de diagnóstico em evidências e recomendações.
- **Econodata — prospecção e inteligência de empresas:**
  - **econodata_prospectar**: monta lista de leads por filtros (UF, cidade, porte, setor, CNAE, palavras-chave no nome, com telefone/e-mail, faixa de funcionários/faturamento). Use quando o comercial quiser ENCONTRAR empresas novas que se encaixam no ICP da ELO.
  - **econodata_dimensionar_mercado**: devolve só a CONTAGEM de empresas de um recorte (TAM), é a opção barata. SEMPRE prefira dimensionar antes de prospectar listas grandes, para o comercial saber o tamanho e não gastar tokens à toa. Sugira: "são X empresas nesse recorte; quer que eu traga as primeiras?".
  - **econodata_consultar_empresa**: consulta/enriquece UMA empresa por CNPJ, site ou e-mail (cadastro, porte, comércio exterior, dívidas, NCM, contatos). Use para qualificar um lead ou completar o cadastro.
  - **econodata_match**: descobre a empresa (e o CNPJ) quando o comercial só tem o NOME + UF (ou site/telefone/e-mail). Depois, se precisar de mais dados, consulte por CNPJ.
  - **econodata_decisores**: lista os decisores (ou colaboradores) de uma empresa pelo CNPJ — para achar QUEM decide e abordar a pessoa certa. Lembre o comercial do uso responsável (LGPD).
  - **econodata_saldo**: saldo de tokens da conta Econodata (grátis). Use se o comercial perguntar sobre consumo/saldo.
  - **econodata_estimar_custo**: orça em tokens quanto custaria uma consulta (de empresa ou de mercado) ANTES de gastar — é GRÁTIS e funciona mesmo sem saldo. Use quando o comercial perguntar "quanto custaria" ou quiser planejar o consumo. Se uma consulta paga falhar por saldo (402), você pode oferecer estimar o custo com esta ferramenta.
- Use **traduzir** para verter e-mails, propostas ou mensagens para espanhol (padrão) ou outro idioma. Ao entregar a tradução, lembre que é automática e vale revisar antes de enviar ao cliente.
- Use **cadastrar_cliente_econodata** quando o comercial pedir para salvar no cadastro uma empresa (ex.: "cadastre o CNPJ X") — ela é consultada na Econodata pelo CNPJ e os dados são preenchidos. Cadastre DIRETO (ação reversível, com dedup por CNPJ) e informe o que foi salvo; não peça confirmação antes.
- Use **briefing_do_dia** quando o comercial pedir o resumo do dia / por onde começar: traz próximas ações vencidas ou de hoje e follow-ups pendentes.
- Use **qualificar_lead** quando o comercial quiser saber se uma empresa vale a pena: cruza os dados da Econodata (porte, região, setor, comércio exterior) com o ICP da ELO e devolve o score. Explique o score e a próxima ação em linguagem simples.
  - A Econodata cobra em tokens; cada resultado traz 'tokens_cobrados'. Não mencione tokens em toda resposta, só quando o comercial perguntar sobre custo/saldo. Se a consulta falhar por produto não liberado/chave trial (403) ou saldo (402), explique em linguagem simples e não insista.
- Sempre explique o resultado em linguagem natural para o comercial; não despeje apenas JSON.

## Perfil de cliente ideal (ICP) da ELO
Segmentos: ${ICP.segmentos_prioritarios.join(", ")}.
Regiões: ${ICP.regioes_prioritarias.join(", ")}.

## Pesos do score (somam 100)
${Object.entries(PESOS_SCORE).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Empresa: ${EMPRESA.nome} — ${EMPRESA.posicionamento} (${EMPRESA.cidade}).`;

export const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "montar_dossie",
      description:
        "Monta o dossiê pré-reunião de uma empresa: consolida diagnóstico, score de oportunidade (0-100), serviços recomendados e a próxima melhor ação. Use quando o comercial quer avaliar/abordar uma empresa específica.",
      parameters: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Nome da empresa a ser avaliada." },
          respostas_diagnostico: {
            type: "object",
            description:
              "Respostas do diagnóstico logístico. Chaves possíveis: " +
              ROTEIRO_DIAGNOSTICO.map((r) => r.chave).join(", ") +
              ". Para precisa_armazenagem/precisa_transporte/importacao use 'sim' ou 'não'. Informe apenas o que o comercial souber; não invente.",
          },
          relacionamento: {
            type: "object",
            description: "Opcional. Histórico de relacionamento, se conhecido.",
            properties: {
              total_mensagens: { type: "number" },
              houve_resposta_cliente: { type: "boolean" },
              estagio: { type: "string" },
            },
          },
        },
        required: ["empresa"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analisar_diagnostico",
      description:
        "Transforma as respostas de um diagnóstico logístico em serviços recomendados, evidências para o score e pendências. Use para orientar quais perguntas ainda faltam.",
      parameters: {
        type: "object",
        properties: {
          respostas: {
            type: "object",
            description: "Respostas do diagnóstico. Chaves: " + ROTEIRO_DIAGNOSTICO.map((r) => r.chave).join(", ") + ".",
          },
        },
        required: ["respostas"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_interacao",
      description:
        "Registra uma interação ocorrida com uma empresa no histórico de relacionamento (ligação, e-mail, reunião, etc.). Use quando o comercial relatar um contato. Não invente dados; registre apenas o que foi informado.",
      parameters: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Nome da empresa contatada." },
          canal: {
            type: "string",
            enum: ["email", "ligacao", "reuniao", "whatsapp", "evento", "outro"],
            description: "Meio do contato.",
          },
          direcao: {
            type: "string",
            enum: ["enviado", "recebido"],
            description: "'enviado' = a ELO contatou; 'recebido' = o cliente respondeu/procurou.",
          },
          assunto: { type: "string", description: "Assunto curto do contato." },
          observacao: { type: "string", description: "Detalhes/relato do contato." },
          data_interacao: { type: "string", description: "Data no formato AAAA-MM-DD. Se não informada, usa hoje." },
        },
        required: ["empresa"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_proposta",
      description:
        "Gera uma proposta comercial em PDF para um cliente (que deve existir no cadastro) e salva nos documentos dele. Use quando o comercial pedir uma proposta. Nunca invente valores: item sem valor_unitario entra como 'a definir'.",
      parameters: {
        type: "object",
        properties: {
          cliente: { type: "string", description: "Nome do cliente (deve existir no cadastro)." },
          itens: {
            type: "array",
            description: "Itens da proposta.",
            items: {
              type: "object",
              properties: {
                descricao: { type: "string", description: "Descrição do item/serviço." },
                quantidade: { type: "number", description: "Quantidade (padrão 1)." },
                valor_unitario: { type: "number", description: "Valor unitário em reais. Omita se não informado." },
              },
              required: ["descricao"],
            },
          },
          condicoes: { type: "string", description: "Condições comerciais (opcional)." },
          validade_dias: { type: "number", description: "Validade da proposta em dias (padrão 15)." },
        },
        required: ["cliente", "itens"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_apresentacao",
      description:
        "Gera uma apresentação PowerPoint (.pptx) 16:9 com a identidade da ELO e salva nos documentos de um cliente (que deve existir no cadastro). Use quando o comercial pedir uma apresentação/slides/PPT. Monte os slides a partir do que o comercial informar; não invente dados (preços, volumes). O primeiro slide pode ser capa.",
      parameters: {
        type: "object",
        properties: {
          cliente: { type: "string", description: "Nome do cliente (deve existir no cadastro). A apresentação é salva nos documentos dele." },
          titulo: { type: "string", description: "Título da apresentação (usado na capa se nenhum slide de capa for informado)." },
          slides: {
            type: "array",
            description: "Slides da apresentação, em ordem.",
            items: {
              type: "object",
              properties: {
                titulo: { type: "string", description: "Título do slide." },
                subtitulo: { type: "string", description: "Subtítulo opcional." },
                bullets: { type: "array", items: { type: "string" }, description: "Tópicos do slide (um por item)." },
                capa: { type: "boolean", description: "true para slide de capa (fundo azul, sem bullets)." },
              },
              required: ["titulo"],
            },
          },
        },
        required: ["cliente", "slides"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_comex",
      description:
        "Consulta importações de um produto por NCM (Logcomex NCM Intel) e retorna os principais importadores — potenciais clientes com atividade de comércio exterior. Use quando o comercial quiser prospectar empresas que importam determinado produto.",
      parameters: {
        type: "object",
        properties: {
          ncm: { type: "string", description: "Código NCM do produto (só números, ex.: 39031120)." },
          periodos: {
            type: "array",
            items: { type: "number" },
            description: "Opcional. Meses no formato AAAAMM (ex.: 202402). Padrão: últimos 12 meses.",
          },
        },
        required: ["ncm"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "econodata_dimensionar_mercado",
      description:
        "Econodata: conta quantas empresas existem num recorte de mercado (TAM), sem listar — é a opção barata. Use ANTES de prospectar listas, para dimensionar o mercado e evitar gasto desnecessário.",
      parameters: {
        type: "object",
        properties: {
          uf: { type: "array", items: { type: "string" }, description: "Siglas de estados (ex.: ['SC','PR'])." },
          cidade: { type: "array", items: { type: "string" }, description: "Cidades (ex.: ['Itajaí'])." },
          porte: {
            type: "array",
            items: { type: "string", enum: ["INDIVIDUAL", "MICRO", "PEQUENO", "MEDIO", "GRANDE"] },
            description: "Porte das empresas.",
          },
          setores: { type: "array", items: { type: "string" }, description: "Setores de atuação (linguagem de negócio)." },
          cnaePrimario: { type: "array", items: { type: "string" }, description: "Códigos CNAE (completo ou prefixo)." },
          palavrasChave: {
            type: "object",
            description: "Termos no nome/produtos da empresa.",
            properties: {
              incluir: { type: "array", items: { type: "string" } },
              excluir: { type: "array", items: { type: "string" } },
              em: { type: "array", items: { type: "string", enum: ["NOME_EMPRESA", "PRODUTOS_SERVICOS"] } },
            },
          },
          comTelefones: { type: "boolean", description: "Só empresas com telefone." },
          comEmailsValidados: { type: "boolean", description: "Só empresas com e-mail validado." },
          funcionarios: {
            type: "object",
            properties: { de: { type: "number" }, ate: { type: "number" } },
            description: "Faixa de número de funcionários.",
          },
          faturamento: {
            type: "object",
            properties: { de: { type: "number" }, ate: { type: "number" } },
            description: "Faixa de faturamento anual em reais.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "econodata_prospectar",
      description:
        "Econodata: monta uma lista de empresas (leads) que casam com os filtros do ICP da ELO. Use para ENCONTRAR empresas novas para prospectar. Prefira dimensionar o mercado antes se o recorte puder ser muito grande. Para a próxima página, reenvie os mesmos filtros com o cursor.",
      parameters: {
        type: "object",
        properties: {
          uf: { type: "array", items: { type: "string" }, description: "Siglas de estados (ex.: ['SC','PR'])." },
          cidade: { type: "array", items: { type: "string" }, description: "Cidades." },
          porte: {
            type: "array",
            items: { type: "string", enum: ["INDIVIDUAL", "MICRO", "PEQUENO", "MEDIO", "GRANDE"] },
            description: "Porte das empresas.",
          },
          setores: { type: "array", items: { type: "string" }, description: "Setores de atuação." },
          cnaePrimario: { type: "array", items: { type: "string" }, description: "Códigos CNAE (completo ou prefixo)." },
          palavrasChave: {
            type: "object",
            properties: {
              incluir: { type: "array", items: { type: "string" } },
              excluir: { type: "array", items: { type: "string" } },
              em: { type: "array", items: { type: "string", enum: ["NOME_EMPRESA", "PRODUTOS_SERVICOS"] } },
            },
          },
          comTelefones: { type: "boolean", description: "Só empresas com telefone." },
          comEmailsValidados: { type: "boolean", description: "Só empresas com e-mail validado." },
          funcionarios: { type: "object", properties: { de: { type: "number" }, ate: { type: "number" } } },
          faturamento: { type: "object", properties: { de: { type: "number" }, ate: { type: "number" } } },
          tamanho: { type: "number", description: "Quantas empresas trazer (1 a 100, padrão 20)." },
          cursor: { type: ["string", "null"], description: "Cursor da página anterior (para paginar). Opcional; use null na primeira página." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "econodata_consultar_empresa",
      description:
        "Econodata: consulta e enriquece UMA empresa por CNPJ, site ou e-mail (cadastro, porte, comércio exterior, dívidas, NCM, contatos). Use para qualificar um lead específico ou completar o cadastro.",
      parameters: {
        type: "object",
        properties: {
          cnpj: { type: "string", description: "CNPJ da empresa (com ou sem máscara)." },
          site: { type: "string", description: "Domínio/site da empresa." },
          email: { type: "string", description: "E-mail da empresa." },
          incluir: {
            type: "array",
            items: { type: "string", enum: ["cadastro", "estrategico", "perfilNegocio", "contatosBasicos", "contatosAvancados"] },
            description: "Blocos de dados a trazer. Padrão: cadastro + perfilNegocio.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "econodata_match",
      description:
        "Econodata: descobre a empresa (e o CNPJ) a partir de dados parciais — tipicamente NOME + UF, ou site/telefone/e-mail — quando o comercial não tem o CNPJ. Retorna os melhores candidatos.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome/razão social (parcial) da empresa." },
          uf: { type: "string", description: "Sigla do estado (ajuda a desambiguar)." },
          site: { type: "string" },
          email: { type: "string" },
          telefone: { type: "string" },
          cnpj: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "econodata_decisores",
      description:
        "Econodata: lista os decisores (ou colaboradores) de uma empresa pelo CNPJ — para achar quem decide e abordar a pessoa certa. Dados pessoais: lembrar o comercial do uso responsável (LGPD).",
      parameters: {
        type: "object",
        properties: {
          cnpj: { type: "string", description: "CNPJ da empresa (14 dígitos)." },
          papel: { type: "string", enum: ["decisores", "colaboradores"], description: "Padrão: decisores." },
          tamanho: { type: "number", description: "Quantas pessoas trazer (1 a 100, padrão 20)." },
        },
        required: ["cnpj"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "econodata_saldo",
      description: "Econodata: saldo de tokens da conta (grátis). Use se o comercial perguntar sobre consumo/saldo da Econodata.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "econodata_estimar_custo",
      description:
        "Econodata: estima o custo em tokens de uma consulta ANTES de gastar (dry-run, GRÁTIS — funciona mesmo com saldo zero). Informe um identificador (cnpj/site/email) para orçar a consulta de UMA empresa, OU filtros de mercado para orçar a contagem/prospecção. Use quando o comercial perguntar 'quanto custaria' ou quiser planejar o consumo.",
      parameters: {
        type: "object",
        properties: {
          cnpj: { type: "string", description: "CNPJ (orça a consulta de 1 empresa)." },
          site: { type: "string", description: "Site da empresa (orça a consulta de 1 empresa)." },
          email: { type: "string", description: "E-mail da empresa (orça a consulta de 1 empresa)." },
          incluir: {
            type: "array",
            items: { type: "string", enum: ["cadastro", "estrategico", "perfilNegocio", "contatosBasicos", "contatosAvancados"] },
            description: "Blocos a considerar na estimativa da empresa. Padrão: cadastro + perfilNegocio.",
          },
          uf: { type: "array", items: { type: "string" }, description: "Filtro de mercado: estados." },
          cidade: { type: "array", items: { type: "string" }, description: "Filtro de mercado: cidades." },
          porte: {
            type: "array",
            items: { type: "string", enum: ["INDIVIDUAL", "MICRO", "PEQUENO", "MEDIO", "GRANDE"] },
            description: "Filtro de mercado: porte.",
          },
          setores: { type: "array", items: { type: "string" }, description: "Filtro de mercado: setores." },
          cnaePrimario: { type: "array", items: { type: "string" }, description: "Filtro de mercado: CNAE." },
          comTelefones: { type: "boolean", description: "Filtro de mercado: só com telefone." },
          tamanho: { type: "number", description: "Se informado com filtros, estima o custo de UMA página de prospecção desse tamanho; sem ele, estima a contagem (mais barata)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "traduzir",
      description:
        "Traduz um texto para outro idioma (padrão espanhol) — útil para e-mails, propostas e mensagens com clientes/fornecedores do Mercosul. Use quando o comercial pedir para traduzir algo ou escrever em outro idioma.",
      parameters: {
        type: "object",
        properties: {
          texto: { type: "string", description: "Texto a traduzir." },
          idioma_destino: { type: "string", description: "Idioma de destino (ex.: espanhol, português, inglês). Padrão: espanhol." },
        },
        required: ["texto"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cadastrar_cliente_econodata",
      description:
        "Cadastra uma empresa no cadastro de clientes da ELO a partir dos dados da Econodata (consulta o CNPJ e preenche razão social, cidade, UF, telefone e porte automaticamente). Use quando o comercial disser para cadastrar/salvar uma empresa que encontrou na prospecção. CONFIRME com o comercial antes de cadastrar.",
      parameters: {
        type: "object",
        properties: {
          cnpj: { type: "string", description: "CNPJ da empresa a cadastrar (será consultada na Econodata)." },
          segmento: { type: "string", description: "Opcional. Segmento/setor, se o comercial informar." },
          observacoes: { type: "string", description: "Opcional. Observações do comercial." },
        },
        required: ["cnpj"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "briefing_do_dia",
      description:
        "Monta o resumo do dia para o comercial: oportunidades com próxima ação vencida ou para hoje, e empresas sem contato há muito tempo (follow-up pendente). Use quando o comercial perguntar 'o que tenho para hoje?', 'meu resumo', 'por onde começo?'.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "qualificar_lead",
      description:
        "Qualifica uma empresa como lead da ELO: consulta a Econodata pelo CNPJ e cruza porte, região (SC/PR/RS), setor e comércio exterior com o perfil de cliente ideal (ICP), devolvendo um score de oportunidade (0-100) explicável. Use quando o comercial quiser saber se uma empresa vale a pena prospectar.",
      parameters: {
        type: "object",
        properties: {
          cnpj: { type: "string", description: "CNPJ da empresa a qualificar (será consultada na Econodata)." },
        },
        required: ["cnpj"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_clima",
      description: "Previsão do tempo de uma cidade brasileira (atual + próximos dias). Útil para planejar entregas e armazenagem.",
      parameters: {
        type: "object",
        properties: {
          cidade: { type: "string", description: "Nome da cidade (ex.: Itajaí, Curitiba)." },
          dias: { type: "number", description: "Quantos dias de previsão (1 a 7, padrão 3)." },
        },
        required: ["cidade"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_aeroportos",
      description: "Informações dos principais aeroportos do Brasil (código IATA, cidade, estado, observações). Base de referência — não é status de voos ao vivo.",
      parameters: {
        type: "object",
        properties: {
          busca: { type: "string", description: "Opcional. Filtra por código IATA (ex.: GRU), cidade, UF ou nome. Vazio lista os principais." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calcular_rota",
      description: "Calcula distância (km) e tempo estimado de caminhão entre origem e destino no Brasil. Não considera trânsito em tempo real.",
      parameters: {
        type: "object",
        properties: {
          origem: { type: "string", description: "Local de origem (cidade/UF ou endereço)." },
          destino: { type: "string", description: "Local de destino (cidade/UF ou endereço)." },
        },
        required: ["origem", "destino"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_relacionamento",
      description:
        "Verifica o histórico de relacionamento da ELO com uma empresa (ligações, e-mails, reuniões registrados) e classifica o estágio: 'nunca abordada', 'contatado sem resposta', 'esfriado (reativar)' ou 'ativo'. Use antes de uma abordagem para saber se já houve contato e qual a próxima ação.",
      parameters: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Nome (ou parte do nome) da empresa a investigar." },
        },
        required: ["empresa"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_oportunidades",
      description:
        "Consulta o funil de oportunidades real da ELO no banco de dados (respeitando as permissões do usuário logado). Use para perguntas sobre clientes cadastrados, pipeline, valores potenciais, etapas e responsáveis.",
      parameters: {
        type: "object",
        properties: {
          filtro_cliente: {
            type: "string",
            description: "Opcional. Filtra oportunidades cujo nome do cliente contém este texto.",
          },
          etapa: {
            type: "string",
            description:
              "Opcional. Filtra por etapa: Prospecção, Qualificação, Diagnóstico, Cotação, Negociação, Ganho, Perdido.",
          },
        },
      },
    },
  },
];
