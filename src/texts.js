// -----------------------------------------------------------------------------
// Texts the integration sends to Gladys outside the widget (src/widgets.js):
// connection status, errors, the "Test the connection" report, scene action
// errors and results. Four languages, the four of the Gladys interface;
// German says "du", Spanish "usted". test/i18n.test.js checks every table.
// -----------------------------------------------------------------------------

import { ERROR_KINDS } from './planka/client.js';

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

export const CONNECTION_TEXT = {
  noUrl: {
    en: 'Enter the address of your Planka in the configuration.',
    fr: "Saisissez l'adresse de votre Planka dans la configuration.",
    de: 'Gib die Adresse deines Planka in der Konfiguration ein.',
    es: 'Introduzca la dirección de su Planka en la configuración.',
  },
  invalidUrl: {
    en: 'Address not understood, e.g. http://192.168.1.20:3000',
    fr: 'Adresse incomprise, ex. http://192.168.1.20:3000',
    de: 'Adresse nicht verstanden, z. B. http://192.168.1.20:3000',
    es: 'Dirección no válida, p. ej. http://192.168.1.20:3000',
  },
  noCredentials: {
    en: 'Enter an API key, or a username and password, in the configuration.',
    fr: "Saisissez une clé d'API, ou un identifiant et un mot de passe, dans la configuration.",
    de: 'Gib in der Konfiguration einen API-Schlüssel oder Benutzername und Passwort ein.',
    es: 'Introduzca una clave de API, o un usuario y una contraseña, en la configuración.',
  },
};

// One short explanation per error kind (src/planka/client.js).
export const ERROR_TEXT = {
  [ERROR_KINDS.UNREACHABLE]: {
    en: 'Planka does not answer',
    fr: 'Planka ne répond pas',
    de: 'Planka antwortet nicht',
    es: 'Planka no responde',
  },
  [ERROR_KINDS.TLS]: {
    en: 'certificate refused: tick "Accept self-signed certificates"',
    fr: 'certificat refusé : cochez « Accepter les certificats auto-signés »',
    de: 'Zertifikat abgelehnt: Aktiviere „Selbstsignierte Zertifikate akzeptieren“',
    es: 'certificado rechazado: marque «Aceptar certificados autofirmados»',
  },
  [ERROR_KINDS.AUTH]: {
    en: 'API key, username or password refused',
    fr: "clé d'API, identifiant ou mot de passe refusé",
    de: 'API-Schlüssel, Benutzername oder Passwort abgelehnt',
    es: 'clave de API, usuario o contraseña rechazados',
  },
  [ERROR_KINDS.TERMS]: {
    en: 'log in once in the Planka web app to accept its terms',
    fr: "connectez-vous une fois dans l'interface de Planka pour accepter ses conditions",
    de: 'melde dich einmal in der Planka-Weboberfläche an, um die Bedingungen zu akzeptieren',
    es: 'inicie sesión una vez en la interfaz web de Planka para aceptar sus condiciones',
  },
  [ERROR_KINDS.TOTP]: {
    en: 'two-factor login: use an API key instead',
    fr: "connexion à deux facteurs : utilisez plutôt une clé d'API",
    de: 'Zwei-Faktor-Anmeldung: Verwende stattdessen einen API-Schlüssel',
    es: 'inicio de sesión de dos factores: use una clave de API',
  },
  [ERROR_KINDS.FORBIDDEN]: {
    en: 'this user may not do this (board viewer?)',
    fr: "cet utilisateur n'a pas ce droit (lecteur du tableau ?)",
    de: 'dieser Benutzer darf das nicht (nur Betrachter des Boards?)',
    es: 'este usuario no tiene este permiso (¿solo lector del tablero?)',
  },
  [ERROR_KINDS.NOT_FOUND]: {
    en: 'board, list or card not found',
    fr: 'tableau, liste ou carte introuvable',
    de: 'Board, Liste oder Karte nicht gefunden',
    es: 'tablero, lista o tarjeta no encontrados',
  },
  [ERROR_KINDS.NOT_PLANKA]: {
    en: 'no Planka 2 API at this address',
    fr: 'aucune API Planka 2 à cette adresse',
    de: 'keine Planka-2-API unter dieser Adresse',
    es: 'no hay ninguna API de Planka 2 en esta dirección',
  },
  [ERROR_KINDS.REDIRECT]: {
    en: 'the address redirects: enter the https:// address',
    fr: "l'adresse redirige : saisissez l'adresse en https://",
    de: 'die Adresse leitet um: Gib die https://-Adresse ein',
    es: 'la dirección redirige: introduzca la dirección https://',
  },
  [ERROR_KINDS.RATE_LIMIT]: {
    en: 'too many requests, retrying later',
    fr: 'trop de requêtes, nouvel essai plus tard',
    de: 'zu viele Anfragen, neuer Versuch später',
    es: 'demasiadas solicitudes, se reintentará más tarde',
  },
  [ERROR_KINDS.HTTP]: {
    en: 'unexpected answer, see the logs',
    fr: 'réponse inattendue, voir les logs',
    de: 'unerwartete Antwort, sieh in den Protokollen nach',
    es: 'respuesta inesperada, consulte los registros',
  },
};

