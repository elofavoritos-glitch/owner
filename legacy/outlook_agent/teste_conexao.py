"""Teste em duas etapas da conexão delegada Microsoft 365.

Uso:
  python3 teste_conexao.py iniciar
  python3 teste_conexao.py concluir

O device_code fica temporariamente em `.device_login_state.json`, protegido com
permissão 0600 e ignorado pelo Git. O arquivo é apagado ao concluir. Tokens
nunca são exibidos nem gravados no projeto.
"""
from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict
from datetime import date
from pathlib import Path

from auth import DelegatedAuth, DeviceLogin
from calendar_service import OutlookCalendarService
from config import M365Config
from confirmation import ConfirmationStore
from graph_client import GraphClient
from mail_service import OutlookMailService


STATE_PATH = Path(__file__).with_name(".device_login_state.json")


def iniciar() -> None:
    config = M365Config.from_env()
    auth = DelegatedAuth(config)
    login = auth.begin_login()
    payload = asdict(login)
    descriptor = os.open(STATE_PATH, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        json.dump(payload, handle)
    print(login.message)
    print(f"O código expira em aproximadamente {login.expires_in // 60} minutos.")


def concluir() -> None:
    if not STATE_PATH.is_file():
        raise RuntimeError("Não há login pendente. Execute primeiro a etapa iniciar.")
    config = M365Config.from_env()
    payload = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    login = DeviceLogin(**payload)
    auth = DelegatedAuth(config)
    try:
        token = auth.complete_login(login)
        graph = GraphClient(config, auth)
        profile = graph.get(token.user_id, "/me", query={"$select": "id,displayName,mail,userPrincipalName"})
        confirmations = ConfirmationStore(config.confirmation_ttl_seconds)
        mail = OutlookMailService(graph, confirmations)
        calendar = OutlookCalendarService(config, graph, confirmations)
        messages = mail.list_messages(token.user_id, limit=1, include_body=False)
        events = calendar.day_agenda(token.user_id, date.today())
        address = profile.get("mail") or profile.get("userPrincipalName") or "conta identificada"
        print("Autenticação delegada: OK")
        print(f"Usuário: {profile.get('displayName', 'Usuário Microsoft 365')} ({address})")
        print(f"Leitura da caixa: OK ({len(messages)} item consultado no teste)")
        print(f"Leitura da agenda do dia: OK ({len(events)} evento(s))")
        print("Permissões de envio e criação de reunião serão exercidas somente após confirmação humana.")
    finally:
        STATE_PATH.unlink(missing_ok=True)


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    if action == "iniciar":
        iniciar()
    elif action == "concluir":
        concluir()
    else:
        raise SystemExit("Use: python3 teste_conexao.py iniciar|concluir")
