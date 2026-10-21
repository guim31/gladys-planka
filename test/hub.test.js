// -----------------------------------------------------------------------------
// The hub against the in-memory Planka (real answers of Planka 2.2.1):
// counters, followed boards, scene events, the scene actions, the logins and
// the error cases. The clock starts on 21/10/2026 at 21:40 in Paris.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_CONFIG,
  BOARD_ID,
  COURSES_ID,
  FakePlanka,
  LISTS,
  PASSWORD_CONFIG,
  START,
  URL_1,
  boardId,
  createClock,
  createWorld,
} from './helpers/world.js';

const at = (day, h, m = 0, s = 0) => Date.UTC(2026, 9, day, h, m, s); // UTC, October 2026

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const counters = (w, id = BOARD_ID) => {
  const ids = boardId(w.gladys, id);
  return {
    open: w.fake.lastState(ids.feature('open')),
    dueToday: w.fake.lastState(ids.feature('due_today')),
    overdue: w.fake.lastState(ids.feature('overdue')),
    next: w.fake.lastState(ids.feature('next_due')),
  };
};

const keys = (w) => w.fake.sceneEvents.map((event) => `${event.key}:${event.data.card}`);

test('the fixtures start where the tests expect them', () => {
  assert.equal(new Date(START).toISOString(), '2026-10-21T19:40:00.000Z');
  assert.equal(URL_1, 'http://192.0.2.20:3000');
});

test('one device per board, its counters and its first active lists', async (t) => {
  const w = await world(t);
  assert.deepEqual(counters(w), {
    open: 7,
    dueToday: 2,
    overdue: 2,
    next: 'Arroser les plantes · Wed 21 Oct, 22:35',
  });
  const ids = boardId(w.gladys);
  const lists = [LISTS.TODO, LISTS.DOING, LISTS.BLOCKED].map((list) =>
    w.fake.lastState(ids.feature(`list-${list}`)),
  );
  assert.deepEqual(lists, [3, 3, 1], 'the ticked card still sits in its list');
  const [device] = w.fake.discoveredDevices;
  assert.deepEqual(
    device.features.map((feature) => feature.name),
    [
      'Open cards',
      'Cards due today',
      'Overdue cards',
      'À faire',
      'En cours',
      'Bloqué',
      'Next due date',
    ],
    'no counter for the closed list',
  );
  assert.deepEqual(counters(w, COURSES_ID), { open: 1, dueToday: 0, overdue: 0, next: 'None' });
  assert.deepEqual(
    w.fake.discoveredDevices.map((item) => item.name),
    ['Planka Tâches de la maison', 'Planka Courses'],
  );
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('the feature names and the next due date in the configured language', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, language: 'fr' } });
  assert.equal(counters(w).next, 'Arroser les plantes · mer. 21 oct., 22:35');
  assert.equal(w.fake.discoveredDevices[0].features[0].name, 'Cartes ouvertes');
});

test('only the followed boards, by name or id; unknown ones are reported', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, boards: `courses; Atelier` } });
  assert.deepEqual(
    w.fake.discoveredDevices.map((device) => device.name),
    ['Planka Courses'],
  );
  const ack = await w.fake.action('test_connection', {});
  assert.equal(ack.success, true, ack.error);
  assert.match(ack.data.message.en, /1 open card\(s\) in 1 followed board\(s\)\. Unknown board/);
  const byId = await world(t, { config: { ...BASE_CONFIG, boards: `#${BOARD_ID}` } });
  assert.equal(byId.fake.discoveredDevices.length, 1);
});

test('a list renamed keeps its feature; a new list is a new feature', async (t) => {
  const w = await world(t);
  const board = w.server.boards.get(BOARD_ID);
  board.included.lists.find((list) => list.id === LISTS.TODO).name = 'Idées';
  await w.hub.rediscover();
  const names = w.fake.discoveredDevices[0].features.map((feature) => feature.external_id);
  assert.ok(names.includes(boardId(w.gladys).feature(`list-${LISTS.TODO}`)));
});

