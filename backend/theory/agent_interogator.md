What it does:
  - Reads the latest extraction state from the vault
  - Identifies what intelligence is still missing ("we don't have an
  IBAN yet", "no callback number")
  - Suggests the next question for Mevrouw Jansen to ask the scammer
  mid-call
  - POSTs that hint back to P1's webhook so Mevrouw Jansen can ask it
  naturally

  This is the visibly-agentic moment judges see — the graph updates,
  then Mevrouw Jansen suddenly pivots and asks exactly the right
  question.
  