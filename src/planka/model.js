// -----------------------------------------------------------------------------
// From the raw Planka answers to what Gladys shows: boards, lists and cards
// with their due time in milliseconds, and the counters of a local day (the
// time zone of Gladys, injected by the supervisor as TZ).
//
// Definitions, the same in the devices, the widget, the scene actions and the
// documentation:
//   - open card: a card of an active list (not a "closed" list such as Done,
//     not archived, not in the trash);
//   - pending due date: the due date of an open card whose due checkbox is not
//     ticked ("due completed" in Planka);
//   - overdue: an open card whose pending due date has passed;
//   - due today: an open card whose pending due date falls in the local day,
//     passed or not;
//   - next due date: the earliest pending due date still ahead.
// Ids stay strings: Planka's are 64-bit integers, beyond what a number holds.
// -----------------------------------------------------------------------------

const time = (value) => {
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const idOf = (value) =>
  typeof value === 'string' && /^\d+$/.test(value)
    ? value
    : Number.isInteger(value)
      ? String(value)
      : null;
const position = (value) => (Number.isFinite(value) ? value : Infinity);

export const LIST_TYPES = Object.freeze({ ACTIVE: 'active', CLOSED: 'closed' });

/**
 * Every board the user sees, in the order of the Planka home page (project,
 * then board position).
 * @param {object} raw answer of GET /api/projects
 * @returns {Array<{ id: string, name: string, projectId: string, projectName: string }>}
 */
export function parseBoards(raw) {
  const projects = (Array.isArray(raw?.items) ? raw.items : []).filter((p) => idOf(p?.id));
  const order = new Map(projects.map((project, index) => [idOf(project.id), index]));
  const names = new Map(projects.map((project) => [idOf(project.id), text(project.name)]));
  return (Array.isArray(raw?.included?.boards) ? raw.included.boards : [])
    .filter((board) => idOf(board?.id) && order.has(idOf(board.projectId)))
    .map((board) => ({
      id: idOf(board.id),
      name: text(board.name) || `#${board.id}`,
      projectId: idOf(board.projectId),
      projectName: names.get(idOf(board.projectId)) ?? '',
      order: order.get(idOf(board.projectId)),
      position: position(board.position),
    }))
    .sort((a, b) => a.order - b.order || a.position - b.position || a.id.localeCompare(b.id))
    .map(({ id, name, projectId, projectName }) => ({ id, name, projectId, projectName }));
}

/**
 * The lists (active and closed, by position) and the cards of a board.
 * @param {object} raw answer of GET /api/boards/:id
 */
export function parseBoard(raw) {
  const boardId = idOf(raw?.item?.id);
  const included = raw?.included ?? {};
  const lists = (Array.isArray(included.lists) ? included.lists : [])
    .filter((list) => idOf(list?.id) && Object.values(LIST_TYPES).includes(list.type))
    .map((list) => ({
      id: idOf(list.id),
      name: text(list.name) || `#${list.id}`,
      type: list.type,
      position: position(list.position),
    }))
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const listType = new Map(lists.map((list) => [list.id, list.type]));
  const cards = (Array.isArray(included.cards) ? included.cards : [])
    .filter((card) => idOf(card?.id) && listType.has(idOf(card.listId)))
    .map((card) => {
      const listId = idOf(card.listId);
      const open = listType.get(listId) === LIST_TYPES.ACTIVE && card.isClosed !== true;
      const dueCompleted = card.isDueCompleted === true;
      return {
        id: idOf(card.id),
        name: text(card.name) || `#${card.id}`,
        boardId,
        listId,
        open,
        dueAt: time(card.dueDate),
        dueCompleted,
        position: position(card.position),
      };
    })
    .sort(
      (a, b) =>
        (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) ||
        a.position - b.position ||
        a.id.localeCompare(b.id),
    );
  return { id: boardId, lists, cards };
}

/** The due time that still matters: an open card, its due box not ticked. */
export const pendingDue = (card) =>
  card.open && !card.dueCompleted && card.dueAt !== null ? card.dueAt : null;

// --- Local days -------------------------------------------------------------------

const partsFormatters = new Map();

function zonedParts(ms, timeZone) {
  let format = partsFormatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    partsFormatters.set(timeZone, format);
  }
  const parts = Object.fromEntries(
    format.formatToParts(new Date(ms)).map(({ type, value }) => [type, Number(value)]),
  );
  return parts;
}

