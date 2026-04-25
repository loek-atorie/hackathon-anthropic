# The Scammer's Mirror - 60 Second Demo

## Core Demo Thesis

Do not frame this as "we made a funny AI grandmother." Frame it as:

> Every scam call becomes attacker intelligence before the next victim is called.

The believable elder persona is the lure. The product is the real-time intelligence layer for banks, telcos, police, and the public.

## Recommended Structure

| Time | Screen | Audio / Voiceover | What The Judges Learn |
|---:|---|---|---|
| 0-6s | AI-generated Dutch TV news cold open: anchor desk, lower-third "Telefonische oplichting verdubbeld" | "In Nederland nam telefonische oplichting in tweeduizend vierentwintig sterk toe. Fraudehelpdesk meldde bijna drieenvijftig miljoen euro schade, en CBS telt een komma vier miljoen slachtoffers van online fraude." | This is real, current, and local. |
| 6-12s | Hard cut to incoming call UI: "ING fraud department" calls Mevrouw Jansen | Scammer audio: "Goedemiddag, u spreekt met Pieter de Vries van de fraudeafdeling van ING..." | The attack starts as a normal bank-helpdesk scam. |
| 12-23s | Split screen: live transcript left, Mevrouw persona card right | Mevrouw audio: "Wat zegt u, jongen? Kunt u dat nog eens herhalen?" VO: "Instead of reaching a victim, the scammer reaches our AI honeypot elder." | The bot wastes time plausibly. |
| 23-34s | Extraction panel fills in live: claimed bank ING, urgency, fake transaction, callback number, mule IBAN placeholder, script fingerprint | VO: "While she keeps him talking, listener agents extract the script, entities, pressure tactics, and payment rails." | This is not just call blocking; it is intelligence gathering. |
| 34-45s | Obsidian-style graph or dashboard map lights up: voice cluster -> script -> IBAN -> bank -> telco number | VO: "Each clue becomes a node in a federated threat graph: this voice cluster, this script, this mule account, this phone route." | The wedge is the graph. |
| 45-54s | Alerts fire to three lanes: Bank, Telco, Police. Public website shows "Latest scam: ING safe-account call" and newsletter CTA | VO: "Banks can freeze mule accounts, telcos can suspend numbers, police get case files, and citizens see the scam before it reaches them." | The defense layers are concrete. |
| 54-60s | Hero metric screen: "Scammer minutes wasted today: 4,287" + "Every call answered. Every scam mapped." | VO: "We do not win by blocking one call. We win by making every scam call expensive, visible, and reusable as defense." | Memorable close. |

## What I Would Challenge

Keep the news segment to six seconds, not twelve. A long fake news clip can feel like a trailer; judges want to see the system. Use the news clip as a credibility snap, then immediately show the call.

Also avoid leading with "forget protecting the elderly" in the demo voiceover. It is a strong internal thesis, but on stage it can sound dismissive. Say "defense needs another layer" instead.

## Exact 60 Second Voiceover

```text
In the Netherlands, phone scams are rising fast. Fraudehelpdesk reported almost fifty-three million euros in fraud damage in twenty twenty-four, and CBS says one point four million Dutch people were victims of online fraud.

This is The Scammer's Mirror.

When a fake ING fraud agent calls, he does not reach a grandmother. He reaches Mevrouw Jansen: a believable AI elder trained to stall, repeat, misunderstand, and keep him talking.

But the call is not the product. The intelligence is.

As the scammer talks, our listener agents extract the claimed bank, the script, the pressure tactic, the callback number, and the mule account. The interrogator spots missing fields and nudges Mevrouw mid-call.

Every clue becomes a node in a live threat graph: voice cluster, script fingerprint, IBAN, phone route, campaign.

Banks get mule-account alerts. Telcos get numbers to suspend. Police get case files. Citizens get the latest scam warning before it reaches their parents.

The result: scammers spend their day talking to ghosts, and every wasted minute becomes shared defense.
```

## AI News Clip Prompt

Use this for a six-second generated cold open. Keep it sober and factual.

```text
A realistic Dutch public-broadcast TV news segment in a modern studio, medium shot of a serious news anchor, subtle newsroom background, no brand logos, lower third in Dutch reading "Telefonische oplichting neemt toe", small data graphic showing "NL: bijna EUR 53 mln gemelde fraudeschade" and "1,4 mln slachtoffers online fraude", natural broadcast lighting, documentary realism, calm urgent tone, 16:9, six seconds.
```

Suggested anchor line:

```text
Telefonische oplichting neemt toe. Vooral ouderen worden onder druk gezet door nep-bankmedewerkers.
```

## Demo Screen Checklist

- Incoming call from "ING fraudeafdeling" to "Mevrouw Jansen".
- Live transcript with Dutch scammer and Dutch Mevrouw lines.
- Agent status row: Listener, Interrogator, Graph Builder, Reporter.
- Extraction cards: `claimed_bank=ING`, `tactic=urgency`, `script=bank-helpdesk-safe-account`, `mule_iban=redacted`, `phone_route=spoofed`.
- Graph view showing entities linking together.
- Alert lanes: Bank, Telco, Police, Public.
- Public website module: "Latest scams", "Subscribe for alerts", "Report suspicious call".

## Existing Repo Assets To Use

- `demo-call.mp3` or `demo-call-stereo.wav` as the call bed.
- `prompts/mevrouw_jansen.md` for the honeypot persona.
- `prompts/scammer_agent.md` for the adversary prompt.
- `apps/api/vapi/webhooks.py` for transcript/status events.
- `apps/api/streaming.py` for the SSE bus that can drive a live dashboard or mock.

## Backup If The Live Call Fails

Use the recorded audio and replay scripted SSE events into the dashboard. Judges should see the same UI: transcript, extraction, graph, alerts. The pitch is stronger if the demo never depends on cellular latency, Vapi timing, or a live LLM staying perfectly on-script.

## Source Lines For The Cold Open

- Fraudehelpdesk 2024 press release: fraud reports increased, telephone fraud doubled, and reported 2024 damage was almost EUR 53 million.
- CBS Online Safety and Crime Survey 2024: 1.4 million people in the Netherlands aged fifteen and older were victims of online fraud in 2024.
