  ┌──────────────────┬──────────┬───────────────────────────────────┐
  │       File       │ What it  │             One line              │
  │                  │    is    │                                   │
  ├──────────────────┼──────────┼───────────────────────────────────┤
  │ main.py          │ The      │ Receives calls, streams events to │
  │                  │ server   │  dashboard                        │
  ├──────────────────┼──────────┼───────────────────────────────────┤
  │ models.py        │ Shared   │ Defines what an Extraction looks  │
  │                  │ data     │ like                              │
  ├──────────────────┼──────────┼───────────────────────────────────┤
  │ listener.py      │ Agent 1  │ Reads transcript → asks Claude    │
  │                  │          │ what's happening                  │
  ├──────────────────┼──────────┼───────────────────────────────────┤
  │ graph_builder.py │ Agent 2  │ Saves intel as linked markdown    │
  │                  │          │ files                             │
  ├──────────────────┼──────────┼───────────────────────────────────┤
  │ interrogator.py  │ Agent 3  │ Figures out what's missing →      │
  │                  │          │ tells Mevrouw what to ask         │
  ├──────────────────┼──────────┼───────────────────────────────────┤
  │ reporter.py      │ Agent 4  │ Writes 4 reports when call ends   │
  ├──────────────────┼──────────┼───────────────────────────────────┤
  │ voiceprint.py    │ Agent 5  │ Groups calls by scammer           │
  │                  │          │ fingerprint                       │
  └──────────────────┴──────────┴───────────────────────────────────┘