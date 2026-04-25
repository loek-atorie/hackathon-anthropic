"""5 extraction test cases: positive, negative, edge cases."""
import asyncio, json, sys
sys.path.insert(0, "/home/pskpe/hackathon-anthropic/backend")
from agents.listener import extract

CASES = [
    {
        "label": "✅ POSITIVE — Bank helpdesk scam (ING)",
        "transcript": """
Oplichter: Goedemiddag, u spreekt met ING beveiligingsdienst. Personeelsnummer 4471.
Slachtoffer: Ja?
Oplichter: Er is geprobeerd €4.800 over te maken van uw rekening. U moet nu handelen.
Maak uw saldo over naar onze beveiligde rekening: NL91ABNA0417164300.
Dit is code rood. Elke minuut telt. Bel ons terug op 020-1234567.
Slachtoffer: Moet ik alles overmaken?
Oplichter: Ja, alles. U krijgt het binnen 24 uur terug. Vertel niemand hierover.
""",
    },
    {
        "label": "✅ POSITIVE — Police impersonation (Politie)",
        "transcript": """
Oplichter: Goedemiddag, u spreekt met de Nationale Politie Amsterdam, recherche afdeling.
Wij hebben uw bankrekeningnummer gevonden in een crimineel dossier.
Om vervolging te voorkomen moet u een borgsom betalen van €1.200.
Maak dit over naar rekeningnummer NL29INGB0123456789 op naam van Ministerie van Justitie.
Slachtoffer: Is dit echt de politie?
Oplichter: Ja. Als u niet betaalt wordt u vanmiddag aangehouden. Dit is uw laatste kans.
""",
    },
    {
        "label": "❌ NEGATIVE — Legitimate customer service (Ziggo)",
        "transcript": """
Medewerker: Goedemiddag, u spreekt met Ziggo klantenservice, mijn naam is Lisa.
Ik bel u omdat uw storing van vorige week gemeld was. Is het probleem opgelost?
Klant: Ja hoor, het werkt weer prima.
Medewerker: Fijn om te horen. Wilt u nog iets anders weten over uw abonnement?
Klant: Nee dank u.
Medewerker: Dan wens ik u een fijne dag. Doei!
""",
    },
    {
        "label": "⚠️  EDGE — Legitimate IBAN exchange (accountant)",
        "transcript": """
Accountant: Goedemiddag, ik bel van Administratiekantoor Jansen.
Voor de belastingaangifte heb ik uw IBAN nodig om de teruggave te verwerken.
Klant: Dat is NL02ABNA0123456789.
Accountant: Dank u. De teruggave van €340 wordt volgende week gestort.
Heeft u nog vragen over uw aangifte?
Klant: Nee dat is alles.
""",
    },
    {
        "label": "✅ POSITIVE — Lottery advance fee scam",
        "transcript": """
Beller: Gefeliciteerd! U bent geselecteerd als winnaar van de Europese Loterij.
    U heeft een prijs gewonnen van €45.000 euro.
Slachtoffer: Oh, wat leuk! Hoe kan dat?
Beller: Uw telefoonnummer is automatisch geselecteerd uit miljoenen deelnemers.
    Om uw prijs te activeren moet u eenmalig €150 administratiekosten betalen.
    Dit is verplicht door Europese regelgeving. Koopt u een VVV cadeaubon van €150
    en stuurt u mij de code? Dan wordt uw prijs binnen 24 uur overgemaakt.
Slachtoffer: Een cadeaubon?
Beller: Ja, dat is de veiligste methode. Uw prijs vervalt als u niet vandaag betaalt.
    Dit is uw enige kans. Wacht niet te lang — er zijn nog maar 3 winnaars over.
""",
    },
    {
        "label": "⚠️  EDGE — Very short call, wrong number",
        "transcript": """
Beller: Hallo, spreek ik met de huisarts?
Ontvanger: Nee, u heeft het verkeerde nummer.
Beller: Oh sorry, verkeerd verbonden.
""",
    },
]

async def run():
    for i, case in enumerate(CASES, 1):
        print(f"\n{'='*60}")
        print(f"Test {i}: {case['label']}")
        print('='*60)
        result = await extract(case["transcript"])
        print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))

asyncio.run(run())
