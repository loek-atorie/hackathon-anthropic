# Fraudemelding

**Datum:** 2025-07-11
**Prioriteit:** HOOG
**Referentie:** FM-20250711-001
**Status:** In behandeling

---

## Verdacht Rekeningnummer

| Veld | Gegeven |
|---|---|
| **IBAN** | NL91ABNA0417164300 |
| **Rekeninghouder bank** | ABN AMRO |
| **Transactierichting** | Uitgaand (send_to) |
| **Geïmiteerde organisatie** | ING Bank |

> ⚠️ **Let op:** Het verdachte IBAN is een ABN AMRO-rekening, terwijl de fraudeur zich voordoet als ING Bank. Dit mismatch-patroon is een sterke indicator van opzettelijke misleiding.

---

## Script Analyse

### Scripttype: Bank-helpdesk fraude

De fraudeur hanteert een klassiek **bank-helpdeskscript** waarbij het slachtoffer telefonisch of via SMS wordt benaderd door iemand die zich voordoet als medewerker van ING Bank. Het script bevat de volgende tactieken:

**1. Urgentie (Urgency)**
Het slachtoffer wordt onder tijdsdruk gezet met meldingen als *"Uw rekening wordt binnen 2 uur geblokkeerd"* of *"Er is nu direct actie vereist om uw saldo te beveiligen."* Dit voorkomt dat het slachtoffer rustig nadenkt of een tweede mening vraagt.

**2. Autoriteit (Authority)**
De fraudeur presenteert zich als officiële bankmedewerker, noemt interne afdelingsnamen zoals *"Veiligheidsafdeling"* of *"Fraudepreventie ING"*, en gebruikt professioneel klinkend jargon om geloofwaardigheid te wekken.

**3. Angst (Fear)**
Het slachtoffer wordt gewezen op een vermeende actieve fraude op de eigen rekening. Uitspraken als *"Criminelen hebben toegang tot uw account"* of *"Uw geld staat op het punt gestolen te worden"* worden ingezet om paniek te veroorzaken.

**4. Sociale bewijskracht (Social Proof)**
De fraudeur beweert dat *"meerdere klanten vandaag hetzelfde probleem hebben"* of dat *"dit een bekende aanvalsmethode is die we al bij honderden klanten zien."* Dit normaliseert de situatie en verlaagt de drempel om mee te werken.

**5. Voorwendsel (Pretexting)**
Er wordt een geloofwaardig scenario opgebouwd: het slachtoffer zou zijn aangemerkt als doelwit van een externe aanval, en de enige manier om geld te beschermen is *"tijdelijk overboeken naar een beveiligde rekening"* — zijnde het bovenstaande verdachte IBAN.

### Typisch scriptverloop

```
1. Eerste contact → melding van "verdachte transactie" op rekening slachtoffer
2. Verificatie → fraudeur vraagt gegevens ter "bevestiging van identiteit"
3. Escalatie → verhoogde dreiging, tijdsdruk wordt opgevoerd
4. Oplossing → slachtoffer wordt gevraagd geld over te maken naar "veilige rekening"
5. Verdwijning → contact wordt verbroken zodra overboeking is gedaan
```

---

## Actie Vereist

### 🔴 Directe maatregelen

- [ ] **Blokkeer** IBAN `NL91ABNA0417164300` voor inkomende overboekingen als ontvangstrekening voor mogelijke fraudegelden
- [ ] **Informeer ABN AMRO** Fraudeteam over dit IBAN via het inter-bancaire meldkanaal (FEC / MOT-melding indien van toepassing)
- [ ] **Traceer transac