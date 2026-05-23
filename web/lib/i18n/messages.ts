/**
 * UI string dictionary for the two supported languages.
 *
 * The shape of `en` is pinned to `typeof fr`, so the compiler refuses to build
 * if any French string is missing its English counterpart (or vice-versa). This
 * is our guarantee that the translation never silently drifts.
 *
 * Country / capital / continent / region / difficulty *display* names are NOT
 * here — they live in `geo.ts`, derived from the existing data files.
 */
export type Lang = "fr" | "en";

export const LANGS: Lang[] = ["fr", "en"];
export const DEFAULT_LANG: Lang = "fr";

// French is the source of truth; `en` must mirror its shape exactly.
const fr = {
  // Brand line + global chrome
  common: {
    tagline: "Géographie · temps réel",
    leave: "Quitter",
    back: "Retour à l'accueil",
    home: "Accueil",
    room: "Room", // already "Room" in the FR v1 — kept verbatim
    pts: "pts",
    loading: "Chargement…",
  },

  // Game mode display names (used on home, lobby, game, results headers)
  mode: {
    conquest: "Conquête",
    mystery: "Pays Mystère",
    capitals: "Capitales",
    // Short form used in the home-screen 3-up selector
    conquestShort: "Conquête",
    mysteryShort: "Mystère",
    capitalsShort: "Capitales",
  },

  home: {
    heroLabel: "Multijoueur en temps réel",
    // Rendered as three lines; the third is accented.
    heroLine1: "Conquiers",
    heroLine2: "le monde,",
    heroLine3: "vite.",
    heroBody:
      "Tape le nom d'un pays avant les autres. Verrouille le territoire. Plus le pays est dur à trouver, plus il rapporte. Domine la carte avant la fin du chrono.",
    statCountries: "Pays",
    statPtsPerCountry: "Pts / pays",
    statPlayers: "Joueurs",
    yourName: "Ton nom",
    gameMode: "Mode de jeu",
    creating: "Création…",
    createGame: "Créer une partie ↗",
    orJoin: "ou rejoindre",
    codePlaceholder: "CODE",
    join: "Rejoindre",
  },

  lobby: {
    connecting: "Connexion au salon…",
    lobby: "Lobby",
    waiting: (n: number, max: number) => `En attente · ${n} / ${max} joueurs`,
    setup: "Configuration de la partie",
    gameDuration: "Durée de la partie",
    roundDuration: "Durée par manche",
    region: "Région",
    world: "Monde",
    countryCount: "Nombre de pays",
    allCountriesIn: (n: number, region: string) => `Tous les ${n} pays d'${region}`,
    all: "Tous",
    difficulty: "Difficulté — Tolérance aux fautes",
    difficultyLenient: "Souple (alias + orthographe approx.)",
    difficultyStrict: "Stricte (exact)",
    maxPlayers: "Joueurs max",
    visibility: "Visibilité",
    public: "Public",
    private: "Privé",
    starting: "Démarrage…",
    startGame: "Lancer la partie →",
    hostHint: "Hôte · tu peux lancer quand tu veux",
    waitingForHost: "En attente du démarrage par l'hôte…",
    playersPresent: (n: number, max: number) => `Joueurs présents · ${n}/${max}`,
    openSlot: "Slot libre",
    host: "Hôte",
    min: (n: number) => `${n} min`,
    sec: (n: number) => `${n}s`,
  },

  game: {
    loading: "Chargement de la partie…",
    timeLeft: "Restant",
    round: "Manche",
    countries: "Pays",
    yourRank: "Ton rang",
    liveRanking: "Classement live",
    yourScore: "Ton score",
    leading: "En tête",
    behind: (n: number) => `${n} d'écart`,
    conquestStat: (count: number, area: string, pct: string) => `${count} pays · ${area} · ${pct}%`,
    capitalsFound: (n: number) => `${n} capitales trouvées`,
    countriesFound: (n: number) => `${n} pays trouvés`,
    capitalOf: "Capitale de",
    answer: "Réponse",
    score: "Score",
    countriesShort: "pays",
    // Input bar
    phNoTries: "Plus d'essais cette manche",
    phRevealed: "Réponse révélée…",
    phCapital: "Quelle est la capitale ?",
    phMystery: "Quel est ce pays ?",
    phConquest: "Tape un pays…",
    hintNextRound: "Manche suivante dans un instant…",
    hintNoTries: "Plus d'essais — attends la réponse",
    hintTries: (cur: number, max: number) => `Essai ${cur} / ${max} · devine sans indice`,
    hintConquest: "↵ Valider · Esc effacer · Devine sans indice",
    btnAnswer: "Réponse",
    btnLock: "Verrouiller",
  },

  results: {
    gameOver: "Fin de partie",
    verdict: "Verdict",
    youRuleA: "Tu domines",
    youRuleB: "la carte.",
    playerRules: (name: string) => `${name}`, // name styled separately; suffix below
    rulesSuffix: "domine la carte.",
    finished: "Partie terminée.",
    champion: "Champion",
    rank: (n: number) => `${n}e`,
    playAgain: "Rejouer",
    players: "Joueurs",
    inGame: "dans la partie",
    countriesConquered: "Pays conquis",
    biggestEmpire: "Plus grand empire",
    ofWorld: "du monde",
    countriesFoundStat: "Pays trouvés",
    inTotal: "au total",
    points: (n: number) => `${n} points`,
    worldDistribution: "Répartition mondiale",
    thPlayer: "Joueur",
    thCountries: "Pays",
    thScore: "Score",
    podiumCountries: (n: number) => `${n} pays`,
    podiumFound: (n: number) => `${n} trouvés`,
  },

  chat: {
    title: "Discussion",
    placeholder: "Écris un message…",
  },

  // Client-side network error fallbacks (lib/api.ts)
  netError: {
    timeout: "Délai dépassé",
    network: "Erreur réseau",
    http: (status: number) => `HTTP ${status}`,
  },
};

