// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake Planka on a fake
// network, a temporary /data, a manual clock and the Paris time zone, with
// the integration wired on top through registerHandlers. No timer runs unless
// `timers: true` (with node:test mock timers): the tests read Planka with
// `world.hub.poll()`.
// -----------------------------------------------------------------------------

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';
import {
  API_KEY,
  BOARD_ID,
  COURSES_ID,
  FakePlanka,
  LISTS,
  PASSWORD,
  USERNAME,
  createNetwork,
} from './fakePlanka.js';

// The integration logs its lifecycle; keep the test output readable.
process.env.LOG_LEVEL ??= 'silent';

export const URL_1 = 'http://192.0.2.20:3000';
export const TIME_ZONE = 'Europe/Paris';
// The fixtures were captured on 21/10/2026 at 19:35 UTC; the tests start at
// 19:40 UTC (21:40 in Paris). "Tâches de la maison": "Sortir les poubelles"
// overdue since yesterday, "Payer la cantine" overdue since 19:35 Paris,
// "Arroser les plantes" due at 22:35 Paris, "Réparer le robinet" tomorrow at
// 00:35 Paris, "Changer les draps" due today but ticked.
export const START = Date.UTC(2026, 9, 21, 19, 40, 0);

export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

export const BASE_CONFIG = { url: URL_1, api_key: API_KEY, language: 'en' };
export const PASSWORD_CONFIG = {
  url: URL_1,
  username: USERNAME,
  password: PASSWORD,
  language: 'en',
};

/**
 * @param {object} [options]
 * @param {FakePlanka} [options.server]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 */
export async function createWorld({
  clock = createClock(),
  server,
  config = BASE_CONFIG,
  devices = [],
  connect = true,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-planka-')),
  timings = {},
  timers = false,
} = {}) {
  const planka = server ?? new FakePlanka({ now: clock.now });
  const network = createNetwork({ [URL_1]: planka });
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    store: new Store(dataDir),
    request: network.request,
    timers,
    timings,
    now: clock.now,
    timeZone: TIME_ZONE,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
  }
  return { gladys, fake: gladys.fake, server: planka, app, hub: app.hub, clock, dataDir };
}

export const boardId = (gladys, id = BOARD_ID) => gladys.externalIds('board', `board-${id}`);

/** Add every discovered device in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
}

export { API_KEY, BOARD_ID, COURSES_ID, FakePlanka, LISTS, PASSWORD, USERNAME };
