# The audits

Commit messages cite identifiers like `PCON-F1`. This is what they refer to.

No audit pass has been run against this project yet. Every finding here was
raised by a sweep of a class found in another project in the same workspace,
which is why the identifiers read `PCON` and `PGIF` rather than a perspective.

**7 findings, 5 closed, 2 open**, across the 0 perspectives that produced them.

Held to the workspace queue this project is built from by
`tools/check-audit-status.mjs`, which fails if a row here says anything the
queue does not. Until tick 164 this file did not exist, and an identifier in a
sibling project's commit log pointed at nothing a reader could open.

## `self`, swept from elsewhere (not an audit pass)

Not a perspective and not an agent. Findings raised against this project while
a class found somewhere else in the workspace was being swept across all eight,
kept here because commit messages cite them like any other.

7 findings, 5 closed.

| id | severity | status | finding |
|---|---|---|---|
| `PCAP-F1` | medium | open | capture.mjs hands the committed GIF to ffmpeg, and never asks whether ffmpeg is installed |
| `PCON-F1` | medium | fixed, tick 176 | The grain select is bounded at 1.35:1 and the range inputs have no boundary of their own |
| `PGRP-F1` | medium | fixed, tick 182 | serve.mjs kills a process group the spawn never creates, so cleanup off Windows leaves the server running |
| `PPOS-F1` | medium | fixed, tick 146 | The opening document and the label under it are chosen by position in the documents array |
| `PPRO-F1` | medium | fixed, tick 181 | The claims header says every phrase is counted and the first half compares the count to zero |
| `PGIF-F1` | low | open | The loop runs 8.76 seconds, above the five and a half tokenlab settled on |
| `PPRE-F1` | low | fixed, tick 165 | npm run verify started a server and handed the same missing browser to every gate in turn |
