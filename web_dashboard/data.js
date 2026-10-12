/* Dados embutidos (fallback file://). Regerado por gerar_dados.py */
window.ELO_DADOS = {
  "gerado_em": "2026-10-12",
  "demo": true,
  "empresa": "ELO Soluções Logísticas Integradas",
  "painel": {
    "data_base": "2026-10-12",
    "totais": {
      "oportunidades": 8,
      "abertas": 6,
      "ganhas": 1,
      "perdidas": 1,
      "valor_potencial": 350000.0,
      "previsao_ponderada": 167950.0,
      "taxa_conversao_percent": 50.0,
      "pendencias_cadastro": 0
    },
    "por_vendedor": [
      {
        "responsavel": "Bruna",
        "oportunidades": 3,
        "abertas": 3,
        "ganhas": 0,
        "perdidas": 0,
        "em_risco": 0,
        "valor_potencial": 157000.0,
        "valor_ponderado": 61350.0
      },
      {
        "responsavel": "Caio",
        "oportunidades": 2,
        "abertas": 0,
        "ganhas": 1,
        "perdidas": 1,
        "em_risco": 0,
        "valor_potencial": 73000.0,
        "valor_ponderado": 55000.0
      },
      {
        "responsavel": "André",
        "oportunidades": 3,
        "abertas": 3,
        "ganhas": 0,
        "perdidas": 0,
        "em_risco": 1,
        "valor_potencial": 120000.0,
        "valor_ponderado": 51600.0
      }
    ],
    "por_etapa": [
      {
        "etapa": "Prospecção",
        "quantidade": 1,
        "valor_potencial": 25000.0,
        "valor_ponderado": 3750.0
      },
      {
        "etapa": "Qualificação",
        "quantidade": 1,
        "valor_potencial": 40000.0,
        "valor_ponderado": 10000.0
      },
      {
        "etapa": "Diagnóstico",
        "quantidade": 1,
        "valor_potencial": 60000.0,
        "valor_ponderado": 18000.0
      },
      {
        "etapa": "Cotação",
        "quantidade": 1,
        "valor_potencial": 32000.0,
        "valor_ponderado": 12800.0
      },
      {
        "etapa": "Negociação",
        "quantidade": 2,
        "valor_potencial": 120000.0,
        "valor_ponderado": 68400.0
      },
      {
        "etapa": "Ganho",
        "quantidade": 1,
        "valor_potencial": 55000.0,
        "valor_ponderado": 55000.0
      },
      {
        "etapa": "Perdido",
        "quantidade": 1,
        "valor_potencial": 18000.0,
        "valor_ponderado": 0.0
      }
    ],
    "oportunidades_em_risco": [
      {
        "id": "OPP-002",
        "cliente": "Importadora Maré Alta",
        "responsavel": "André",
        "etapa": "Cotação",
        "motivo": "sem próxima ação",
        "valor_potencial": 32000.0
      }
    ],
    "observacao": "Previsão ponderada = soma de (valor potencial x probabilidade). Validar cadastro das oportunidades com pendências."
  },
  "metas": {
    "dia_do_mes": 12,
    "dias_no_mes": 30,
    "ranking": [
      {
        "responsavel": "Caio",
        "realizado": 55000.0,
        "meta": 90000.0,
        "atingimento_percent": 61.1,
        "projecao_fim_mes_percent": 152.8,
        "situacao": "no ritmo (tende a bater)",
        "posicao": 1
      },
      {
        "responsavel": "André",
        "realizado": 60000.0,
        "meta": 100000.0,
        "atingimento_percent": 60.0,
        "projecao_fim_mes_percent": 150.0,
        "situacao": "no ritmo (tende a bater)",
        "posicao": 2
      },
      {
        "responsavel": "Bruna",
        "realizado": 42000.0,
        "meta": 80000.0,
        "atingimento_percent": 52.5,
        "projecao_fim_mes_percent": 131.2,
        "situacao": "no ritmo (tende a bater)",
        "posicao": 3
      }
    ],
    "precisam_de_apoio": [],
    "pendencias": [],
    "observacao": "Projeção simples pelo ritmo do mês; não considera sazonalidade nem pipeline futuro."
  },
  "oportunidades": [
    {
      "id": "OPP-001",
      "cliente": "Transportadora Vale Sul",
      "responsavel": "André",
      "etapa": "Negociação",
      "status": "Ativa",
      "valor_potencial": 48000,
      "probabilidade": 0.6,
      "proxima_acao": "Apresentar proposta",
      "data_proxima_acao": "2026-10-14"
    },
    {
      "id": "OPP-002",
      "cliente": "Importadora Maré Alta",
      "responsavel": "André",
      "etapa": "Cotação",
      "status": "Ativa",
      "valor_potencial": 32000,
      "probabilidade": 0.4,
      "proxima_acao": "",
      "data_proxima_acao": "2026-10-08"
    },
    {
      "id": "OPP-003",
      "cliente": "Indústria Catarinense",
      "responsavel": "Bruna",
      "etapa": "Diagnóstico",
      "status": "Ativa",
      "valor_potencial": 60000,
      "probabilidade": 0.3,
      "proxima_acao": "Visita técnica",
      "data_proxima_acao": "2026-10-16"
    },
    {
      "id": "OPP-004",
      "cliente": "Distribuidora Sul",
      "responsavel": "Bruna",
      "etapa": "Prospecção",
      "status": "Ativa",
      "valor_potencial": 25000,
      "probabilidade": 0.15,
      "proxima_acao": "Qualificar",
      "data_proxima_acao": "2026-10-13"
    },
    {
      "id": "OPP-005",
      "cliente": "Alfa Logística",
      "responsavel": "Caio",
      "etapa": "Ganho",
      "status": "Ganha",
      "valor_potencial": 55000,
      "probabilidade": 1
    },
    {
      "id": "OPP-006",
      "cliente": "Beta Comércio",
      "responsavel": "Caio",
      "etapa": "Perdido",
      "status": "Perdida",
      "valor_potencial": 18000,
      "probabilidade": 0,
      "motivo_perda": "preço"
    },
    {
      "id": "OPP-007",
      "cliente": "Gama Importação",
      "responsavel": "André",
      "etapa": "Qualificação",
      "status": "Ativa",
      "valor_potencial": 40000,
      "probabilidade": 0.25,
      "proxima_acao": "Enviar material",
      "data_proxima_acao": "2026-10-15"
    },
    {
      "id": "OPP-008",
      "cliente": "Delta Varejo",
      "responsavel": "Bruna",
      "etapa": "Negociação",
      "status": "Ativa",
      "valor_potencial": 72000,
      "probabilidade": 0.55,
      "proxima_acao": "Revisar condições",
      "data_proxima_acao": "2026-10-12"
    }
  ],
  "evolucao_mensal": [
    {
      "mes": "Mai",
      "ganho": 85000,
      "proposto": 180000
    },
    {
      "mes": "Jun",
      "ganho": 92000,
      "proposto": 210000
    },
    {
      "mes": "Jul",
      "ganho": 78000,
      "proposto": 165000
    },
    {
      "mes": "Ago",
      "ganho": 110000,
      "proposto": 240000
    },
    {
      "mes": "Set",
      "ganho": 134000,
      "proposto": 260000
    },
    {
      "mes": "Out",
      "ganho": 157000,
      "proposto": 290000
    }
  ],
  "produtividade": [
    {
      "responsavel": "André",
      "ligacoes": 48,
      "reunioes": 9,
      "propostas": 6,
      "ganhos": 2
    },
    {
      "responsavel": "Bruna",
      "ligacoes": 41,
      "reunioes": 7,
      "propostas": 5,
      "ganhos": 1
    },
    {
      "responsavel": "Caio",
      "ligacoes": 35,
      "reunioes": 6,
      "propostas": 4,
      "ganhos": 2
    }
  ]
};
