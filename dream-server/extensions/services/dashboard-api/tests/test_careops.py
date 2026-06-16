"""Tests for the CareOps healthcare enterprise prototype endpoint."""

from routers.careops import build_careops_payload


def test_careops_requires_auth(test_client):
    resp = test_client.get("/api/careops")
    assert resp.status_code == 401


def test_careops_authenticated_payload_is_workflow_centred(test_client):
    resp = test_client.get("/api/careops", headers=test_client.auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["profile"]["id"] == "healthcare-enterprise"
    assert data["profile"]["staffSurface"] == "work-queues"
    assert data["profile"]["normalUserKnobs"] == {
        "modelSwitching": False,
        "extensionStore": False,
        "rawServicePorts": False,
    }
    assert "modelCatalog" not in data
    assert "extensionStore" not in data
    assert len(data["modules"]) >= 3
    assert data["summary"]["totalOpen"] == len(data["queueItems"])
    assert data["readiness"]["humanReviewRequired"] is True


def test_careops_payload_marks_local_runtime_controls_ready_from_services():
    services = [
        {"id": "dashboard-api", "name": "Dashboard API", "status": "healthy"},
        {"id": "llama-server", "name": "llama-server (LLM Inference)", "status": "healthy"},
        {"id": "ape", "name": "APE (Agent Policy Engine)", "status": "healthy"},
        {"id": "qdrant", "name": "Qdrant Vector Database", "status": "healthy"},
    ]

    data = build_careops_payload(services)
    controls = {control["id"]: control for control in data["controls"]}

    assert controls["ai-gateway"]["state"] == "ready"
    assert controls["policy"]["state"] == "ready"
    assert controls["retrieval"]["state"] == "ready"
    assert "ai-gateway" not in data["readiness"]["blockedControls"]
    assert data["summary"]["dueToday"] >= data["summary"]["urgent"]
