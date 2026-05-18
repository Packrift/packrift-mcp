#!/usr/bin/env python3
"""Read GA4 Realtime MCP cart-landing receipt for Packrift."""

from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
import warnings
from pathlib import Path
from types import SimpleNamespace

warnings.filterwarnings("ignore")

ANALYTICS_ROOT = Path("/Users/farhan/Downloads/packrift-ai-commerce-execution-2026-05-04/analytics-1000x")
GA4_PULLER = ANALYTICS_ROOT / "packrift_ga4_pull.py"
GA4_ENV = ANALYTICS_ROOT / "packrift-ga4-env.local"
DEFAULT_TOKEN_FILE = ANALYTICS_ROOT / ".packrift-ga4-token.json"
DEFAULT_PROPERTY_ID = "531219331"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):].strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)


def import_ga4_puller():
    spec = importlib.util.spec_from_file_location("packrift_ga4_pull", GA4_PULLER)
    if not spec or not spec.loader:
        raise RuntimeError(f"Cannot import GA4 puller at {GA4_PULLER}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def main() -> None:
    load_env_file(GA4_ENV)
    puller = import_ga4_puller()
    libs = puller.import_google_libs()
    args = SimpleNamespace(
        auth_mode=os.environ.get("PACKRIFT_GA4_AUTH_MODE", "oauth"),
        service_account=os.environ.get("PACKRIFT_GA4_SERVICE_ACCOUNT"),
        client_secret=os.environ.get("PACKRIFT_GA4_CLIENT_SECRET"),
        token_file=os.environ.get("PACKRIFT_GA4_TOKEN_FILE", str(DEFAULT_TOKEN_FILE)),
    )
    credentials, auth_kind = puller.load_credentials(args, libs)

    from google.analytics.data_v1beta.types import RunRealtimeReportRequest

    client = libs["BetaAnalyticsDataClient"](credentials=credentials)
    dimension = libs["Dimension"](name="eventName")
    metric = libs["Metric"](name="eventCount")
    event_filter = libs["FilterExpression"](
        filter=libs["Filter"](
            field_name="eventName",
            string_filter=libs["Filter"].StringFilter(
                match_type=libs["Filter"].StringFilter.MatchType.CONTAINS,
                value=os.environ.get("PACKRIFT_GA4_REALTIME_EVENT_FILTER", "mcp_cart"),
                case_sensitive=False,
            ),
        )
    )
    property_id = os.environ.get("PACKRIFT_GA4_PROPERTY_ID", DEFAULT_PROPERTY_ID)
    response = client.run_realtime_report(
        RunRealtimeReportRequest(
            property=f"properties/{property_id}",
            dimensions=[dimension],
            metrics=[metric],
            dimension_filter=event_filter,
            limit=100,
        ),
        timeout=float(os.environ.get("PACKRIFT_GA4_API_TIMEOUT_SECONDS", "45")),
    )

    rows = [
        {
            "eventName": row.dimension_values[0].value,
            "eventCount": int(float(row.metric_values[0].value or 0)),
        }
        for row in response.rows
    ]
    event_count = sum(row["eventCount"] for row in rows if re.search(r"mcp_cart", row["eventName"], re.I))
    print(json.dumps({
        "ok": True,
        "property_id": property_id,
        "auth_kind": auth_kind,
        "row_count": len(rows),
        "event_count": event_count,
        "rows": rows,
    }, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2))
        raise SystemExit(2)
