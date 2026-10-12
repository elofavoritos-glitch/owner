#!/usr/bin/env python3
"""
Importador de oportunidades para o Supabase (painel comercial ELO).

Lê um CSV de oportunidades e insere/atualiza na tabela public.oportunidades.
Conecta direto no Postgres do Supabase (service-level), ignorando a RLS — por
isso deve rodar apenas em ambiente controlado (sua máquina / CI), nunca no
cliente.

Uso:
    export SUPABASE_DB_URL="postgresql://postgres.<ref>:<senha>@<host>:5432/postgres?sslmode=require"
    python importar_oportunidades.py caminho/para/oportunidades.csv

Colunas aceitas no CSV (cabeçalho; só `cliente_nome` é obrigatório):
    cliente_nome, responsavel_nome, servico, etapa, status,
    valor_potencial, probabilidade, ultimo_contato, proxima_acao,
    data_proxima_acao, previsao_fechamento, motivo_perda, observacoes

- `etapa`   ∈ Prospecção, Qualificação, Diagnóstico, Cotação, Negociação, Ganho, Perdido
- `status`  ∈ Ativa, Em espera, Ganha, Perdida
- `probabilidade` entre 0 e 1 (ex.: 0.35). Datas no formato AAAA-MM-DD.
"""
import csv
import os
import sys
from decimal import Decimal, InvalidOperation

try:
    import psycopg
except ImportError:
    sys.exit("Instale o driver:  pip install 'psycopg[binary]'")

ETAPAS = {"Prospecção", "Qualificação", "Diagnóstico", "Cotação", "Negociação", "Ganho", "Perdido"}
STATUS = {"Ativa", "Em espera", "Ganha", "Perdida"}

COLS = [
    "cliente_nome", "responsavel_nome", "servico", "etapa", "status",
    "valor_potencial", "probabilidade", "ultimo_contato", "proxima_acao",
    "data_proxima_acao", "previsao_fechamento", "motivo_perda", "observacoes",
]


def limpar(valor):
    v = (valor or "").strip()
    return v or None


def num(valor, padrao="0"):
    v = (valor or "").strip().replace(".", "").replace(",", ".") if valor and "," in valor else (valor or "").strip()
    try:
        return Decimal(v or padrao)
    except InvalidOperation:
        return Decimal(padrao)


def ler_csv(caminho):
    with open(caminho, newline="", encoding="utf-8-sig") as f:
        linhas = list(csv.DictReader(f))
    registros, erros = [], []
    for i, raw in enumerate(linhas, start=2):  # linha 1 = cabeçalho
        linha = {k.strip(): (v if v is not None else "") for k, v in raw.items()}
        cliente = limpar(linha.get("cliente_nome"))
        if not cliente:
            erros.append(f"linha {i}: cliente_nome vazio — ignorada")
            continue
        etapa = limpar(linha.get("etapa")) or "Prospecção"
        if etapa not in ETAPAS:
            erros.append(f"linha {i}: etapa inválida '{etapa}' — usando 'Prospecção'")
            etapa = "Prospecção"
        status = limpar(linha.get("status")) or "Ativa"
        if status not in STATUS:
            erros.append(f"linha {i}: status inválido '{status}' — usando 'Ativa'")
            status = "Ativa"
        prob = num(linha.get("probabilidade"), "0")
        if not (Decimal(0) <= prob <= Decimal(1)):
            prob = max(Decimal(0), min(Decimal(1), prob))
        registros.append({
            "cliente_nome": cliente,
            "responsavel_nome": limpar(linha.get("responsavel_nome")),
            "servico": limpar(linha.get("servico")),
            "etapa": etapa,
            "status": status,
            "valor_potencial": num(linha.get("valor_potencial"), "0"),
            "probabilidade": prob,
            "ultimo_contato": limpar(linha.get("ultimo_contato")),
            "proxima_acao": limpar(linha.get("proxima_acao")),
            "data_proxima_acao": limpar(linha.get("data_proxima_acao")),
            "previsao_fechamento": limpar(linha.get("previsao_fechamento")),
            "motivo_perda": limpar(linha.get("motivo_perda")),
            "observacoes": limpar(linha.get("observacoes")),
        })
    return registros, erros


def inserir(dsn, registros):
    sql = (
        "insert into public.oportunidades "
        "(" + ", ".join(COLS) + ") values (" + ", ".join(f"%({c})s" for c in COLS) + ")"
    )
    with psycopg.connect(dsn) as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.executemany(sql, registros)
        conn.commit()
    return len(registros)


def main():
    if len(sys.argv) != 2:
        sys.exit("Uso: python importar_oportunidades.py <arquivo.csv>")
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        sys.exit("Defina SUPABASE_DB_URL com a connection string do Postgres do Supabase.")
    caminho = sys.argv[1]
    registros, erros = ler_csv(caminho)
    for e in erros:
        print("  aviso:", e)
    if not registros:
        sys.exit("Nenhum registro válido para importar.")
    n = inserir(dsn, registros)
    print(f"OK: {n} oportunidade(s) importada(s) a partir de {caminho}.")


if __name__ == "__main__":
    main()
