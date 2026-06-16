"""CareOps prototype endpoints for healthcare enterprise workflows.

This is intentionally deterministic and local. It exposes the product shape
for hospital workflow queues without surfacing model catalogs, extension stores,
or raw backend service controls to staff-facing clients.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any, Iterable

from fastapi import APIRouter, Depends

from helpers import get_cached_services
from security import verify_api_key

router = APIRouter(tags=["careops"])


CAREOPS_MODULES: list[dict[str, Any]] = [
    {
        "id": "prior-auth",
        "name": "Prior Authorization",
        "queue": "Prior Auth",
        "stage": "pilot-ready",
        "ownerRole": "Authorization specialist",
        "risk": "administrative",
        "slaHours": 24,
        "enabled": True,
        "metrics": {"open": 18, "dueToday": 7, "readyForReview": 6},
    },
    {
        "id": "denials",
        "name": "Denials and Appeals",
        "queue": "Denials",
        "stage": "design-ready",
        "ownerRole": "Revenue cycle analyst",
        "risk": "administrative",
        "slaHours": 48,
        "enabled": True,
        "metrics": {"open": 9, "dueToday": 3, "readyForReview": 2},
    },
    {
        "id": "referrals",
        "name": "Referral Intake",
        "queue": "Referrals",
        "stage": "design-ready",
        "ownerRole": "Referral coordinator",
        "risk": "administrative",
        "slaHours": 12,
        "enabled": True,
        "metrics": {"open": 31, "dueToday": 12, "readyForReview": 11},
    },
    {
        "id": "inbasket",
        "name": "Inbasket Triage",
        "queue": "Inbasket",
        "stage": "guarded-preview",
        "ownerRole": "Nurse triage",
        "risk": "clinical-adjacent",
        "slaHours": 4,
        "enabled": False,
        "metrics": {"open": 0, "dueToday": 0, "readyForReview": 0},
    },
]


CAREOPS_QUEUE_ITEMS: list[dict[str, Any]] = [
    {
        "id": "PA-1042",
        "moduleId": "prior-auth",
        "patientRef": "PX-2048",
        "serviceLine": "Orthopedics",
        "requestType": "MRI knee without contrast",
        "status": "ready_for_review",
        "priority": "high",
        "dueInHours": 6,
        "ownerRole": "Authorization specialist",
        "source": "EHR work queue",
        "evidenceCount": 7,
        "missingInfo": [],
        "nextAction": "Coordinator review",
        "approval": "human_required",
        "draft": "medical necessity packet",
    },
    {
        "id": "PA-1043",
        "moduleId": "prior-auth",
        "patientRef": "PX-2191",
        "serviceLine": "Oncology",
        "requestType": "Support medication renewal",
        "status": "missing_info",
        "priority": "urgent",
        "dueInHours": 2,
        "ownerRole": "Authorization specialist",
        "source": "Payer portal",
        "evidenceCount": 4,
        "missingInfo": ["recent weight", "failed formulary alternative"],
        "nextAction": "Request clinician attestation",
        "approval": "clinician_required",
        "draft": "missing evidence checklist",
    },
    {
        "id": "DN-883",
        "moduleId": "denials",
        "patientRef": "PX-1180",
        "serviceLine": "Cardiology",
        "requestType": "Appeal packet",
        "status": "drafting",
        "priority": "medium",
        "dueInHours": 30,
        "ownerRole": "Revenue cycle analyst",
        "source": "Denial letter",
        "evidenceCount": 5,
        "missingInfo": ["signed plan note"],
        "nextAction": "Assemble cited appeal draft",
        "approval": "human_required",
        "draft": "appeal letter",
    },
    {
        "id": "RF-771",
        "moduleId": "referrals",
        "patientRef": "PX-4509",
        "serviceLine": "GI",
        "requestType": "New specialty referral",
        "status": "blocked",
        "priority": "medium",
        "dueInHours": 14,
        "ownerRole": "Referral coordinator",
        "source": "Fax intake",
        "evidenceCount": 3,
        "missingInfo": ["insurance authorization", "recent colonoscopy report"],
        "nextAction": "Send missing-records request",
        "approval": "coordinator_required",
        "draft": "records request",
    },
]


CAREOPS_AUDIT_EVENTS: list[dict[str, Any]] = [
    {
        "id": "AUD-9001",
        "actor": "authorization-specialist",
        "action": "packet_drafted",
        "workItemId": "PA-1042",
        "policy": "human_review_required",
        "result": "allowed",
        "at": "2026-06-16T11:38:00Z",
    },
    {
        "id": "AUD-9002",
        "actor": "careops-gateway",
        "action": "retrieval_filtered",
        "workItemId": "PA-1043",
        "policy": "patient_context_required",
        "result": "allowed",
        "at": "2026-06-16T11:41:00Z",
    },
    {
        "id": "AUD-9003",
        "actor": "revenue-cycle-analyst",
        "action": "appeal_opened",
        "workItemId": "DN-883",
        "policy": "minimum_necessary",
        "result": "allowed",
        "at": "2026-06-16T11:46:00Z",
    },
]


def _value(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _normalize(value: Any) -> str:
    return str(value or "").lower().replace("_", "-").strip()


def _service_status(services: Iterable[Any], *needles: str) -> str | None:
    normalized_needles = {_normalize(needle) for needle in needles}
    for service in services:
        service_id = _normalize(_value(service, "id"))
        service_name = _normalize(_value(service, "name"))
        if service_id in normalized_needles or any(needle in service_name for needle in normalized_needles):
            return str(_value(service, "status", "unknown"))
    return None


def _control_state(service_status: str | None, *, planned_when_missing: bool = True) -> str:
    if service_status == "healthy":
        return "ready"
    if service_status in {"degraded", "restarting"}:
        return "degraded"
    if service_status is None and planned_when_missing:
        return "planned"
    return "blocked"


def _queue_summary(items: Iterable[dict[str, Any]]) -> dict[str, Any]:
    items = list(items)
    by_status = Counter(item["status"] for item in items)
    by_module = Counter(item["moduleId"] for item in items)
    urgent = sum(1 for item in items if item["priority"] == "urgent")
    due_today = sum(1 for item in items if item["dueInHours"] <= 24)
    return {
        "totalOpen": len(items),
        "urgent": urgent,
        "dueToday": due_today,
        "readyForReview": by_status["ready_for_review"],
        "blocked": by_status["blocked"] + by_status["missing_info"],
        "byStatus": dict(sorted(by_status.items())),
        "byModule": dict(sorted(by_module.items())),
    }


def _build_controls(service_statuses: Iterable[Any]) -> list[dict[str, Any]]:
    services = list(service_statuses)
    dashboard_api = _service_status(services, "dashboard-api", "dashboard api")
    llama = _service_status(services, "llama-server", "llm inference")
    ape = _service_status(services, "ape", "agent policy")
    qdrant = _service_status(services, "qdrant", "vector")

    gateway_ready = dashboard_api == "healthy" and llama == "healthy"
    return [
        {
            "id": "identity",
            "name": "Hospital identity",
            "state": "planned",
            "mode": "OIDC/SAML plus SCIM",
            "required": True,
        },
        {
            "id": "ai-gateway",
            "name": "AI gateway",
            "state": "ready" if gateway_ready else _control_state(dashboard_api, planned_when_missing=False),
            "mode": "single policy path",
            "required": True,
        },
        {
            "id": "policy",
            "name": "Agent policy",
            "state": _control_state(ape),
            "mode": "approval and tool policy",
            "required": True,
        },
        {
            "id": "retrieval",
            "name": "Scoped retrieval",
            "state": _control_state(qdrant),
            "mode": "patient-context filters",
            "required": True,
        },
        {
            "id": "audit",
            "name": "Audit trail",
            "state": "prototype",
            "mode": "append-only event contract",
            "required": True,
        },
    ]


def build_careops_payload(service_statuses: Iterable[Any] | None = None) -> dict[str, Any]:
    """Build the CareOps console payload.

    The payload is intentionally workflow-centric. Model and extension choices
    stay behind platform governance and do not appear in this staff surface.
    """
    services = list(service_statuses or [])
    modules = [dict(module) for module in CAREOPS_MODULES]
    queue_items = [dict(item) for item in CAREOPS_QUEUE_ITEMS]
    controls = _build_controls(services)
    blocked_controls = [control["id"] for control in controls if control["state"] in {"blocked", "planned"}]

    return {
        "profile": {
            "id": "healthcare-enterprise",
            "name": "DreamServer CareOps",
            "mode": "prototype",
            "staffSurface": "work-queues",
            "normalUserKnobs": {
                "modelSwitching": False,
                "extensionStore": False,
                "rawServicePorts": False,
            },
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": _queue_summary(queue_items),
        "controls": controls,
        "readiness": {
            "state": "ready" if not blocked_controls else "needs_configuration",
            "blockedControls": blocked_controls,
            "humanReviewRequired": True,
            "localOnlyDefault": True,
        },
        "modules": modules,
        "queueItems": queue_items,
        "auditEvents": [dict(event) for event in CAREOPS_AUDIT_EVENTS],
    }


@router.get("/api/careops")
async def api_careops(api_key: str = Depends(verify_api_key)):
    """Return the staff-facing CareOps workflow console payload."""
    return build_careops_payload(get_cached_services() or [])