// The "Test the connection" report.
export const REPORT_TEXT = {
  en: {
    ok: (cards, boards) => `Planka OK: ${cards} open card(s) in ${boards} followed board(s).`,
    failed: (reason) => `Planka: ${reason}.`,
  },
  fr: {
    ok: (cards, boards) =>
      `Planka OK : ${cards} carte(s) ouverte(s) dans ${boards} tableau(x) suivi(s).`,
    failed: (reason) => `Planka : ${reason}.`,
  },
  de: {
    ok: (cards, boards) => `Planka OK: ${cards} offene Karte(n) in ${boards} verfolgten Board(s).`,
    failed: (reason) => `Planka: ${reason}.`,
  },
  es: {
    ok: (cards, boards) =>
      `Planka OK: ${cards} tarjeta(s) abierta(s) en ${boards} tablero(s) seguido(s).`,
    failed: (reason) => `Planka: ${reason}.`,
  },
};

// Logged and shown when a board typed in the configuration does not exist.
export const UNKNOWN_BOARDS = {
  en: (names) => `Unknown board(s) ignored: ${names}.`,
  fr: (names) => `Tableau(x) inconnu(s) ignoré(s) : ${names}.`,
  de: (names) => `Unbekannte(s) Board(s) ignoriert: ${names}.`,
  es: (names) => `Tablero(s) desconocido(s) ignorado(s): ${names}.`,
};

