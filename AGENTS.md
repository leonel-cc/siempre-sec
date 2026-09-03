# Repository Instructions

## Canonical Context

`context.procedimentions.txt` is the canonical functional and technical context
for remote access, locations, permissions, contacts, alerts, and streaming.

Any change affecting one or more of the following areas MUST update that file in
the same change:

- organization, location, installation, zone, or camera relationships;
- user roles, permissions, memberships, or resource assignments;
- alert contacts, phone verification, recipient selection, or WhatsApp;
- alert access links, temporary contact sessions, or session revocation;
- camera listing authorization, view sessions, LiveKit tokens, or streaming;
- disconnection and recovery detection or notification behavior;
- related entities, migrations, API contracts, security guarantees, or tests.

Keep implemented behavior and approved target architecture clearly separated.
Do not mark target functionality as implemented until the code and relevant
verification are complete. Update the decision history with the date and a
concise description whenever an architectural or functional decision changes.
