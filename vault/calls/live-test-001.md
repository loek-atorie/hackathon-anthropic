---
type: call
id: live-test-001
started_at: 2026-04-25T16:04:19Z
language: nl
claimed_organisation: "[[ING]]"
script: "[[bank-helpdesk]]"
extracted_iban: "[[NL91ABNA0417164300]]"
iban_direction: send_to
payment_method: iban
callback_number: 020-1234567
tactics:
  - urgency
  - fear
  - authority
  - pretexting
urgency_score: 10
is_scam: true
is_scam_confidence: 0.99
---

# Call live-test-001

**Organisation claimed:** ING
**Script pattern:** bank-helpdesk
**Is scam:** ⚠️ YES (confidence: 99%)
**Urgency:** 10/10
**Tactics:** urgency, fear, authority, pretexting

## Payment intel
- IBAN: [[NL91ABNA0417164300]]
- Direction: send_to
- Method: iban
- Callback: 020-1234567

## Linked entities
- Organisation: [[ING]]
- Script: [[bank-helpdesk]]
