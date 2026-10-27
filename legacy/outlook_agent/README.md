# Especialista Outlook Microsoft 365 — ELO

Conector Microsoft Graph para cerca de 40 comerciais, cada um autenticando a própria conta Microsoft 365.

## Recursos

- Leitura completa e pesquisa de mensagens;
- Resumo diário de urgentes, não lidos e compromissos;
- Rascunhos com anexos;
- Envio somente após confirmação humana vinculada ao conteúdo;
- Agenda do dia via `calendarView`;
- Reuniões Outlook/Teams após confirmação;
- Retry seguro para leitura e respeito a `Retry-After`;
- Endpoints exclusivamente `/me/...`.

## Configuração

Siga `ENTRA_SETUP.md` e copie os identificadores de `.env.example` para variáveis protegidas. Não há senha nem client secret no código.

## Uso básico em Python

```python
from config import M365Config
from auth import DelegatedAuth
from graph_client import GraphClient
from confirmation import ConfirmationStore
from mail_service import OutlookMailService
from calendar_service import OutlookCalendarService
from digest_service import DailyDigestService

config = M365Config.from_env()
auth = DelegatedAuth(config)
login = auth.begin_login()
print(login.message)  # o usuário autentica diretamente na Microsoft
user_token = auth.complete_login(login)

graph = GraphClient(config, auth)
confirmations = ConfirmationStore(config.confirmation_ttl_seconds)
mail = OutlookMailService(graph, confirmations)
calendar = OutlookCalendarService(config, graph, confirmations)
digest = DailyDigestService(mail, calendar)

resumo = digest.build(user_token.user_id)
```

## Envio seguro

1. `create_draft(...)`;
2. mostrar a prévia completa ao usuário;
3. `request_send_confirmation(...)`;
4. receber confirmação explícita;
5. `send_confirmed(...)`.

Se o conteúdo mudar, a confirmação expira. O POST de envio não é repetido automaticamente.

## Produção

O `MemoryTokenStore` perde sessões ao reiniciar. Para 40 usuários, implemente armazenamento criptografado usando Azure Key Vault ou banco protegido e uma fila de jobs por usuário. Faça piloto antes da liberação geral.
