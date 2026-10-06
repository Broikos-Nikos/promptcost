# The audits

Commit messages cite identifiers like `PCON-F1`. This is what they refer to.

No audit pass has been run against this project yet. Every finding here was
raised by a sweep of a class found in another project in the same workspace.

**12 findings, 7 closed, 5 open**.

Held to the workspace queue this project is built from by
`tools/check-audit-status.mjs`, which fails if a row here says anything the
queue does not.

## `self`, swept from elsewhere (not an audit pass)

Not a perspective and not an agent. Findings raised against this project while
a class found somewhere else in the workspace was being swept across all eight,
kept here because commit messages cite them like any other.

12 findings, 7 closed.

| id | severity | status | finding |
|---|---|---|---|
| `PCAP-F1` | medium | open | capture.mjs hands the committed GIF to ffmpeg, and never asks whether ffmpeg is installed |
| `PCON-F1` | medium | fixed, tick 176 | The grain select is bounded at 1.35:1 and the range inputs have no boundary of their own |
| `PFOLD-F1` | medium | open | The picture the page is built on is below the fold at both widths |
| `PGRP-F1` | medium | fixed, tick 182 | serve.mjs kills a process group the spawn never creates, so cleanup off Windows leaves the server running |
| `PTBL-F1` | medium | fixed, tick 198 | The price table is 10 pixels wider than its column at 320 and nothing in this project looks below 390 |
| `PPOS-F1` | medium | fixed, tick 146 | The opening document and the label under it are chosen by position in the documents array |
| `PPRO-F1` | medium | fixed, tick 181 | The claims header says every phrase is counted and the first half compares the count to zero |
| `PLEG-F1` | medium | fixed, tick 197 | The legend is a second hand written copy of the scale the cells are painted from, in CSS, and nothing compares them |
| `PGIF-F1` | low | open | The loop runs 8.76 seconds, above the five and a half tokenlab settled on |
| `PPRE-F1` | low | fixed, tick 165 | npm run verify started a server and handed the same missing browser to every gate in turn |
| `PTAP-F1` | low | open | Controls shorter than 24 pixels at a phone width |
| `PFF-F1` | low | open | npm run capture resolves ffmpeg off PATH and asks for it only after the browser has launched |
