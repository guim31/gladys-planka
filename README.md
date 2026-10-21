# Planka for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com)
that brings the kanban boards of a self-hosted [Planka](https://planka.app) 2
into Gladys, over the local network: the cards due today and the overdue
ones, the number of cards in each list, a scene trigger when a card arrives
in a list or falls due, and cards added or moved from a scene or ticked from
the dashboard.

> **Feedback welcome.** The integration was checked against a real Planka
> server (Docker image `ghcr.io/plankanban/planka` 2.2.1, October 2026), but
> not yet in everyday use with a real Gladys. Please report what works and
> what does not in the [issues](https://github.com/guim31/gladys-planka/issues).

## Features

- **One device per followed board** (all by default, or a list of names),
  with _open cards_, _cards due today_, _overdue cards_, one counter per list
  (the first five active lists) and the _next due date_ (text).
- **Dashboard widget** "Today's cards": two tiles, the cards due by tonight
  (overdue first, time, list, board) and a button to tick the due date of each
  of the four most urgent; for every board or one.
- **Scene triggers**: _Planka card moved_ (filters on the board and the list:
  "a card arrived in Done"), _Planka card due_ and _Planka card overdue_ (at
  midnight, the card of the day still undone); the card, its board, its list
  (and the previous one) and its due date as variables. Once each, across
  restarts.
- **Scene actions**: _Add a Planka card_ (board, list, title, optional due
  date such as `2026-10-24 18:00` or `+2h`), _Move a Planka card_ (by name, to
  a list by name) and _Read today's Planka cards_ (a sentence for a message or
  a voice announcement).
- On time: besides the refresh interval (1 to 10 minutes, 5 by default), the
  integration reads Planka at each due time and at local midnight (the time
  zone of Gladys).
- A **Test the connection** button, a connection status that names the
  problem (key refused, terms to accept, two-factor login, no Planka at this
  address…), and a transport badge per device.
- Every text in English, French, German and Spanish.

## Requirements

- Gladys Assistant **5.1.0** or later (widgets, scene triggers and actions).
- A **self-hosted Planka 2** (tested with 2.2.1; Planka 1.x is not
  supported), reachable from Gladys, and either an **API key** of a user
  (created by an administrator: Administration → Users → the user's menu →
  API Key), or the **username and password** of a user who logged in once in
  the web app and does not use two-factor login. The integration acts as this
  user.

## Installation

1. In Gladys, open **Integrations** → **Install from GitHub** and enter the
   address of this repository: `https://github.com/guim31/gladys-planka`
   (or install **Planka** from the catalog once it is listed).
2. In **Configuration**, enter the address of Planka
   (`http://192.168.1.20:3000`, `https://kanban.example.org`…) and the API key
   (or the username and password). Save, then click **Test the connection**.
3. Open the **Discover** tab and add the devices.

The user guide is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)); Gladys
links it from the Configuration screen.

## How it works

The integration uses the REST API of Planka 2, `/api`, with the API key in
the `X-Api-Key` header, or a session token (`POST /api/access-tokens`) in
`Authorization: Bearer`:

| Request                      | Use                                                 |
| ---------------------------- | --------------------------------------------------- |
| `POST /api/access-tokens`    | password login (once, and again when it expires)    |
| `GET /api/projects`          | the projects and boards the user sees               |
| `GET /api/boards/{id}`       | lists and cards of a followed board                 |
| `POST /api/lists/{id}/cards` | add a card (at the bottom of the list)              |
| `PATCH /api/cards/{id}`      | move a card (`listId`, `position`), tick a due date |

Planka is read on a timer of the container; the devices are published with
`should_poll: false`. States are published only when they change, and every
12 hours otherwise. A move is a card whose list changed between two readings;
the due events are the moments (due time, end of the due day) crossed since
the previous reading. The time of the last reading and the list of each card
are kept in `/data/planka-state.json`. Planka webhooks and its Socket.IO
connection are not used: a reading every few minutes is enough for these
uses, and needs no change on the Planka side.

## Checked on a real Planka, and what was not

Checked against `ghcr.io/plankanban/planka` 2.2.1 with PostgreSQL 16 in a
Docker network: the default administrator, its terms accepted through the
API, a project with two boards, lists of each kind (active, closed) and cards
due in the past, today (one ticked), tomorrow, later and never, created and
moved through the API; an API key; the error answers (wrong password, wrong
token, missing board, missing position). The real answers are in
`test/fixtures/planka/` and drive the tests; the integration ran in its own
container under the Gladys sandbox limits (read-only root, no capabilities,
256 MB) against that server, against the SDK's fake Gladys.

Not checked: a real Gladys instance, the two-factor login answer (built from
the Planka source), Planka behind a reverse proxy with a path prefix, Planka
versions other than 2.2.1.

## Limitations

- Adds cards, moves them and ticks their due dates; does not edit, delete or
  assign them, nor read their tasks, labels or comments.
- A change made in Planka shows up within the refresh interval.
- Up to 20 boards are read, one request each per reading.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests use the fake Gladys of the SDK (`@gladysassistant/integration-sdk/testing`)
and an in-memory Planka (`test/helpers/fakePlanka.js`) built from real
answers. See [`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- [Planka](https://github.com/plankanban/planka) by PLANKA Software GmbH and
  its contributors: the integration only talks to its API; no code was
  copied. The cover uses the Planka logo from its repository
  (`client/src/assets/images/about-logo.png`), to name the service.
- The architecture and the conformity tests follow
  [gladys-vikunja](https://github.com/guim31/gladys-vikunja) and
  [gladys-wled](https://github.com/guim31/gladys-wled).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by Planka or
PLANKA Software GmbH. The Planka name and logo belong to their owners.

## License

Apache-2.0