// Errors of the scene actions and the widget buttons (shown in Gladys).
export const ACTION_TEXT = {
  notConfigured: {
    en: 'Planka is not configured.',
    fr: "Planka n'est pas configuré.",
    de: 'Planka ist nicht konfiguriert.',
    es: 'Planka no está configurado.',
  },
  emptyTitle: {
    en: 'Give the title of the new card.',
    fr: 'Indiquez le titre de la nouvelle carte.',
    de: 'Gib den Titel der neuen Karte an.',
    es: 'Indique el título de la nueva tarjeta.',
  },
  emptyCard: {
    en: 'Give the name of the card to move.',
    fr: 'Indiquez le nom de la carte à déplacer.',
    de: 'Gib den Namen der zu verschiebenden Karte an.',
    es: 'Indique el nombre de la tarjeta que se va a mover.',
  },
  emptyList: {
    en: 'Give the list to move the card to.',
    fr: 'Indiquez la liste où déplacer la carte.',
    de: 'Gib die Liste an, in die die Karte soll.',
    es: 'Indique la lista a la que mover la tarjeta.',
  },
  badDue: {
    en: 'Due date not understood: 2026-10-24 18:00, 2026-10-24, +2h or +3d.',
    fr: 'Échéance incomprise : 2026-10-24 18:00, 2026-10-24, +2h ou +3d.',
    de: 'Fälligkeit nicht verstanden: 2026-10-24 18:00, 2026-10-24, +2h oder +3d.',
    es: 'Vencimiento no válido: 2026-10-24 18:00, 2026-10-24, +2h o +3d.',
  },
  boardNotFound: {
    en: 'No board has this name in Planka (or it is not followed).',
    fr: "Aucun tableau ne porte ce nom dans Planka (ou il n'est pas suivi).",
    de: 'Kein Board in Planka hat diesen Namen (oder es wird nicht verfolgt).',
    es: 'Ningún tablero tiene este nombre en Planka (o no se sigue).',
  },
  boardAmbiguous: {
    en: 'Several boards have this name: give its id (in its address) instead.',
    fr: 'Plusieurs tableaux portent ce nom : indiquez plutôt son numéro (dans son adresse).',
    de: 'Mehrere Boards haben diesen Namen: Gib stattdessen seine ID an (in seiner Adresse).',
    es: 'Varios tableros tienen este nombre: indique su número (en su dirección).',
  },
  noBoard: {
    en: 'Planka has no board to add the card to.',
    fr: "Planka n'a aucun tableau où ajouter la carte.",
    de: 'Planka hat kein Board, in das die Karte kann.',
    es: 'Planka no tiene ningún tablero donde añadir la tarjeta.',
  },
  listNotFound: {
    en: 'No list of this board has this name.',
    fr: 'Aucune liste de ce tableau ne porte ce nom.',
    de: 'Keine Liste dieses Boards hat diesen Namen.',
    es: 'Ninguna lista de este tablero tiene este nombre.',
  },
  listAmbiguous: {
    en: 'Several lists of this board have this name: give its id instead.',
    fr: 'Plusieurs listes de ce tableau portent ce nom : indiquez plutôt son numéro.',
    de: 'Mehrere Listen dieses Boards haben diesen Namen: Gib stattdessen ihre ID an.',
    es: 'Varias listas de este tablero tienen este nombre: indique su número.',
  },
  noList: {
    en: 'This board has no active list.',
    fr: "Ce tableau n'a aucune liste active.",
    de: 'Dieses Board hat keine aktive Liste.',
    es: 'Este tablero no tiene ninguna lista activa.',
  },
  cardNotFound: {
    en: 'No card of the followed boards has this name.',
    fr: 'Aucune carte des tableaux suivis ne porte ce nom.',
    de: 'Keine Karte der verfolgten Boards hat diesen Namen.',
    es: 'Ninguna tarjeta de los tableros seguidos tiene este nombre.',
  },
  cardAmbiguous: {
    en: 'Several cards have this name: give the board, or the id of the card.',
    fr: 'Plusieurs cartes portent ce nom : indiquez le tableau, ou le numéro de la carte.',
    de: 'Mehrere Karten haben diesen Namen: Gib das Board oder die ID der Karte an.',
    es: 'Varias tarjetas tienen este nombre: indique el tablero o el número de la tarjeta.',
  },
  alreadyDone: {
    en: 'This due date was already done meanwhile: the list is refreshed.',
    fr: 'Cette échéance a déjà été faite entre-temps : la liste est mise à jour.',
    de: 'Diese Fälligkeit wurde inzwischen schon erledigt: Die Liste wird aktualisiert.',
    es: 'Este vencimiento ya se ha hecho entretanto: la lista se actualiza.',
  },
};

// Toast of a widget button (≤ 200 characters).
export const DONE_TEXT = {
  en: (name) => `"${name}": due date done.`,
  fr: (name) => `« ${name} » : échéance faite.`,
  de: (name) => `„${name}“: Fälligkeit erledigt.`,
  es: (name) => `«${name}»: vencimiento hecho.`,
};

// The sentence of the "Read today's cards" scene action, for a message or a
// voice announcement.
const join = (names, and) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} ${and} ${names.at(-1)}`;

export const TODAY_TEXT = {
  en: {
    none: 'No card due today.',
    list: (count, names) => `${count} card(s) due by tonight: ${join(names, 'and')}.`,
    overdue: (count) => ` ${count} overdue.`,
  },
  fr: {
    none: "Aucune carte due aujourd'hui.",
    list: (count, names) => `${count} carte(s) à finir ce soir : ${join(names, 'et')}.`,
    overdue: (count) => ` ${count} en retard.`,
  },
  de: {
    none: 'Heute ist keine Karte fällig.',
    list: (count, names) => `${count} Karte(n) bis heute Abend fällig: ${join(names, 'und')}.`,
    overdue: (count) => ` ${count} überfällig.`,
  },
  es: {
    none: 'Ninguna tarjeta vence hoy.',
    list: (count, names) => `${count} tarjeta(s) para esta noche: ${join(names, 'y')}.`,
    overdue: (count) => ` ${count} atrasada(s).`,
  },
};

export const LANGUAGE_FALLBACK = 'en';

export const pick = (text, language) => text[language] ?? text[LANGUAGE_FALLBACK];

/** A multi-language object from a function of the language. */
export const allLanguages = (render) =>
  Object.fromEntries(Object.keys(INIT_FAILED).map((language) => [language, render(language)]));