test('nothing fires at the first reading; a move fires once, with both lists', async (t) => {
  const clock = createClock();
  const w = await world(t, { clock });
  assert.deepEqual(w.fake.sceneEvents, []);
  w.server.move('Appeler le plombier', LISTS.DONE);
  clock.advance(60_000);
  await w.hub.poll();
  assert.deepEqual(keys(w), ['card_moved:Appeler le plombier']);
  assert.deepEqual(w.fake.sceneEvents[0].data, {
    card: 'Appeler le plombier',
    card_id: '1890957645276251166',
    board: boardId(w.gladys).device,
    board_name: 'Tâches de la maison',
    list: 'Fait',
    previous_list: 'Bloqué',
    due_date: '',
  });
  clock.advance(60_000);
  await w.hub.poll();
  assert.equal(w.fake.sceneEvents.length, 1, 'not repeated');
  assert.equal(counters(w).open, 6, 'a card in a closed list is no longer open');
});

test('a card created is no move', async (t) => {
  const w = await world(t);
  const ok = await w.fake.sceneAction('add_card', { title: 'Tondre la pelouse' });
  assert.equal(ok.success, true, ok.error);
  await w.hub.poll();
  assert.deepEqual(w.fake.sceneEvents, []);
});

test('due times and midnight fire once; a ticked due date fires nothing', async (t) => {
  const clock = createClock();
  const w = await world(t, { clock });
  clock.time = at(21, 20, 35, 30); // 22:35:30 Paris
  await w.hub.poll();
  assert.deepEqual(keys(w), ['card_due:Arroser les plantes']);
  assert.equal(w.fake.sceneEvents[0].data.list, 'En cours');
  clock.time = at(21, 22, 0, 5); // 00:00:05 Paris, 22/10
  await w.hub.poll();
  assert.deepEqual(keys(w).slice(1), [
    'card_overdue:Payer la cantine',
    'card_overdue:Arroser les plantes',
  ]);
  clock.time = at(21, 22, 40); // "Réparer le robinet" due at 22:35:17 UTC
  w.server.card('Réparer le robinet').isDueCompleted = true;
  await w.hub.poll();
  assert.equal(w.fake.sceneEvents.length, 3, 'ticked before its due time: nothing');
  assert.deepEqual(counters(w), {
    open: 7,
    dueToday: 0,
    overdue: 3,
    next: 'Ranger le garage · Sun 25 Oct, 20:35',
  });
});

test('the day turns at local midnight, not UTC midnight', async (t) => {
  const clock = createClock();
  const w = await world(t, { clock });
  clock.time = at(21, 22, 0, 1); // 00:00:01 Paris, 22/10
  await w.hub.poll();
  // "Réparer le robinet" (00:35 Paris) is now due today; yesterday's are not.
  assert.equal(counters(w).dueToday, 1);
});

test('the events survive a restart: a move and a due time while down', async (t) => {
  const clock = createClock();
  const server = new FakePlanka({ now: clock.now });
  const first = await createWorld({ clock, server });
  const { dataDir } = first;
  await first.app.stop();
  server.move('Sortir les poubelles', LISTS.BLOCKED);
  clock.time = at(21, 20, 40); // after "Arroser les plantes" was due
  const second = await world(t, { clock, server, dataDir });
  assert.deepEqual(keys(second), [
    'card_due:Arroser les plantes',
    'card_moved:Sortir les poubelles',
  ]);
  assert.equal(second.fake.sceneEvents[1].data.previous_list, 'À faire');

  await second.app.stop();
  clock.time = at(21, 23, 30); // midnight Paris is 90 min old: dropped
  const third = await world(t, { clock, server, dataDir });
  assert.deepEqual(keys(third), ['card_due:Réparer le robinet'], 'due 55 min ago: kept');
});

test('an event Gladys refuses is tried again at the next reading, the others not repeated', async (t) => {
  const clock = createClock();
  const w = await world(t, { clock });
  const publish = w.gladys.publishSceneEvent.bind(w.gladys);
  let refuse = true;
  t.mock.method(w.gladys, 'publishSceneEvent', async (key, data) => {
    if (refuse && key === 'card_moved') {
      throw new Error('Gladys is restarting');
    }
    return publish(key, data);
  });
  w.server.move('Ranger le garage', LISTS.TODO);
  clock.time = at(21, 20, 36);
  await w.hub.poll();
  assert.deepEqual(keys(w), ['card_due:Arroser les plantes']);
  refuse = false;
  clock.advance(60_000);
  await w.hub.poll();
  assert.deepEqual(keys(w).slice(1), ['card_moved:Ranger le garage']);
});

