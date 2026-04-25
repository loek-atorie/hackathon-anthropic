"""Test graph_builder writes correct vault files from a real Claude extraction."""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, "/home/pskpe/hackathon-anthropic/backend")

from agents.listener import extract, CANNED_TRANSCRIPT
from agents.graph_builder import build, VAULT_ROOT

# cd /home/pskpe/hackathon-anthropic/backend && set -a && source .env &&
#    set +a && .venv/bin/python tests/test_graph_builder.py
async def run():
    print("Step 1: extracting intel from canned transcript...")
    extraction = await extract(CANNED_TRANSCRIPT)
    print(json.dumps(extraction.model_dump(), indent=2, ensure_ascii=False))

    print("\nStep 2: building vault files...")
    files = build("test-call-0001", extraction)

    print(f"\nStep 3: files written ({len(files)}):")
    for f in files:
        print(f"  {f}")

    print("\nStep 4: file contents:")
    for f in files:
        print(f"\n{'='*60}")
        print(f"  {f.relative_to(VAULT_ROOT)}")
        print('='*60)
        print(Path(f).read_text())


asyncio.run(run())
