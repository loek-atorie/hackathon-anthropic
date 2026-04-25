# Bank-alert — call-0042

**Aan:** Rabobank — Fraud Operations
**Bank in frame:** ING (geïmiteerd), Rabobank (mule-rekeninghouder)
**Geverifieerd verdacht IBAN:** `NL12RABO0123456789`
**Callback-nummer scammer:** `+31 20 555 0142`

## Samenvatting

Op 2026-04-25 is via honeypot 07 (Zwolle) een telefoongesprek onderschept van 7 min 34 s. Een onbekende beller stelde zich voor als medewerker van het `ING` fraude-team en probeerde het gefingeerde slachtoffer (Mevrouw Jansen) te overtuigen haar spaartegoed over te maken naar IBAN `NL12RABO0123456789` onder het mom van "tijdelijke veiligstelling."

De beller maakte gebruik van script `bank-helpdesk-v3` en klinkt gelijk aan stem-cluster `scammer-voice-A7`, eerder gedetecteerd in meerdere gevallen deze maand.

## Verzoek

- Plaats `NL12RABO0123456789` **onmiddellijk** op de interne watchlist en bevries uitgaande transacties.
- Onderzoek transactiepatronen rondom dit IBAN vanaf 2026-04-18 (eerste detectie cluster A7).
- Controleer of rekeninghouder eerder betrokken was bij soortgelijke meldingen.
- Confirmeer terugkoppeling binnen 48 uur via het beveiligde kanaal van The Scammer's Mirror.

## Bewijslast

Volledige transcriptie, audio-fragment en geëxtraheerde metadata beschikbaar via The Scammer's Mirror dashboard, case `call-0042`.