const en: typeof fr = {
  common: {
    tagline: "Geography · real-time",
    leave: "Leave",
    back: "Back to home",
    home: "Home",
    room: "Room",
    pts: "pts",
    loading: "Loading…",
  },

  mode: {
    conquest: "Conquest",
    mystery: "Mystery Country",
    capitals: "Capitals",
    conquestShort: "Conquest",
    mysteryShort: "Mystery",
    capitalsShort: "Capitals",
  },

  home: {
    heroLabel: "Real-time multiplayer",
    heroLine1: "Conquer",
    heroLine2: "the world,",
    heroLine3: "fast.",
    heroBody:
      "Type a country's name before everyone else. Lock down the territory. The harder the country, the more it's worth. Rule the map before the clock runs out.",
    statCountries: "Countries",
    statPtsPerCountry: "Pts / country",
    statPlayers: "Players",
    yourName: "Your name",
    gameMode: "Game mode",
    creating: "Creating…",
    createGame: "Create a game ↗",
    orJoin: "or join",
    codePlaceholder: "CODE",
    join: "Join",
  },

  lobby: {
    connecting: "Connecting to room…",
    lobby: "Lobby",
    waiting: (n: number, max: number) => `Waiting · ${n} / ${max} players`,
    setup: "Game setup",
    gameDuration: "Game duration",
    roundDuration: "Round duration",
    region: "Region",
    world: "World",
    countryCount: "Number of countries",
    allCountriesIn: (n: number, region: string) => `All ${n} countries in ${region}`,
    all: "All",
    difficulty: "Difficulty — Typo tolerance",
    difficultyLenient: "Lenient (aliases + approx. spelling)",
    difficultyStrict: "Strict (exact)",
    maxPlayers: "Max players",
    visibility: "Visibility",
    public: "Public",
    private: "Private",
    starting: "Starting…",
    startGame: "Start game →",
    hostHint: "Host · start whenever you like",
    waitingForHost: "Waiting for the host to start…",
    playersPresent: (n: number, max: number) => `Players · ${n}/${max}`,
    openSlot: "Open slot",
    host: "Host",
    min: (n: number) => `${n} min`,
    sec: (n: number) => `${n}s`,
  },

  game: {
    loading: "Loading the game…",
    timeLeft: "Time left",
    round: "Round",
    countries: "Countries",
    yourRank: "Your rank",
    liveRanking: "Live ranking",
    yourScore: "Your score",
    leading: "Leading",
    behind: (n: number) => `${n} behind`,
    conquestStat: (count: number, area: string, pct: string) => `${count} countries · ${area} · ${pct}%`,
    capitalsFound: (n: number) => `${n} capitals found`,
    countriesFound: (n: number) => `${n} countries found`,
    capitalOf: "Capital of",
    answer: "Answer",
    score: "Score",
    countriesShort: "countries",
    phNoTries: "No tries left this round",
    phRevealed: "Answer revealed…",
    phCapital: "What's the capital?",
    phMystery: "Which country is this?",
    phConquest: "Type a country…",
    hintNextRound: "Next round in a moment…",
    hintNoTries: "No tries left — wait for the answer",
    hintTries: (cur: number, max: number) => `Try ${cur} / ${max} · guess with no hint`,
    hintConquest: "↵ Submit · Esc clear · guess with no hint",
    btnAnswer: "Answer",
    btnLock: "Lock in",
  },

  results: {
    gameOver: "Game over",
    verdict: "Verdict",
    youRuleA: "You rule",
    youRuleB: "the map.",
    playerRules: (name: string) => `${name}`,
    rulesSuffix: "rules the map.",
    finished: "Game over.",
    champion: "Champion",
    rank: (n: number) => ordinalEn(n),
    playAgain: "Play again",
    players: "Players",
    inGame: "in the game",
    countriesConquered: "Countries conquered",
    biggestEmpire: "Biggest empire",
    ofWorld: "of the world",
    countriesFoundStat: "Countries found",
    inTotal: "in total",
    points: (n: number) => `${n} points`,
    worldDistribution: "World distribution",
    thPlayer: "Player",
    thCountries: "Countries",
    thScore: "Score",
    podiumCountries: (n: number) => `${n} countries`,
    podiumFound: (n: number) => `${n} found`,
  },

  chat: {
    title: "Chat",
    placeholder: "Write a message…",
  },

  netError: {
    timeout: "Request timed out",
    network: "Network error",
    http: (status: number) => `HTTP ${status}`,
  },
};

