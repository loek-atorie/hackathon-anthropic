When a call ends, it takes the extracted intel and asks Claude to
  write 4 different reports, each tailored to a different reader:

  - Politie — formal case file a police officer can act on
  - Bank fraud team — technical alert focused on the IBAN and script
  pattern
  - Telco — abuse report asking to block the callback number
  - Public — plain Dutch warning for ordinary people, especially the
  elderly

  Each report is written to vault/reports/{call_id}/ and published to
  the SSE stream as it's ready, so P3's dashboard can show them one by
  one as they appear.

  It's wired into process_and_publish — so one POST to /ingest now
  triggers the full chain: extract → vault → interrogator hint → 4
  reports.