/** Offset of `timeZone` from UTC at `ms`, in milliseconds. */
function offsetAt(ms, timeZone) {
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** UTC instant of local midnight of a local calendar day (DST-safe). */
function localMidnight(year, month, day, timeZone) {
  const guess = Date.UTC(year, month - 1, day);
  const first = guess - offsetAt(guess, timeZone);
  let start = guess - offsetAt(first, timeZone);
  // Where the clocks jump at midnight (Chile, Cuba), 00:00 does not exist and
  // the instant found is 23:00 the day before: the day starts an hour later.
  if (zonedParts(start, timeZone).day !== day) {
    start += 60 * 60_000;
  }
  return start;
}

/** UTC instant of a local wall-clock time (in a DST overlap, one of the two). */
export function localTime(year, month, day, hour, minute, timeZone) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const first = wall - offsetAt(wall, timeZone);
  return wall - offsetAt(first, timeZone);
}

/** A time zone Intl knows, else the one of the process. */
export function resolveTimeZone(timeZone) {
  try {
    if (timeZone) {
      new Intl.DateTimeFormat('en-US', { timeZone });
      return timeZone;
    }
  } catch {
    // fall through
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Start and end (exclusive) of the local day holding `now`. */
export function localDay(now, timeZone) {
  const p = zonedParts(now, timeZone);
  const start = localMidnight(p.year, p.month, p.day, timeZone);
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const end = localMidnight(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    timeZone,
  );
  return { start, end };
}

// --- Counters ---------------------------------------------------------------------

/**
 * Counters of one day, for a set of cards (one board, or every followed one).
 * @param {ReturnType<typeof parseBoard>['cards']} cards
 * @param {{ now: number, day: { start: number, end: number } }} options
 */
export function summarize(cards, { now, day }) {
  const open = cards.filter((card) => card.open);
  const dated = open
    .filter((card) => pendingDue(card) !== null)
    .sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id));
  const perList = new Map();
  for (const card of open) {
    perList.set(card.listId, (perList.get(card.listId) ?? 0) + 1);
  }
  return {
    open: open.length,
    overdue: dated.filter((card) => card.dueAt < now).length,
    dueToday: dated.filter((card) => card.dueAt >= day.start && card.dueAt < day.end).length,
    perList,
    next: dated.find((card) => card.dueAt >= now) ?? null,
    // What is left by tonight: overdue first, then today's, by due time.
    agenda: dated.filter((card) => card.dueAt < day.end),
  };
}

const fold = (value) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Find an item by its id (`1890957640519910408`, `#1890…`, as Planka shows
 * it in its addresses) or its exact name (case, accents and repeated blanks
 * ignored).
 * @template {{ id: string, name: string }} T
 * @param {T[]} items
 * @param {unknown} query
 * @returns {{ item: T|null, reason?: 'empty'|'not_found'|'ambiguous' }}
 */
export function findByIdOrName(items, query) {
  const wanted = String(query ?? '').trim();
  if (!wanted) {
    return { item: null, reason: 'empty' };
  }
  const number = wanted.match(/^#?(\d+)$/);
  if (number) {
    const byId = items.find((item) => item.id === number[1]);
    if (byId) {
      return { item: byId };
    }
  }
  const matches = items.filter((item) => fold(item.name) === fold(wanted));
  if (matches.length === 1) {
    return { item: matches[0] };
  }
  return { item: null, reason: matches.length > 1 ? 'ambiguous' : 'not_found' };
}
