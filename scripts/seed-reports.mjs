// One-shot fixture generator for vault/_reports/<call-id>-<stakeholder>.md.
// Run from repo root: `node scripts/seed-reports.mjs`. Idempotent.
//
// Phase D will replace these with output from P2's Reporter agent. Until then,
// these mock files give /reports something realistic to render.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "vault", "_reports");

mkdirSync(OUT, { recursive: true });

// Mirror of the 10 calls in vault/calls/ — single source of truth for the seeder.
const calls = [
  { id: "call-0031", date: "2026-04-18", scammer: "scammer-voice-A7", bank: "ING", iban: "NL12RABO0123456789", duration: 312, script: "bank-helpdesk-v3", honeypot: "honeypot 12, Apeldoorn", victim: "Mevrouw De Vries" },
  { id: "call-0032", date: "2026-04-19", scammer: "scammer-voice-B2", bank: "Rabobank", iban: "NL55ABNA0987654321", duration: 198, script: "bank-helpdesk-v3", honeypot: "honeypot 03, Groningen", victim: "Mevrouw Kuipers" },
  { id: "call-0033", date: "2026-04-19", scammer: "scammer-voice-A7", bank: "ING", iban: "NL12RABO0123456789", duration: 421, script: "bank-helpdesk-v3", honeypot: "honeypot 09, Almere", victim: "Mevrouw Hendriks" },
  { id: "call-0034", date: "2026-04-20", scammer: "scammer-voice-C9", bank: "KPN", iban: "NL77TRIO0334455667", duration: 267, script: "telco-tech-support-v2", honeypot: "honeypot 21, Eindhoven", victim: "Mevrouw Visser" },
  { id: "call-0035", date: "2026-04-21", scammer: "scammer-voice-A7", bank: "ING", iban: "NL44INGB0001234567", duration: 354, script: "bank-helpdesk-v3", honeypot: "honeypot 17, Den Haag", victim: "Mevrouw Bakker" },
  { id: "call-0036", date: "2026-04-22", scammer: "scammer-voice-B2", bank: "ABN", iban: "NL55ABNA0987654321", duration: 224, script: "bank-helpdesk-v3", honeypot: "honeypot 11, Rotterdam", victim: "Mevrouw Mulder" },
  { id: "call-0037", date: "2026-04-22", scammer: "scammer-voice-D4", bank: "Politie/ING", iban: "NL88BUNQ0009988776", duration: 412, script: "politie-fraud-v1", honeypot: "honeypot 05, Utrecht", victim: "Mevrouw Smit" },
  { id: "call-0038", date: "2026-04-23", scammer: "scammer-voice-A7", bank: "ING", iban: "NL44INGB0001234567", duration: 289, script: "bank-helpdesk-v3", honeypot: "honeypot 14, Zwolle", victim: "Mevrouw De Boer" },
  { id: "call-0039", date: "2026-04-24", scammer: "scammer-voice-B2", bank: "ING", iban: "NL66RABO0445566778", duration: 178, script: "bank-helpdesk-v3", honeypot: "honeypot 08, Tilburg", victim: "Mevrouw Van den Berg" },
  { id: "call-0040", date: "2026-04-24", scammer: "scammer-voice-C9", bank: "KPN", iban: "NL77TRIO0334455667", duration: 305, script: "telco-tech-support-v2", honeypot: "honeypot 28, Maastricht", victim: "Mevrouw Janssen" },
];

function fmtDuration(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m} min ${r.toString().padStart(2, "0")} s`;
}

function politie(c) {
  return `# Aangifte fraude — ${c.id}

**Datum incident:** ${c.date}
**Honeypot:** ${c.honeypot}
**Slachtoffer (gefingeerd):** ${c.victim}
**Duur gesprek:** ${fmtDuration(c.duration)}

## Modus operandi
Beller deed zich voor als medewerker van \`${c.bank}\` en gebruikte het script \`${c.script}\`. Stem-cluster: \`${c.scammer}\`. Tactieken: urgentie, gezag, angst.

## Buitgemaakte intelligentie
- Mule-IBAN: \`${c.iban}\` — gevlagd, status onder onderzoek.
- Stem geclusterd met andere gesprekken in deze week.

## Aanbeveling
Geadviseerd nummer aan T-Mobile/KPN/VodafoneZiggo door te geven voor blokkade. IBAN delen met de betreffende bank fraud-ops.
`;
}

function bank(c) {
  return `# Bank-alert — ${c.id}

**Aan:** Fraud Operations
**Bank in frame:** ${c.bank}
**Geverifieerd verdacht IBAN:** \`${c.iban}\`

## Samenvatting
Op ${c.date} is via een van onze honeypots een gesprek opgenomen waarin een onbekende beller zich voordeed als medewerker van uw bank. Het slachtofferscenario richtte zich op overmaking naar bovenstaand IBAN.

## Verzoek
- Plaats \`${c.iban}\` op de interne watchlist.
- Onderzoek transactiepatronen rondom dit IBAN sinds ${c.date}.
- Confirmeer aan ons of het IBAN al bekend was via klant-meldingen.

## Bewijslast
Volledige transcriptie + audio-fragment beschikbaar via The Scammer's Mirror dashboard, case \`${c.id}\`.
`;
}

function telco(c) {
  return `# Telco-melding — ${c.id}

**Datum:** ${c.date}
**Type fraude:** ${c.script.startsWith("telco") ? "Telco-helpdesk impersonation" : "Bank-helpdesk impersonation (telefonisch)"}
**Voicecluster:** \`${c.scammer}\`
**Honeypot:** ${c.honeypot}

## Verzoek aan operator
Onderzoek het oproepende A-nummer (CLI) gekoppeld aan deze case. Indien spoofed: blokkade aanvragen via 088-NUMMERS bij ACM. Indien echt: nummer afsluiten via abuse-procedure.

## Patroon
Stem-cluster \`${c.scammer}\` is in de afgelopen 7 dagen meermaals waargenomen. Aanwijzing voor georganiseerd belcentrum.
`;
}

function publicNote(c) {
  return `# Publiek bericht — ${c.id}

**Datum:** ${c.date}
**Type oplichting:** ${c.script.startsWith("telco") ? "Nep-helpdesk \"uw modem is gehackt\"" : "Nep-bankmedewerker \"uw rekening is niet veilig\""}

Pas op: er is een actieve oplichtingsgolf waarbij bellers zich voordoen als medewerker van \`${c.bank}\`. De truc: ze vragen u uw spaargeld over te maken naar een "veilige tussenrekening".

**Onthoud altijd:**
1. Een echte bank vraagt u nooit om geld over te maken naar een andere rekening.
2. Hang op en bel zelf het officiële nummer op de achterkant van uw bankpas.
3. Praat erover met een familielid of de buurvrouw — twijfelt u, stop dan.

Dit gesprek werd opgevangen door een van onze 50 honeypots. De beller is nu ${fmtDuration(c.duration)} bezig geweest zonder slachtoffer te maken.
`;
}

const stakeholders = { politie, bank, telco, public: publicNote };

let count = 0;
for (const c of calls) {
  for (const [name, fn] of Object.entries(stakeholders)) {
    const path = join(OUT, `${c.id}-${name}.md`);
    writeFileSync(path, fn(c));
    count += 1;
  }
}

console.log(`Wrote ${count} report files to ${OUT}`);
