"""Read-only HTTP surface over the vault directory.

The Next dashboard used to read vault/ from local disk. On Vercel that won't
work — only this backend (P2) holds the live vault on its Fly Volume. These
endpoints expose the same data the frontend's vault-reader.ts and
report-reader.ts used to compute locally.
"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Any

import frontmatter
from fastapi import APIRouter, HTTPException, Query

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["vault"])

_DEFAULT_VAULT = Path(__file__).resolve().parents[1] / "vault"
VAULT_ROOT = Path(os.getenv("VAULT_PATH", str(_DEFAULT_VAULT))).resolve()

# Subdir → node type, mirrors frontend/web/lib/vault-reader.ts TYPE_DIRS.
TYPE_DIRS: dict[str, str] = {
    "calls": "call",
    "scammers": "scammer",
    "ibans": "iban",
    "banks": "bank",
    "scripts": "script",
}

STAKEHOLDERS: tuple[str, ...] = ("politie", "bank", "telco", "public")

WIKILINK_RE = re.compile(r"\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]")


def _extract_wikilinks(text: str) -> list[str]:
    return [m.group(1).strip() for m in WIKILINK_RE.finditer(text or "") if m.group(1).strip()]


def _frontmatter_wikilinks(fm: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for value in fm.values():
        if isinstance(value, str):
            out.extend(_extract_wikilinks(value))
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, str):
                    out.extend(_extract_wikilinks(item))
    return out


def _normalise_fm(fm: dict[str, Any]) -> dict[str, Any]:
    """Match the JSON shape the TS reader produced (Date → ISO string)."""
    import datetime as _dt
    out: dict[str, Any] = {}
    for k, v in fm.items():
        if isinstance(v, (_dt.date, _dt.datetime)):
            out[k] = v.isoformat() if isinstance(v, _dt.datetime) else f"{v.isoformat()}T00:00:00.000Z"
        else:
            out[k] = v
    return out


def _type_from_relpath(rel_path: str) -> str | None:
    parts = rel_path.split("/")
    if len(parts) < 3:
        return None
    return TYPE_DIRS.get(parts[1])


def _derive_id(node_type: str, filename: str, fm: dict[str, Any]) -> str:
    if node_type == "call" and isinstance(fm.get("id"), str):
        return fm["id"]
    if node_type == "script" and isinstance(fm.get("signature"), str):
        return fm["signature"]
    return filename


def _derive_label(node_type: str, node_id: str, fm: dict[str, Any]) -> str:
    if node_type == "call" and isinstance(fm.get("id"), str):
        return fm["id"]
    if node_type == "bank" and isinstance(fm.get("name"), str):
        return fm["name"]
    if node_type == "iban" and isinstance(fm.get("iban"), str):
        return fm["iban"]
    if node_type == "script" and isinstance(fm.get("signature"), str):
        return fm["signature"]
    if node_type == "scammer" and isinstance(fm.get("cluster_id"), str):
        return fm["cluster_id"]
    return node_id


def _resolve_inside_vault(rel_path: str) -> Path:
    """Resolve a frontend-supplied path (e.g. "vault/calls/foo.md") inside VAULT_ROOT.

    Raises 400 on traversal attempts.
    """
    if not rel_path.startswith("vault/"):
        raise HTTPException(400, "path must start with vault/")
    sub = rel_path[len("vault/"):]
    candidate = (VAULT_ROOT / sub).resolve()
    if VAULT_ROOT not in candidate.parents and candidate != VAULT_ROOT:
        raise HTTPException(400, "invalid path")
    return candidate


def _parse_file(full_path: Path, rel_path: str) -> dict[str, Any]:
    with full_path.open("r", encoding="utf-8") as fh:
        post = frontmatter.load(fh)
    fm = _normalise_fm(dict(post.metadata or {}))
    body = post.content or ""
    node_type = _type_from_relpath(rel_path)
    if node_type is None:
        raise HTTPException(400, "unrecognised vault path")
    filename = full_path.stem
    node_id = _derive_id(node_type, filename, fm)
    return {
        "id": node_id,
        "type": node_type,
        "label": _derive_label(node_type, node_id, fm),
        "path": rel_path,
        "frontmatter": fm,
        "body": body,
        "_links": [*_frontmatter_wikilinks(fm), *_extract_wikilinks(body)],
    }


@router.get("/vault-node")
async def vault_node(
    path: str = Query(..., description='Vault-relative path, e.g. "vault/calls/foo.md"'),
    knownIds: str = Query("", description="Comma-separated known node IDs to resolve wikilink edges"),
):
    full_path = _resolve_inside_vault(path)
    if not full_path.is_file():
        raise HTTPException(404, "file not found")

    parsed = _parse_file(full_path, path)
    node = {k: v for k, v in parsed.items() if not k.startswith("_")}

    known_lower: dict[str, str] = {}
    for tok in (s.strip() for s in knownIds.split(",")):
        if tok:
            known_lower[tok.lower()] = tok

    seen: set[tuple[str, str]] = set()
    edges: list[dict[str, str]] = []
    for link in parsed["_links"]:
        canonical = known_lower.get(link.lower())
        if not canonical or canonical == node["id"]:
            continue
        key = tuple(sorted((node["id"], canonical)))
        if key in seen:
            continue
        seen.add(key)
        edges.append({"source": node["id"], "target": canonical, "kind": "wikilink"})

    return {"node": node, "edges": edges}


@router.get("/graph")
async def graph() -> dict[str, Any]:
    """Full vault — every markdown file under known type dirs + wikilink edges."""
    parsed_files: list[tuple[Path, str, dict[str, Any]]] = []
    for dirname, _ in TYPE_DIRS.items():
        sub = VAULT_ROOT / dirname
        if not sub.is_dir():
            continue
        for md in sorted(sub.glob("*.md")):
            rel = f"vault/{dirname}/{md.name}"
            try:
                parsed = _parse_file(md, rel)
            except Exception as exc:
                log.warning("vault-reader: failed to parse %s: %s", md, exc)
                continue
            parsed_files.append((md, rel, parsed))

    nodes = [{k: v for k, v in p.items() if not k.startswith("_")} for _, _, p in parsed_files]

    by_id_lower: dict[str, str] = {n["id"].lower(): n["id"] for n in nodes}
    seen: set[tuple[str, str]] = set()
    edges: list[dict[str, str]] = []
    for (_, rel, parsed), source in zip(parsed_files, nodes):
        for link in parsed["_links"]:
            target_id = by_id_lower.get(link.lower())
            if not target_id or target_id == source["id"]:
                continue
            key = tuple(sorted((source["id"], target_id)))
            if key in seen:
                continue
            seen.add(key)
            edges.append({"source": source["id"], "target": target_id, "kind": "wikilink"})

    return {"nodes": nodes, "edges": edges}


@router.get("/reports")
async def list_report_call_ids() -> list[str]:
    """Return every callId that has at least one stakeholder report on disk."""
    reports_dir = VAULT_ROOT / "_reports"
    if not reports_dir.is_dir():
        return []
    pat = re.compile(r"^(.+)-(politie|bank|telco|public)\.md$")
    ids: set[str] = set()
    for entry in reports_dir.iterdir():
        if not entry.is_file() or not entry.name.endswith(".md"):
            continue
        m = pat.match(entry.name)
        if m:
            ids.add(m.group(1))
    return sorted(ids, reverse=True)


_CALL_ID_OK = re.compile(r"^[\w-]+$")


@router.get("/reports/{call_id}")
async def get_reports(call_id: str) -> dict[str, str]:
    if not _CALL_ID_OK.match(call_id):
        raise HTTPException(400, "Invalid callId")
    reports_dir = VAULT_ROOT / "_reports"
    out: dict[str, str] = {}
    for stakeholder in STAKEHOLDERS:
        f = reports_dir / f"{call_id}-{stakeholder}.md"
        try:
            out[stakeholder] = f.read_text(encoding="utf-8")
        except OSError:
            out[stakeholder] = ""
    return out
