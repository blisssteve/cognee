#!/usr/bin/env python3
"""
Import Antigravity brain artifacts into Cognee.

Walks ~/.gemini/antigravity/brain/*/  and sends .md artifacts to
Cognee's HTTP API.  A JSON manifest tracks what's already been
imported (keyed by file path + mtime) so re-runs only send new or
changed files.

Usage:
    python import_brain_to_cognee.py                 # dry-run (default)
    python import_brain_to_cognee.py --execute       # actually import
    python import_brain_to_cognee.py --execute --cognify  # import + cognify
    python import_brain_to_cognee.py --reset         # clear manifest & re-import all
"""

import argparse
import json
import os
import sys
import hashlib
from pathlib import Path
from datetime import datetime, timezone

import requests

# ── Config ──────────────────────────────────────────────────────────
BRAIN_DIR = Path.home() / ".gemini" / "antigravity" / "brain"
MANIFEST_PATH = BRAIN_DIR / ".import_manifest.json"
COGNEE_BASE_URL = os.environ.get("COGNEE_URL", "http://localhost:8000")
COGNEE_ADD_URL = f"{COGNEE_BASE_URL}/api/v1/add"
COGNEE_COGNIFY_URL = f"{COGNEE_BASE_URL}/api/v1/cognify"
DATASET_NAME = "antigravity_brain"

# Files we care about (skip resolved versions, metadata, media)
ARTIFACT_NAMES = {
    "implementation_plan.md",
    "walkthrough.md",
    "task.md",
}

# Patterns to skip
SKIP_PATTERNS = [
    ".resolved",
    ".metadata.json",
    ".system_generated",
    ".tempmediaStorage",
    "tempmediaStorage",
    "antigravity_memory_system.md",  # meta-doc, not project knowledge
]


def file_hash(path: Path) -> str:
    """SHA-256 hash of file contents for change detection."""
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def should_import(path: Path) -> bool:
    """Check if a file is an importable brain artifact."""
    if not path.is_file() or path.suffix != ".md":
        return False
    if any(skip in str(path) for skip in SKIP_PATTERNS):
        return False
    if path.name not in ARTIFACT_NAMES:
        return False
    return True


def load_manifest() -> dict:
    """Load the import manifest (tracks already-imported files)."""
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return {"imported": {}, "last_run": None}


def save_manifest(manifest: dict):
    """Save the import manifest."""
    manifest["last_run"] = datetime.now(timezone.utc).isoformat()
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))


def collect_artifacts() -> list[dict]:
    """Walk brain dirs and collect importable artifacts with metadata."""
    artifacts = []
    if not BRAIN_DIR.exists():
        print(f"Brain directory not found: {BRAIN_DIR}")
        return artifacts

    for conv_dir in sorted(BRAIN_DIR.iterdir()):
        if not conv_dir.is_dir():
            continue
        conv_id = conv_dir.name

        for md_file in sorted(conv_dir.rglob("*.md")):
            if should_import(md_file):
                artifacts.append({
                    "path": str(md_file),
                    "conversation_id": conv_id,
                    "name": md_file.name,
                    "hash": file_hash(md_file),
                    "size": md_file.stat().st_size,
                    "mtime": md_file.stat().st_mtime,
                })

    return artifacts


def filter_new_or_changed(artifacts: list[dict], manifest: dict) -> list[dict]:
    """Filter to only new or changed artifacts (not already imported with same hash)."""
    imported = manifest.get("imported", {})
    new_artifacts = []
    for art in artifacts:
        key = art["path"]
        prev = imported.get(key)
        if prev and prev.get("hash") == art["hash"]:
            continue  # Already imported, unchanged
        new_artifacts.append(art)
    return new_artifacts


