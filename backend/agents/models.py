"""Shared data models used across agents."""
from typing import Optional
from pydantic import BaseModel


class Extraction(BaseModel):
    language: Optional[str] = None
    claimed_organisation: Optional[str] = None
    iban: Optional[str] = None
    iban_direction: Optional[str] = None
    payment_method: Optional[str] = None
    callback_number: Optional[str] = None
    tactics: list[str] = []
    urgency_score: int = 0
    is_scam: bool = False
    is_scam_confidence: float = 0.0
    script_signature: Optional[str] = None
