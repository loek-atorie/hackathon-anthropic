# Telco-melding — call-0042

**Datum:** 2026-04-25
**Type fraude:** Bank-helpdesk impersonation (telefonisch)
**Voicecluster:** `scammer-voice-A7`
**Honeypot:** honeypot 07, Zwolle
**Ingekomen A-nummer:** `+31 20 555 0142`

## Verzoek aan operator

Het A-nummer `+31 20 555 0142` werd gebruikt bij een actieve fraude-poging waarbij de beller zich voordeed als ING-medewerker. Vermoeden van CLI-spoofing: het nummer lijkt een Amsterdam-regio-nummer, maar de conversatie bevatte geen lokale context.

Gevraagde acties:

1. Onderzoek het A-nummer `+31 20 555 0142` op spoofing (CLI-fraude).
2. Indien spoofed: blokkade aanvragen via 088-NUMMERS bij ACM.
3. Indien echt toegewezen: nummer afsluiten via uw standaard abuse-procedure en de houder informeren.
4. Bewaar CDR-gegevens voor minimaal 90 dagen ten behoeve van strafrechtelijk onderzoek.

## Patroon

Stem-cluster `scammer-voice-A7` is de afgelopen 30 dagen waargenomen in minimaal vier gesprekken (call-0031, call-0035, call-0038, call-0042). Dit duidt op een georganiseerd belcentrum of een gedeelde AI-voice-tool. Coördinatie met andere operators aanbevolen.
