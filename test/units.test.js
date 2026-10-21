// -----------------------------------------------------------------------------
// Unit tests of the pure parts: the address and the board list typed by the
// user, the parsing of real Planka answers, the counters, the search by id or
// name, the due dates typed in a scene.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG, normalizeConfig, parseBoardList, parseServerUrl } from '../src/config.js';
import {
  findByIdOrName,
  localDay,
  localTime,
  parseBoard,
  parseBoards,
  summarize,
} from '../src/planka/model.js';
import { PlankaClient, PlankaError } from '../src/planka/client.js';
import { START, createWorld } from './helpers/world.js';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/planka/${name}.json`, import.meta.url), 'utf8'));

test('the address: bare host, copied browser URL, API URL, reverse proxy prefix', () => {
  assert.equal(parseServerUrl('192.0.2.10:3000'), 'http://192.0.2.10:3000');
  assert.equal(
    parseServerUrl(' https://kanban.example.org/boards/1890957640519910408 '),
    'https://kanban.example.org',
  );
  assert.equal(parseServerUrl('http://192.0.2.10:3000/api/projects'), 'http://192.0.2.10:3000');
  assert.equal(parseServerUrl('https://example.org/planka/cards/12'), 'https://example.org/planka');
  assert.equal(parseServerUrl('https://user:pass@example.org'), null, 'no credentials');
  assert.equal(parseServerUrl('ftp://example.org'), null);
  assert.equal(parseServerUrl(''), null);
});

test('the followed boards and the defaults', () => {
  assert.deepEqual(parseBoardList(' Maison ; Courses,,Maison\n'), ['Maison', 'Courses']);
  const config = normalizeConfig({ url: 'x.example', password: ' with blanks ' });
  assert.equal(config.password, ' with blanks ', 'a password is kept as typed');
  assert.equal(config.language, DEFAULT_CONFIG.language);
  assert.equal(config.pollIntervalMs, 300_000);
  assert.equal(normalizeConfig({ poll_interval: '42' }).pollIntervalMs, 300_000);
});

test('real boards: in the order of the projects, then by position', () => {
  assert.deepEqual(parseBoards(fixture('real-projects')), [
    {
      id: '1890957640519910408',
      name: 'Tâches de la maison',
      projectId: '1890957639840433158',
      projectName: 'Maison',
    },
    {
      id: '1890957641056781324',
      name: 'Courses',
      projectId: '1890957639840433158',
      projectName: 'Maison',
    },
  ]);
  assert.deepEqual(parseBoards({}), []);
});

test('a real board: active and closed lists, no archive nor trash; ids kept as strings', () => {
  const board = parseBoard(fixture('real-board'));
  assert.deepEqual(
    board.lists.map((list) => [list.name, list.type]),
    [
      ['À faire', 'active'],
      ['En cours', 'active'],
      ['Bloqué', 'active'],
      ['Fait', 'closed'],
    ],
  );
  assert.equal(board.cards.length, 8);
  const closed = board.cards.find((card) => card.name === 'Vidanger la voiture');
  assert.equal(closed.open, false);
  const ticked = board.cards.find((card) => card.name === 'Changer les draps');
  assert.equal(ticked.dueCompleted, true);
  assert.equal(typeof ticked.id, 'string');
  assert.equal(ticked.id, '1890957645737624608', 'beyond Number.MAX_SAFE_INTEGER, unchanged');
});

test('the counters of a day', () => {
  const { cards } = parseBoard(fixture('real-board'));
  const summary = summarize(cards, { now: START, day: localDay(START, 'Europe/Paris') });
  assert.equal(summary.open, 7);
  assert.equal(summary.overdue, 2);
  assert.equal(summary.dueToday, 2);
  assert.equal(summary.next.name, 'Arroser les plantes');
  assert.deepEqual(
    summary.agenda.map((card) => card.name),
    ['Sortir les poubelles', 'Payer la cantine', 'Arroser les plantes'],
  );
});

test('find by id or exact name', () => {
  const items = [
    { id: '1890957640519910408', name: 'Tâches de la maison' },
    { id: '12', name: 'Courses' },
    { id: '13', name: 'courses ' },
  ];
  assert.equal(findByIdOrName(items, 'taches  DE la maison').item.id, '1890957640519910408');
  assert.equal(findByIdOrName(items, '#1890957640519910408').item.name, 'Tâches de la maison');
  assert.equal(findByIdOrName(items, 'Courses').reason, 'ambiguous');
  assert.equal(findByIdOrName(items, ' ').reason, 'empty');
  assert.equal(findByIdOrName(items, 'Jardin').reason, 'not_found');
});

test('local wall-clock times, across a DST change', () => {
  // 25/10/2026: Paris goes back from UTC+2 to UTC+1 at 03:00.
  assert.equal(
    new Date(localTime(2026, 10, 24, 18, 0, 'Europe/Paris')).toISOString(),
    '2026-10-24T16:00:00.000Z',
  );
  assert.equal(
    new Date(localTime(2026, 10, 25, 12, 0, 'Europe/Paris')).toISOString(),
    '2026-10-25T11:00:00.000Z',
  );
  assert.equal(
    new Date(localTime(2026, 3, 29, 12, 0, 'Europe/Paris')).toISOString(),
    '2026-03-29T10:00:00.000Z',
  );
});

test('the client: a 404 on /projects is no Planka, a 422 is an HTTP error', async () => {
  const answer = (status, body) => async () => ({
    status,
    headers: {},
    body: JSON.stringify(body),
  });
  const client = (request) => new PlankaClient({ url: 'http://x', apiKey: 'k', request });
  await assert.rejects(client(answer(404, { message: 'Not Found' })).projects(), {
    kind: 'not_planka',
  });
  await assert.rejects(
    client(answer(422, { message: 'Position must be present' })).createCard('1', { name: 'x' }),
    (err) => err instanceof PlankaError && err.kind === 'http' && /Position/.test(err.message),
  );
  await assert.rejects(client(answer(429, {})).projects(), { kind: 'rate_limit' });
  await assert.rejects(client(answer(302, {})).projects(), { kind: 'redirect' });
  const tls = async () => {
    throw Object.assign(new Error('self signed'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
  };
  await assert.rejects(client(tls).projects(), { kind: 'tls' });
});

test('two concurrent readings of a password session log in once', async (t) => {
  const w = await createWorld({
    config: { url: 'http://192.0.2.20:3000', username: 'demo', password: 'Demo-Passw0rd' },
  });
  t.after(() => w.app.stop());
  w.server.revokeTokens();
  w.hub.client.token = null;
  await Promise.all([w.hub.client.projects(), w.hub.client.projects()]);
  assert.equal(w.server.logins, 2, 'the start, then one login for both');
});
