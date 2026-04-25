# Aangifte fraude — call-0042

**Datum incident:** 2026-04-25
**Honeypot:** honeypot 07, Zwolle
**Slachtoffer (gefingeerd):** Mevrouw Jansen
**Duur gesprek:** 7 min 34 s

## Modus operandi

Beller deed zich voor als medewerker van het `ING` fraude-team en gebruikte het script `bank-helpdesk-v3`. Stem-cluster: `scammer-voice-A7`. Tactieken: urgentie ("uw rekening wordt momenteel misbruikt"), gezag ("ik bel namens het ING beveiligingsteam"), angst ("als u nu niet handelt verliezen wij uw saldo").

## Gebruikte contactgegevens

- Ingekomen nummer: `+31 20 555 0142` (CLI-spoofed, ogenschijnlijk Amsterdam)
- Callback-nummer opgegeven door beller: `+31 20 555 0142`
- Gevraagde overmaking naar IBAN: `NL12RABO0123456789`

## Buitgemaakte intelligentie

- Mule-IBAN: `NL12RABO0123456789` (Rabobank) — gevlagd, status onder onderzoek.
- Stem-cluster `scammer-voice-A7` eerder waargenomen in calls call-0031, call-0035 en call-0038 — aanwijzing voor zelfde operator of belcentrum.
- Script `bank-helpdesk-v3` bevat gestandaardiseerde dreigtactieken; mogelijke verspreiding via crimineel forum.

## Aanbeveling

Geadviseerd nummer `+31 20 555 0142` aan T-Mobile/KPN/VodafoneZiggo door te geven voor blokkade via ACM-procedure. IBAN `NL12RABO0123456789` onmiddellijk delen met Rabobank fraud-ops. Onderzoek correlatie met stem-cluster A7 over de afgelopen 30 dagen.
