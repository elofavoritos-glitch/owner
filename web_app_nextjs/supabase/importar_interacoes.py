#!/usr/bin/env python3
"""
Importador de interações (histórico de relacionamento) para o Supabase.

Lê um CSV e insere na tabela public.interacoes. Roda em ambiente controlado
(sua máquina/CI), nunca no cliente — conecta direto no Postgres.

Uso:
    export SUPABASE_DB_URL="postgresql://postgres.<ref>:<senha>@<host>:5432/postgres?sslmode=require"
    python importar_interacoes.py caminho/para/interacoes.csv

Colunas (cabeçalho; só `empresa` e `data_interacao` são essenciais):
    empresa, responsavel_nome, canal, direcao, assunto, data_interacao, observacao

- canal   ∈ email, ligacao, reuniao, whatsapp, evento, outro   (default: email)
- direcao ∈ enviado, recebido   (recebido = resposta/iniciativa do cliente; default: enviado)
- data_interacao no formato AAAA-MM-DD
"""
import csv
import os
import sys

try:
    import psycopg
except ImportError:
    sys.exit("Instale o driver:  pip install 'psycopg[binary]'")

CANAIS = {"email", "ligacao", "reuniao", "whatsapp", "evento", "outro"}
DIRECOES = {"enviado", "recebido"}
COLS = ["empresa", "responsavel_nome", "canal", "direcao", "assunto", "data_interacao", "observacao"]


def limpar(v):
    v = (v or "").strip()
    return v or None


def ler_csv(caminho):
    with open(caminho, newline="", encoding="utf-8-sig") as f:
        linhas = list(csv.DictReader(f))
    registros, erros = [], []
    for i, raw in enumerate(linhas, start=2):
        linha = {k.strip(): (v if v is not None else "") for k, v in raw.items()}
        empresa = limpar(linha.get("empresa"))
        if not empresa:
            erros.append(f"linha {i}: empresa vazia — ignorada")
            continue
        canal = (limpar(linha.get("canal")) or "email").lower()
        if canal not in CANAIS:
            erros.append(f"linha {i}: canal inválido '{canal}' — usando 'email'")
            canal = "email"
        direcao = (limpar(linha.get("direcao")) or "enviado").lower()
        if direcao not in DIRECOES:
            erros.append(f"linha {i}: direcao inválida '{direcao}' — usando 'enviado'")
            direcao = "enviado"
        data = limpar(linha.get("data_interacao"))
        if not data:
            erros.append(f"linha {i}: data_interacao vazia — ignorada")
            continue
        registros.append({
            "empresa": empresa,
            "responsavel_nome": limpar(linha.get("responsavel_nome")),
            "canal": canal,
            "direcao": direcao,
            "assunto": limpar(linha.get("assunto")),
            "data_interacao": data,
            "observacao": limpar(linha.get("observacao")),
        })
    return registros, erros


def inserir(dsn, registros):
    sql = (
        "insert into public.interacoes (" + ", ".join(COLS) + ") "
        "values (" + ", ".join(f"%({c})s" for c in COLS) + ")"
    )
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.executemany(sql, registros)
        conn.commit()
    return len(registros)


def main():
    if len(sys.argv) != 2:
        sys.exit("Uso: python importar_interacoes.py <arquivo.csv>")
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        sys.exit("Defina SUPABASE_DB_URL com a connection string do Postgres do Supabase.")
    registros, erros = ler_csv(sys.argv[1])
    for e in erros:
        print("  aviso:", e)
    if not registros:
        sys.exit("Nenhum registro válido para importar.")
    n = inserir(dsn, registros)
    print(f"OK: {n} interação(ões) importada(s).")


if __name__ == "__main__":
    main()
