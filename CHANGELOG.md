# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- Planka 2 boards in Gladys: one device per followed board, with the open
  cards, the cards due today, the overdue cards, the cards of each of the
  first five lists and the next due date.
- A choice of the followed boards, by name (all by default, 20 at most).
- Login with an API key, or with a username and password.
- Dashboard widget "Today's cards": the cards due by tonight, overdue first,
  with a button to tick the due date of each of the four most urgent; for
  every board or one.
- Scene triggers "Planka card moved" (board and list filters), "Planka card
  due" and "Planka card overdue" (at midnight), with the card, its board, its
  list and its due date as variables.
- Scene actions "Add a Planka card" (board, list, title, optional due date),
  "Move a Planka card" and "Read today's Planka cards" (a sentence for a
  message or a voice announcement).
- Counters and events on time at each due time and local midnight, whatever
  the refresh interval (1 to 10 minutes).
- A "Test the connection" button and a connection status naming the problem.
- Every text in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-planka/commits/main