/** English ordinal suffix for podium ranks (1st, 2nd, 3rd…). */
function ordinalEn(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export const MESSAGES: Record<Lang, typeof fr> = { fr, en };

/** The message dictionary for a given language. */
export function dict(lang: Lang): typeof fr {
  return MESSAGES[lang] ?? MESSAGES[DEFAULT_LANG];
}

/**
 * Known French error strings returned by the API (`bad("…")`) mapped to a
 * translator. The server is intentionally left untouched (French v1), so the
 * client translates these by lookup. Anything not listed falls through to the
 * raw string — never blank.
 */
export const SERVER_ERROR_EN: Record<string, string> = {
  "Identifiant utilisateur manquant": "Missing user identifier",
  "Trop rapide": "Too fast",
  "Partie introuvable": "Game not found",
  "Partie non démarrée": "Game not started",
  "Vous n'êtes pas dans la partie": "You're not in this game",
  "Seul l'hôte peut démarrer": "Only the host can start",
  "Pas assez de joueurs": "Not enough players",
  "Impossible de démarrer la partie": "Couldn't start the game",
  "Écriture bloquée par la base": "Write blocked by the database",
  "Seul l'hôte peut changer les paramètres": "Only the host can change settings",
  "Partie déjà démarrée": "Game already started",
  "Partie terminée": "Game over",
  "Seul l'hôte peut relancer": "Only the host can restart",
  "Partie complète": "Game full",
  "Pseudo déjà pris dans ce salon": "That name is already taken in this room",
  "Impossible de créer la partie": "Couldn't create the game",
  "Erreur interne": "Internal error",
  "Entrée invalide": "Invalid input",
};

/** Translate a server-returned error message for display in `lang`. */
export function translateServerError(message: string, lang: Lang): string {
  if (lang === "fr") return message;
  return SERVER_ERROR_EN[message] ?? message;
}
