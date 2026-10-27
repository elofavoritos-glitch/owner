// Configuração do agente comercial da ELO para o chat (Claude / Anthropic).
// System prompt baseado nas regras do agente de inteligência comercial
// (legacy/elo-inteligencia-comercial-logistica.md) + definição das ferramentas que
// expõem a inteligência determinística (lib/elo-intelligence.ts).
import type OpenAI from "openai";
import { ROTEIRO_DIAGNOSTICO } from "./elo-intelligence";

// O SYSTEM_PROMPT foi fatiado em módulos em ./prompts (comercial + Senior ERP).
// Re-exportado aqui para manter a API pública deste arquivo inalterada.
export { SYSTEM_PROMPT } from "./prompts";

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