test('add_card: first active list by default, at the bottom, with a due date', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, language: 'fr' } });
  const ok = await w.fake.sceneAction('add_card', {
    title: ' Acheter du lait ',
    board: 'courses',
    due: '2026-10-24 18:00',
  });
  assert.equal(ok.success, true, ok.error);
  assert.deepEqual(ok.data.outputs, {
    card: 'Acheter du lait',
    card_id: ok.data.outputs.card_id,
    board_name: 'Courses',
    list: 'Liste',
    due_date: '2026-10-24T16:00:00.000Z',
  });
  const created = w.server.card('Acheter du lait');
  assert.equal(created.position, 65536 * 2, 'below "Pain"');
  assert.equal(counters(w, COURSES_ID).open, 2, 'the counters follow at once');

  const inList = await w.fake.sceneAction('add_card', {
    title: 'Purger les radiateurs',
    list: 'en cours',
    due: '+2h',
  });
  assert.equal(inList.data.outputs.board_name, 'Tâches de la maison', 'the first board');
  assert.equal(inList.data.outputs.list, 'En cours');
  assert.equal(inList.data.outputs.due_date, new Date(START + 2 * 3_600_000).toISOString());
  const noon = await w.fake.sceneAction('add_card', { title: 'Semer', due: '2026-10-25' });
  assert.equal(noon.data.outputs.due_date, '2026-10-25T11:00:00.000Z', 'noon, winter time');
  const iso = await w.fake.sceneAction('add_card', { title: 'X', due: '2026-10-25T08:00:00Z' });
  assert.equal(iso.data.outputs.due_date, '2026-10-25T08:00:00.000Z');

  assert.match(
    (await w.fake.sceneAction('add_card', { title: 'X', due: 'demain' })).error,
    /Échéance incomprise/,
  );
  assert.match(
    (await w.fake.sceneAction('add_card', { title: 'X', due: '2026-02-30' })).error,
    /Échéance incomprise/,
  );
  assert.match(
    (await w.fake.sceneAction('add_card', { title: ' ' })).error,
    /titre de la nouvelle carte/,
  );
  assert.match(
    (await w.fake.sceneAction('add_card', { title: 'X', board: 'Atelier' })).error,
    /Aucun tableau/,
  );
  assert.match(
    (await w.fake.sceneAction('add_card', { title: 'X', list: 'Jamais' })).error,
    /Aucune liste/,
  );
  w.server.viewer = true;
  assert.match(
    (await w.fake.sceneAction('add_card', { title: 'X' })).error,
    /^Planka : cet utilisateur n'a pas ce droit .* \(HTTP 403\)$/,
  );
});

test('move_card: by name, to a list by name, with the previous list', async (t) => {
  const w = await world(t);
  const ok = await w.fake.sceneAction('move_card', { card: 'réparer LE robinet', list: 'fait' });
  assert.equal(ok.success, true, ok.error);
  assert.deepEqual(ok.data.outputs, {
    card: 'Réparer le robinet',
    card_id: w.server.card('Réparer le robinet').id,
    board_name: 'Tâches de la maison',
    list: 'Fait',
    previous_list: 'En cours',
  });
  const card = w.server.card('Réparer le robinet');
  assert.equal(card.listId, LISTS.DONE);
  assert.equal(card.position, 524288 + 65536, 'below "Vidanger la voiture"');
  assert.equal(counters(w).open, 6);

  const back = await w.fake.sceneAction('move_card', {
    card: 'Réparer le robinet',
    list: 'Bloqué',
    board: 'Tâches de la maison',
  });
  assert.equal(back.data.outputs.previous_list, 'Fait', 'a closed card can come back');
  assert.match(
    (await w.fake.sceneAction('move_card', { card: 'Tondre', list: 'Fait' })).error,
    /No card/,
  );
  assert.match(
    (await w.fake.sceneAction('move_card', { card: 'Pain', list: 'Fait' })).error,
    /No list/,
  );
  assert.match(
    (await w.fake.sceneAction('move_card', { card: 'Pain', list: 'Liste', board: 'Atelier' }))
      .error,
    /No board/,
  );
  w.server.card('Pain').name = 'Sortir les poubelles';
  assert.match(
    (await w.fake.sceneAction('move_card', { card: 'Sortir les poubelles', list: 'Fait' })).error,
    /Several cards/,
  );
});

