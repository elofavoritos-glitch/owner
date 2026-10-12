"""Cliente HTTP Microsoft Graph com paginação, isolamento e throttling."""
from __future__ import annotations

import json
import random
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Optional

from auth import DelegatedAuth
from config import M365Config


@dataclass
class GraphResponse:
    status: int
    data: Any
    request_id: str = ""


class GraphError(RuntimeError):
    def __init__(self, status: int, code: str, message: str, request_id: str = "") -> None:
        super().__init__(f"Microsoft Graph {status} {code}: {message}")
        self.status = status
        self.code = code
        self.request_id = request_id


class GraphClient:
    def __init__(self, config: M365Config, auth: DelegatedAuth) -> None:
        self.config = config
        self.auth = auth

    def request(
        self,
        user_id: str,
        method: str,
        path: str,
        *,
        query: Optional[Dict[str, str]] = None,
        body: Optional[dict] = None,
        headers: Optional[Dict[str, str]] = None,
        allow_retry: Optional[bool] = None,
    ) -> GraphResponse:
        method = method.upper()
        retryable = allow_retry if allow_retry is not None else method in {"GET", "HEAD", "OPTIONS"}
        url = self._url(path, query)
        payload = json.dumps(body).encode("utf-8") if body is not None else None
        attempts = self.config.max_retries if retryable else 1

        for attempt in range(attempts):
            request_headers = {
                "Authorization": f"Bearer {self.auth.access_token(user_id)}",
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "ELO-Comercial-Outlook/1.0",
            }
            request_headers.update(headers or {})
            request = urllib.request.Request(url, data=payload, headers=request_headers, method=method)
            try:
                with urllib.request.urlopen(request, timeout=self.config.request_timeout_seconds) as response:
                    raw = response.read()
                    data = json.loads(raw.decode("utf-8")) if raw else None
                    return GraphResponse(
                        status=response.status,
                        data=data,
                        request_id=response.headers.get("request-id", ""),
                    )
            except urllib.error.HTTPError as exc:
                raw = exc.read().decode("utf-8", errors="replace")
                try:
                    error_payload = json.loads(raw).get("error", {})
                except json.JSONDecodeError:
                    error_payload = {}
                code = error_payload.get("code", "HTTP_ERROR")
                message = error_payload.get("message", raw or str(exc))
                request_id = exc.headers.get("request-id", "")
                if exc.code in {429, 503, 504} and retryable and attempt + 1 < attempts:
                    retry_after = exc.headers.get("Retry-After")
                    delay = float(retry_after) if retry_after and retry_after.isdigit() else min(30, 2 ** attempt + random.random())
                    time.sleep(delay)
                    continue
                raise GraphError(exc.code, code, message, request_id) from exc
            except urllib.error.URLError as exc:
                if retryable and attempt + 1 < attempts:
                    time.sleep(min(30, 2 ** attempt + random.random()))
                    continue
                raise RuntimeError(f"GRAPH_UNAVAILABLE: {exc}") from exc
        raise RuntimeError("GRAPH_RETRY_EXHAUSTED")

    def get(self, user_id: str, path: str, *, query: Optional[Dict[str, str]] = None, headers: Optional[Dict[str, str]] = None) -> Any:
        return self.request(user_id, "GET", path, query=query, headers=headers).data

    def post(self, user_id: str, path: str, body: Optional[dict] = None, *, allow_retry: bool = False) -> GraphResponse:
        return self.request(user_id, "POST", path, body=body, allow_retry=allow_retry)

    def patch(self, user_id: str, path: str, body: dict) -> GraphResponse:
        return self.request(user_id, "PATCH", path, body=body, allow_retry=False)

    def paged_get(
        self,
        user_id: str,
        path: str,
        *,
        query: Optional[Dict[str, str]] = None,
        headers: Optional[Dict[str, str]] = None,
        max_items: int = 500,
    ) -> list:
        items = []
        next_path: Optional[str] = path
        next_query = query
        while next_path and len(items) < max_items:
            data = self.get(user_id, next_path, query=next_query, headers=headers)
            page = data.get("value", []) if isinstance(data, dict) else []
            items.extend(page[: max_items - len(items)])
            next_path = data.get("@odata.nextLink") if isinstance(data, dict) else None
            next_query = None
        return items

    def _url(self, path: str, query: Optional[Dict[str, str]]) -> str:
        if path.startswith("https://"):
            parsed = urllib.parse.urlparse(path)
            expected = urllib.parse.urlparse(self.config.graph_base_url)
            if parsed.scheme != "https" or parsed.netloc != expected.netloc:
                raise ValueError("A paginação apontou para um host não autorizado.")
            url = path
        else:
            if not path.startswith("/"):
                path = "/" + path
            url = self.config.graph_base_url.rstrip("/") + path
        if query:
            separator = "&" if "?" in url else "?"
            url += separator + urllib.parse.urlencode(query, safe="$(),:/@'")
        return url