def import_to_cognee(artifact: dict) -> dict:
    """Send a single artifact to cognee's add API."""
    path = Path(artifact["path"])

    # Read metadata if available
    meta_path = path.with_suffix(".md.metadata.json")
    metadata_summary = ""
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text())
            metadata_summary = meta.get("summary", "")
        except Exception:
            pass

    # Prefix the file content with context
    content = path.read_text()
    prefixed_content = (
        f"# Antigravity Conversation: {artifact['conversation_id']}\n"
        f"# Artifact: {artifact['name']}\n"
        f"# Summary: {metadata_summary}\n\n"
        f"{content}"
    )

    # Upload as a file via multipart form
    files = {
        "data": (
            f"{artifact['conversation_id']}_{artifact['name']}",
            prefixed_content.encode("utf-8"),
            "text/markdown",
        )
    }
    data = {"datasetName": DATASET_NAME}

    response = requests.post(COGNEE_ADD_URL, files=files, data=data, timeout=30)
    response.raise_for_status()
    return response.json()


def trigger_cognify() -> dict:
    """Trigger cognify on the antigravity_brain dataset."""
    response = requests.post(
        COGNEE_COGNIFY_URL,
        json={"datasets": [DATASET_NAME]},
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def main():
    parser = argparse.ArgumentParser(description="Import Antigravity brain artifacts into Cognee")
    parser.add_argument("--execute", action="store_true", help="Actually import (default is dry-run)")
    parser.add_argument("--cognify", action="store_true", help="Run cognify after import")
    parser.add_argument("--reset", action="store_true", help="Clear manifest and re-import everything")
    parser.add_argument("--url", default=None, help="Cognee base URL (default: http://localhost:8000)")
    args = parser.parse_args()

    global COGNEE_BASE_URL, COGNEE_ADD_URL, COGNEE_COGNIFY_URL
    if args.url:
        COGNEE_BASE_URL = args.url
        COGNEE_ADD_URL = f"{COGNEE_BASE_URL}/api/v1/add"
        COGNEE_COGNIFY_URL = f"{COGNEE_BASE_URL}/api/v1/cognify"

    # Load or reset manifest
    if args.reset and MANIFEST_PATH.exists():
        MANIFEST_PATH.unlink()
        print("Manifest cleared — will re-import all artifacts.")

    manifest = load_manifest()

    # Collect and filter
    all_artifacts = collect_artifacts()
    new_artifacts = filter_new_or_changed(all_artifacts, manifest)

    print(f"Brain directory: {BRAIN_DIR}")
    print(f"Total artifacts found: {len(all_artifacts)}")
    print(f"Already imported (unchanged): {len(all_artifacts) - len(new_artifacts)}")
    print(f"New/changed to import: {len(new_artifacts)}")
    print(f"Target dataset: {DATASET_NAME}")
    print()

    if not new_artifacts:
        print("Nothing new to import.")
        return

    for art in new_artifacts:
        status = "NEW" if art["path"] not in manifest.get("imported", {}) else "CHANGED"
        print(f"  [{status}] {art['conversation_id']}/{art['name']} ({art['size']} bytes)")

    if not args.execute:
        print("\nDry run — use --execute to actually import.")
        return

    # Import
    print(f"\nImporting {len(new_artifacts)} artifacts to Cognee...")
    success = 0
    for art in new_artifacts:
        try:
            result = import_to_cognee(art)
            manifest.setdefault("imported", {})[art["path"]] = {
                "hash": art["hash"],
                "imported_at": datetime.now(timezone.utc).isoformat(),
                "conversation_id": art["conversation_id"],
            }
            save_manifest(manifest)
            success += 1
            print(f"  ✓ {art['conversation_id']}/{art['name']}")
        except Exception as e:
            print(f"  ✗ {art['conversation_id']}/{art['name']}: {e}")

    print(f"\nImported {success}/{len(new_artifacts)} artifacts.")

    # Optionally cognify
    if args.cognify and success > 0:
        print(f"\nTriggering cognify on dataset '{DATASET_NAME}'...")
        try:
            result = trigger_cognify()
            print(f"  Cognify started: {result}")
        except Exception as e:
            print(f"  Cognify failed: {e}")


if __name__ == "__main__":
    main()
