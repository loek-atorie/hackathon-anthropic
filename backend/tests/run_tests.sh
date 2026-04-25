#!/bin/bash
cd /home/pskpe/hackathon-anthropic/backend
set -a && source .env && set +a
.venv/bin/python tests/test_cases.py
