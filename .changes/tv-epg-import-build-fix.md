---
type: internal
area: tv
---

Fixes two latent build breaks in `apps/tv`'s EPG code: a missing export that
made the app fail to compile, and a Stalker EPG-preview import left pointing
at a file moved by an earlier commit.
