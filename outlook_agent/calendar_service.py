"""Agenda diária e criação confirmada de reuniões no Outlook."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from config import M365Config
from confirmation import ConfirmationStore
from graph_client import GraphClient


class OutlookCalendarService:
    def __init__(self, config: M365Config, graph: GraphClient, confirmations: ConfirmationStore) -> None:
        self.config = config
        self.graph = graph
        self.confirmations = confirmations
        self._pending: Dict[str, dict] = {}

    def day_agenda(self, user_id: str, day: Optional[date] = None) -> List[dict]:
        target = day or date.today()
        start = f"{target.isoformat()}T00:00:00"
        end = f"{(target + timedelta(days=1)).isoformat()}T00:00:00"
        return self.graph.paged_get(
            user_id,
            "/me/calendarView",
            query={
                "startDateTime": start,
                "endDateTime": end,
                "$select": "id,subject,start,end,isAllDay,isCancelled,sensitivity,organizer,attendees,location,onlineMeeting,webLink,showAs",
                "$orderby": "start/dateTime",
                "$top": "100",
            },
            headers={"Prefer": f'outlook.timezone="{self.config.timezone}"'},
            max_items=200,
        )

    def prepare_meeting(
        self,
        user_id: str,
        *,
        subject: str,
        start: str,
        end: str,
        attendees: List[str],
        body_html: str = "",
        location: str = "Microsoft Teams",
        online: bool = True,
        reminder_minutes: int = 15,
    ) -> Dict[str, Any]:
        if not subject.strip():
            raise ValueError("Informe o assunto da reunião.")
        start_dt = datetime.fromisoformat(start)
        end_dt = datetime.fromisoformat(end)
        if end_dt <= start_dt:
            raise ValueError("O término precisa ser posterior ao início.")
        normalized_attendees = []
        for address in attendees:
            cleaned = address.strip()
            if "@" not in cleaned:
                raise ValueError(f"E-mail de participante inválido: {address!r}")
            normalized_attendees.append({
                "emailAddress": {"address": cleaned},
                "type": "required",
            })
        request_id = str(uuid.uuid4())
        payload = {
            "subject": subject.strip(),
            "body": {"contentType": "HTML", "content": body_html},
            "start": {"dateTime": start_dt.isoformat(timespec="seconds"), "timeZone": self.config.timezone},
            "end": {"dateTime": end_dt.isoformat(timespec="seconds"), "timeZone": self.config.timezone},
            "location": {"displayName": location},
            "attendees": normalized_attendees,
            "isOnlineMeeting": bool(online),
            "onlineMeetingProvider": "teamsForBusiness" if online else None,
            "isReminderOn": True,
            "reminderMinutesBeforeStart": int(reminder_minutes),
            "transactionId": request_id,
        }
        if not online:
            payload.pop("onlineMeetingProvider")
        confirmation = self.confirmations.create(user_id, "create_meeting", request_id, payload)
        self._pending[request_id] = payload
        return {
            "status": "awaiting_confirmation",
            "request_id": request_id,
            "confirmation_token": confirmation.token,
            "expires_at": confirmation.expires_at,
            "preview": payload,
        }

    def create_confirmed(self, user_id: str, request_id: str, confirmation_token: str) -> Dict[str, Any]:
        payload = self._pending.get(request_id)
        if payload is None:
            raise RuntimeError("MEETING_REQUEST_NOT_FOUND: gere uma nova prévia.")
        self.confirmations.consume(confirmation_token, user_id, "create_meeting", request_id, payload)
        # Com participantes, este POST envia convites; não realizar retry cego.
        response = self.graph.post(user_id, "/me/events", payload, allow_retry=False)
        self._pending.pop(request_id, None)
        event = response.data or {}
        return {
            "status": "created",
            "event_id": event.get("id"),
            "web_link": event.get("webLink"),
            "online_meeting": event.get("onlineMeeting"),
            "request_id": response.request_id,
        }