test('read_today: a sentence for a message or a voice announcement', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, language: 'fr' } });
  const ack = await w.fake.sceneAction('read_today', {});
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(ack.data.outputs, {
    text: '3 carte(s) à finir ce soir : Sortir les poubelles, Payer la cantine et Arroser les plantes. 2 en retard.',
    count: 3,
    overdue: 2,
  });
  const courses = await w.fake.sceneAction('read_today', { board: 'Courses' });
  assert.equal(courses.data.outputs.text, "Aucune carte due aujourd'hui.");
});

test('a password login: once, and again when the session ends', async (t) => {
  const w = await world(t, { config: PASSWORD_CONFIG });
  assert.equal(w.fake.connectionStatus.connected, true);
  await w.hub.poll();
  assert.equal(w.server.logins, 1);
  w.server.revokeTokens();
  await w.hub.poll();
  assert.equal(w.server.logins, 2);
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('the login steps of Planka 2 and a wrong secret say so', async (t) => {
  const cases = [
    [{ termsPending: true }, PASSWORD_CONFIG, /accept its terms/],
    [{ totp: true }, PASSWORD_CONFIG, /two-factor login: use an API key/],
    [{}, { ...PASSWORD_CONFIG, password: 'wrong' }, /refused/],
    [{}, { ...BASE_CONFIG, api_key: 'wrong' }, /refused/],
  ];
  for (const [flags, config, expected] of cases) {
    const clock = createClock();
    const server = Object.assign(new FakePlanka({ now: clock.now }), flags);
    const w = await world(t, { clock, server, config });
    assert.equal(w.fake.connectionStatus.connected, false);
    assert.match(w.fake.connectionStatus.message.en, expected);
    const ack = await w.fake.action('test_connection', {});
    assert.equal(ack.success, false);
  }
});

test('an address that is not Planka, or that does not answer', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, url: 'http://192.0.2.99:3000' } });
  assert.match(w.fake.connectionStatus.message.en, /does not answer/);
  const html = new FakePlanka();
  html.handle = () => ({ status: 200, headers: {}, body: '<!DOCTYPE html>' });
  const other = await world(t, { server: html });
  assert.match(other.fake.connectionStatus.message.en, /no Planka 2 API/);
});

test('no configuration: a clear status, no request', async (t) => {
  const w = await world(t, { config: { url: '' } });
  assert.match(w.fake.connectionStatus.message.en, /address of your Planka/);
  const half = await world(t, { config: { url: URL_1, username: 'demo' } });
  assert.match(half.fake.connectionStatus.message.en, /API key, or a username and password/);
  assert.equal(half.server.requests.length, 0);
  const bad = await world(t, { config: { url: 'ftp://x' } });
  assert.match(bad.fake.connectionStatus.message.en, /not understood/);
  const ack = await half.fake.sceneAction('read_today', {});
  assert.match(ack.error, /pas configuré/, 'French by default');
});

test('an outage keeps the devices and marks them unreachable, then back', async (t) => {
  const w = await world(t);
  w.server.online = false;
  await w.hub.poll();
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.equal(w.fake.discoveredDevices.length, 2);
  assert.ok(w.fake.transports.some((entry) => entry.transport === 'unreachable'));
  w.server.online = true;
  await w.hub.poll();
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('a board deleted between the two requests is left out', async (t) => {
  const w = await world(t);
  w.server.boards.delete(COURSES_ID);
  await w.hub.poll();
  assert.equal(w.fake.connectionStatus.connected, true);
  assert.equal(w.hub.followed.length, 1);
});

test('the states are published again when a device is added', async (t) => {
  const w = await world(t);
  const before = w.fake.states.length;
  await w.fake.deviceCreated(w.fake.discoveredDevices[0]);
  assert.ok(w.fake.states.length > before);
});

test('a reading of the old instance during a reconfiguration is dropped', async (t) => {
  const w = await world(t);
  const reading = w.hub.poll();
  await w.fake.configUpdated({ ...w.fake.config, url: 'http://192.0.2.99:3000' });
  await reading;
  assert.deepEqual(w.hub.cards, [], 'nothing of the old instance kept');
  assert.equal(w.fake.connectionStatus.connected, false);
});
