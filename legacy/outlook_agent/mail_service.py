"""Leitura completa, rascunhos e envio confirmado pelo Outlook Microsoft 365."""
from __future__ import annotations

import base64
import mimetypes
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from confirmation import ConfirmationStore
from graph_client import GraphClient


MAX_SIMPLE_ATTACHMENT = 3 * 1024 * 1024


def _recipient(address: str) -> dict:
    cleaned = address.strip()
    if "@" not in cleaned or cleaned.startswith("@") or cleaned.endswith("@"):
        raise ValueError(f"Endereço de e-mail inválido: {address!r}")
    return {"emailAddress": {"address": cleaned}}


def _addresses(values: Iterable[str]) -> list:
    return [_recipient(value) for value in values if str(value).strip()]


class OutlookMailService:
    def __init__(self, graph: GraphClient, confirmations: ConfirmationStore) -> None:
        self.graph = graph
        self.confirmations = confirmations

    def list_messages(
        self,
        user_id: str,
        *,
        folder: str = "inbox",
        limit: int = 100,
        include_body: bool = True,
        unread_only: bool = False,
    ) -> List[dict]:
        fields = [
            "id", "conversationId", "subject", "from", "toRecipients", "ccRecipients",
            "receivedDateTime", "sentDateTime", "isRead", "importance", "hasAttachments",
            "bodyPreview", "webLink",
        ]
        if include_body:
            fields.append("body")
        query = {
            "$select": ",".join(fields),
            "$orderby": "receivedDateTime desc",
            "$top": str(min(limit, 100)),
        }
        if unread_only:
            query["$filter"] = "isRead eq false"
        return self.graph.paged_get(
            user_id,
            f"/me/mailFolders/{folder}/messages",
            query=query,
            max_items=limit,
        )

    def search_messages(self, user_id: str, text: str, *, limit: int = 100) -> List[dict]:
        term = text.strip().replace('"', "")
        if not term:
            raise ValueError("Informe um termo de pesquisa.")
        return self.graph.paged_get(
            user_id,
            "/me/messages",
            query={
                "$search": f'"{term}"',
                "$select": "id,conversationId,subject,from,receivedDateTime,isRead,importance,bodyPreview,body,webLink",
                "$top": str(min(limit, 100)),
            },
            max_items=limit,
        )

    def create_draft(
        self,
        user_id: str,
        *,
        to: List[str],
        subject: str,
        body_html: str,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        if not to:
            raise ValueError("Informe ao menos um destinatário.")
        if not subject.strip():
            raise ValueError("Informe o assunto do e-mail.")
        message = {
            "subject": subject.strip(),
            "body": {"contentType": "HTML", "content": body_html},
            "toRecipients": _addresses(to),
            "ccRecipients": _addresses(cc or []),
            "bccRecipients": _addresses(bcc or []),
        }
        response = self.graph.post(user_id, "/me/messages", message)
        draft = response.data
        draft_id = draft["id"]
        for path in attachments or []:
            self._attach_file(user_id, draft_id, path)
        return self.preview_draft(user_id, draft_id)

    def preview_draft(self, user_id: str, draft_id: str) -> Dict[str, Any]:
        snapshot = self._draft_snapshot(user_id, draft_id)
        return {
            "status": "draft",
            "confirmation_required": True,
            "draft_id": draft_id,
            "preview": snapshot,
            "content_sha256": self.confirmations.fingerprint(snapshot),
        }

    def request_send_confirmation(self, user_id: str, draft_id: str) -> Dict[str, Any]:
        snapshot = self._draft_snapshot(user_id, draft_id)
        confirmation = self.confirmations.create(user_id, "send_mail", draft_id, snapshot)
        return {
            "status": "awaiting_confirmation",
            "draft_id": draft_id,
            "confirmation_token": confirmation.token,
            "expires_at": confirmation.expires_at,
            "content_sha256": confirmation.payload_hash,
            "preview": snapshot,
        }

    def send_confirmed(self, user_id: str, draft_id: str, confirmation_token: str) -> Dict[str, Any]:
        snapshot = self._draft_snapshot(user_id, draft_id)
        self.confirmations.consume(confirmation_token, user_id, "send_mail", draft_id, snapshot)
        # Nunca repetir automaticamente este POST: um timeout deixa o estado de envio incerto.
        response = self.graph.post(user_id, f"/me/messages/{draft_id}/send", None, allow_retry=False)
        return {
            "status": "sent" if response.status == 202 else "send_unknown",
            "draft_id": draft_id,
            "http_status": response.status,
            "request_id": response.request_id,
        }

    def _attach_file(self, user_id: str, draft_id: str, path: str) -> None:
        file_path = Path(path).resolve()
        if not file_path.is_file():
            raise FileNotFoundError(file_path)
        size = file_path.stat().st_size
        if size > MAX_SIMPLE_ATTACHMENT:
            raise ValueError(
                f"Anexo {file_path.name} excede 3 MB; implemente upload session para anexos grandes."
            )
        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        payload = {
            "@odata.type": "#microsoft.graph.fileAttachment",
            "name": file_path.name,
            "contentType": content_type,
            "contentBytes": base64.b64encode(file_path.read_bytes()).decode("ascii"),
        }
        self.graph.post(user_id, f"/me/messages/{draft_id}/attachments", payload)

    def _draft_snapshot(self, user_id: str, draft_id: str) -> Dict[str, Any]:
        message = self.graph.get(
            user_id,
            f"/me/messages/{draft_id}",
            query={
                "$select": "id,isDraft,subject,body,toRecipients,ccRecipients,bccRecipients,hasAttachments,lastModifiedDateTime"
            },
        )
        if not message.get("isDraft", False):
            raise RuntimeError("A mensagem não é mais um rascunho.")
        attachments = []
        if message.get("hasAttachments"):
            raw = self.graph.get(
                user_id,
                f"/me/messages/{draft_id}/attachments",
                query={"$select": "id,name,size,contentType,isInline"},
            )
            attachments = [
                {key: item.get(key) for key in ("id", "name", "size", "contentType", "isInline")}
                for item in raw.get("value", [])
            ]
        return {
            "id": message["id"],
            "subject": message.get("subject", ""),
            "body": message.get("body", {}),
            "to": message.get("toRecipients", []),
            "cc": message.get("ccRecipients", []),
            "bcc": message.get("bccRecipients", []),
            "attachments": attachments,
            "last_modified": message.get("lastModifiedDateTime", ""),
        }
