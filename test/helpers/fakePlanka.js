// -----------------------------------------------------------------------------
// An in-memory Planka 2, answering the routes the integration calls the way
// the real server does (status codes and `{ code, message }` errors, the
// login steps, 64-bit ids as strings, "Position must be present", the web
// app's HTML page outside /api). Its starting data are real answers of
// ghcr.io/plankanban/planka 2.2.1 in Docker (October 2026,
// test/fixtures/planka/real-*.json): one project, two boards. "Tâches de la
// maison" holds three active lists and a closed one (Done), eight cards: two
// overdue, two due on the day of the capture (one ticked), one tomorrow, one
// later, one undated, one in the closed list.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/planka/${name}.json`, import.meta.url), 'utf8'));

export const USERNAME = 'demo';
export const PASSWORD = 'Demo-Passw0rd';
export const API_KEY = 'D89VszVs_oSS6TdDtYmi0j1LhugOioY40dDVssESO';

export const BOARD_ID = '1890957640519910408';
export const COURSES_ID = '1890957641056781324';
export const LISTS = Object.freeze({
  TODO: '1890957641526543376',
  DOING: '1890957642080191505',
  BLOCKED: '1890957642382181394',
  DONE: '1890957642591896595',
});

const json = (status, value) => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(value),
});
const unauthorized = (message = 'Access token is missing, invalid or expired') =>
  json(401, { code: 'E_UNAUTHORIZED', message });
const notFound = (message) => json(404, { code: 'E_NOT_FOUND', message });

export class FakePlanka {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.projectsAnswer = fixture('real-projects');
    this.boards = new Map();
    for (const name of ['real-board', 'real-board-courses']) {
      const answer = fixture(name);
      this.boards.set(answer.item.id, answer);
    }
    this.online = true;
    /** Login steps of the real server: terms not accepted yet, two-factor login. */
    this.termsPending = false;
    this.totp = false;
    /** The user is only a viewer of the boards: writes are refused. */
    this.viewer = false;
    this.tokens = new Set();
    this.logins = 0;
    this.requests = [];
    this.nextId = 1890958000000000000n;
  }

  /** Every card of every board. */
  allCards() {
    return [...this.boards.values()].flatMap((board) => board.included.cards);
  }

  card(idOrName) {
    return this.allCards().find((card) => card.id === idOrName || card.name === idOrName);
  }

  listOf(listId) {
    for (const board of this.boards.values()) {
      const list = board.included.lists.find((item) => item.id === listId);
      if (list) {
        return { board, list };
      }
    }
    return null;
  }

  /** What the web app does when a card is dragged to another list. */
  move(cardName, listId) {
    const card = this.card(cardName);
    const { list } = this.listOf(listId);
    card.listId = listId;
    card.isClosed = list.type === 'closed';
    card.listChangedAt = new Date(this.now()).toISOString();
    card.position = 1;
  }

  /** Every session ends (the JWT expired, or was revoked). */
  revokeTokens() {
    this.tokens.clear();
  }

  authorized(headers) {
    if (headers['x-api-key'] !== undefined) {
      return headers['x-api-key'] === API_KEY;
    }
    const match = /^Bearer (.+)$/.exec(headers.authorization ?? '');
    return Boolean(match && this.tokens.has(match[1]));
  }

  handle(url, { method = 'GET', headers = {}, json: body } = {}) {
    const { pathname } = new URL(url);
    this.requests.push({ method, path: pathname });
    if (!pathname.startsWith('/api/')) {
      return { status: 200, headers: { 'content-type': 'text/html' }, body: '<!DOCTYPE html>' };
    }
    if (method === 'POST' && pathname === '/api/access-tokens') {
      if (body?.emailOrUsername !== USERNAME || body?.password !== PASSWORD) {
        return unauthorized('Invalid credentials');
      }
      if (this.termsPending) {
        return json(403, {
          code: 'E_FORBIDDEN',
          pendingToken: 'eyJ.pending.token',
          message: 'Terms acceptance required',
          step: 'accept-terms',
        });
      }
      if (this.totp) {
        return json(403, {
          code: 'E_FORBIDDEN',
          pendingToken: 'eyJ.pending.token',
          message: 'TOTP verification required',
          step: 'enter-totp-code',
        });
      }
      this.logins += 1;
      const token = `eyJ.session.${this.logins}`;
      this.tokens.add(token);
      return json(200, { item: token });
    }
    if (!this.authorized(headers)) {
      return unauthorized();
    }
    const board = pathname.match(/^\/api\/boards\/(\d+)$/);
    const listCards = pathname.match(/^\/api\/lists\/(\d+)\/cards$/);
    const card = pathname.match(/^\/api\/cards\/(\d+)$/);

    if (method === 'GET' && pathname === '/api/projects') {
      return json(200, this.projectsAnswer);
    }
    if (method === 'GET' && board) {
      const answer = this.boards.get(board[1]);
      return answer ? json(200, answer) : notFound('Board not found');
    }
    if (method === 'POST' && listCards) {
      const found = this.listOf(listCards[1]);
      if (!found) {
        return notFound('List not found');
      }
      if (this.viewer) {
        return json(403, { code: 'E_FORBIDDEN', message: 'Not enough rights' });
      }
      if (found.list.type === 'active' && !Number.isFinite(body?.position)) {
        return json(422, { code: 'E_UNPROCESSABLE_ENTITY', message: 'Position must be present' });
      }
      const at = new Date(this.now()).toISOString();
      const created = {
        id: String(this.nextId++),
        createdAt: at,
        updatedAt: null,
        type: body.type,
        position: body.position ?? null,
        name: body.name,
        description: null,
        dueDate: body.dueDate ?? null,
        isDueCompleted: body.dueDate ? false : null,
        stopwatch: null,
        commentsTotal: 0,
        isClosed: found.list.type === 'closed',
        listChangedAt: at,
        boardId: found.board.item.id,
        listId: found.list.id,
        creatorUserId: '1890956856260559873',
        prevListId: null,
        coverAttachmentId: null,
      };
      found.board.included.cards.push(created);
      return json(200, { item: created });
    }
    if (method === 'PATCH' && card) {
      const target = this.allCards().find((item) => item.id === card[1]);
      if (!target) {
        return notFound('Card not found');
      }
      if (this.viewer) {
        return json(403, { code: 'E_FORBIDDEN', message: 'Not enough rights' });
      }
      if (body.listId !== undefined && body.listId !== target.listId) {
        const found = this.listOf(body.listId);
        if (!found) {
          return notFound('List not found');
        }
        if (found.list.type === 'active' && !Number.isFinite(body.position)) {
          return json(422, {
            code: 'E_UNPROCESSABLE_ENTITY',
            message: 'Position must be present',
          });
        }
        target.listId = body.listId;
        target.isClosed = found.list.type === 'closed';
        target.listChangedAt = new Date(this.now()).toISOString();
      }
      for (const key of ['position', 'name', 'dueDate', 'isDueCompleted']) {
        if (body[key] !== undefined) {
          target[key] = body[key];
        }
      }
      target.updatedAt = new Date(this.now()).toISOString();
      return json(200, { item: target });
    }
    return notFound('Not Found');
  }
}

/** The network: one fake server per base URL; anything else does not answer. */
export function createNetwork(servers) {
  return {
    servers,
    async request(url, options = {}) {
      const base = Object.keys(servers).find((origin) => url.startsWith(`${origin}/`));
      const server = base ? servers[base] : null;
      if (!server || !server.online) {
        const error = new Error('connect ECONNREFUSED');
        error.code = 'ECONNREFUSED';
        throw error;
      }
      return server.handle(url, options);
    },
  };
}
