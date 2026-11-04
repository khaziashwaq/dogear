// The sample community that populates demo mode. Every reader, review and list here
// is fictional and written for dogear.; the books and quoted passages are real.

import type { Accent, ListCoverStyle, ProfileMotif, ShelfStatus } from "@/lib/types";

export interface SeedUser {
  key: string;
  username: string;
  displayName: string;
  bio: string;
  pronouns?: string;
  location?: string;
  accent: Accent;
  motif: ProfileMotif;
  genres: string[];
  authors: string[];
  goal?: number;
}

export const DEMO_PASSWORD = "dogear-demo";

export const SEED_USERS: SeedUser[] = [
  { key: "margo", username: "margo", displayName: "Margo Ellison", bio: "Annotating in pencil since 2009. Dark academia apologist. Will lend you my copy and ask about it weekly.", pronouns: "she/her", location: "Edinburgh", accent: "burgundy", motif: "dogear", genres: ["dark academia", "classics", "gothic", "literary fiction"], authors: ["Donna Tartt", "Shirley Jackson", "Kazuo Ishiguro"], goal: 40 },
  { key: "juniper", username: "juniper.reads", displayName: "Juniper Okafor", bio: "Myths, monsters, maps in the endpapers. Currently arguing with a Greek god in my head.", pronouns: "she/they", location: "Lagos → London", accent: "sage", motif: "botanical", genres: ["mythology", "fantasy", "historical fiction"], authors: ["Madeline Miller", "R. F. Kuang", "Ursula K. Le Guin"], goal: 52 },
  { key: "theo", username: "theo_annotates", displayName: "Theo Marchetti", bio: "Margins full of question marks. Rooney defender. Sad books on trains.", pronouns: "he/him", location: "Dublin", accent: "ink", motif: "stripes", genres: ["literary fiction", "contemporary"], authors: ["Sally Rooney", "James Baldwin", "Claire Keegan"], goal: 30 },
  { key: "saoirse", username: "saoirse", displayName: "Saoirse Byrne", bio: "Poems, essays, anything that reads like a diary someone left on a bus.", location: "Galway", accent: "rose", motif: "stars", genres: ["poetry", "essays", "memoir"], authors: ["Maggie Nelson", "Ocean Vuong", "Virginia Woolf"], goal: 25 },
  { key: "kenji", username: "kenji.shelf", displayName: "Kenji Watanabe", bio: "Sci-fi, cats, jazz cafés. If a book has a well in it, I'm interested.", pronouns: "he/him", location: "Osaka", accent: "butter", motif: "stars", genres: ["sci-fi", "literary fiction", "fantasy"], authors: ["Haruki Murakami", "Ursula K. Le Guin", "Octavia E. Butler"], goal: 36 },
  { key: "noor", username: "noor_between_pages", displayName: "Noor Haddad", bio: "Yearning enthusiast. Historical romance and big messy feelings. Will cry at a dedication page.", pronouns: "she/her", location: "Montréal", accent: "rose", motif: "botanical", genres: ["romance", "historical fiction", "contemporary"], authors: ["Taylor Jenkins Reid", "Jane Austen", "Madeline Miller"], goal: 60 },
  { key: "wren", username: "wren", displayName: "Wren Castellanos", bio: "Gothic houses, unreliable narrators, women who should not have married that man.", pronouns: "they/them", location: "Providence", accent: "ink", motif: "dogear", genres: ["horror", "gothic", "classics", "mystery"], authors: ["Shirley Jackson", "Daphne du Maurier", "Mary Shelley"], goal: 45 },
  { key: "ollie", username: "ollie.dnf", displayName: "Ollie Pratt", bio: "Proud DNF-er. Life's too short and my TBR is too long. Reviews are 60% vibes.", pronouns: "he/him", location: "Manchester", accent: "butter", motif: "stripes", genres: ["fantasy", "sci-fi", "contemporary"], authors: ["Patrick Rothfuss", "Frank Herbert", "Rebecca Yarros"], goal: 20 },
  { key: "amara", username: "amara.marginalia", displayName: "Amara Diallo", bio: "Histories and memoirs. I read the acknowledgements first.", pronouns: "she/her", location: "Brooklyn", accent: "sage", motif: "none", genres: ["historical fiction", "memoir", "classics"], authors: ["Toni Morrison", "Min Jin Lee", "Octavia E. Butler"], goal: 50 },
  { key: "bea", username: "bea_bookbinder", displayName: "Beatrix Lund", bio: "I rebind paperbacks in linen. Cosy reads, classics, and long walks to the library.", pronouns: "she/her", location: "Copenhagen", accent: "butter", motif: "botanical", genres: ["classics", "romance", "fantasy"], authors: ["Jane Austen", "Charlotte Brontë", "Erin Morgenstern"], goal: 35 },
];

/** [follower, following] */
export const SEED_FOLLOWS: [string, string][] = [
  ["margo", "wren"], ["margo", "theo"], ["margo", "juniper"], ["margo", "saoirse"], ["margo", "bea"],
  ["juniper", "margo"], ["juniper", "noor"], ["juniper", "kenji"], ["juniper", "amara"],
  ["theo", "saoirse"], ["theo", "margo"], ["theo", "amara"],
  ["saoirse", "theo"], ["saoirse", "margo"], ["saoirse", "kenji"],
  ["kenji", "juniper"], ["kenji", "ollie"], ["kenji", "saoirse"],
  ["noor", "juniper"], ["noor", "bea"], ["noor", "theo"],
  ["wren", "margo"], ["wren", "bea"], ["wren", "amara"],
  ["ollie", "kenji"], ["ollie", "juniper"], ["ollie", "noor"],
  ["amara", "juniper"], ["amara", "theo"], ["amara", "wren"],
  ["bea", "margo"], ["bea", "noor"], ["bea", "wren"],
];

export interface SeedShelf {
  user: string;
  book: string;
  status: ShelfStatus | null;
  rating?: number;
  fav?: boolean;
  shelves?: string[];
  progress?: number;
  daysAgo: number;
}

export const SEED_SHELVES: SeedShelf[] = [
  // margo
  { user: "margo", book: "secret-history", status: "read", rating: 5, fav: true, shelves: ["annotated to death"], daysAgo: 40 },
  { user: "margo", book: "hill-house", status: "read", rating: 4.5, fav: true, daysAgo: 30 },
  { user: "margo", book: "remains-of-the-day", status: "read", rating: 5, fav: true, daysAgo: 60 },
  { user: "margo", book: "if-we-were-villains", status: "read", rating: 3.5, shelves: ["annotated to death"], daysAgo: 12 },
  { user: "margo", book: "babel", status: "reading", progress: 212, daysAgo: 3 },
  { user: "margo", book: "rebecca", status: "read", rating: 4.5, fav: true, daysAgo: 90 },
  { user: "margo", book: "stoner", status: "want_to_read", daysAgo: 8 },
  { user: "margo", book: "piranesi", status: "want_to_read", shelves: ["for a rainy sunday"], daysAgo: 5 },
  { user: "margo", book: "bunny", status: "dnf", rating: 2, daysAgo: 20 },
  { user: "margo", book: "never-let-me-go", status: "read", rating: 4.5, daysAgo: 120 },
  // juniper
  { user: "juniper", book: "circe", status: "read", rating: 5, fav: true, daysAgo: 25 },
  { user: "juniper", book: "song-of-achilles", status: "read", rating: 4.5, fav: true, daysAgo: 45 },
  { user: "juniper", book: "babel", status: "read", rating: 4.5, daysAgo: 6 },
  { user: "juniper", book: "left-hand-of-darkness", status: "reading", progress: 120, daysAgo: 2 },
  { user: "juniper", book: "piranesi", status: "read", rating: 5, fav: true, daysAgo: 70 },
  { user: "juniper", book: "fourth-wing", status: "read", rating: 3, daysAgo: 35 },
  { user: "juniper", book: "pachinko", status: "want_to_read", daysAgo: 9 },
  // theo
  { user: "theo", book: "normal-people", status: "read", rating: 4.5, fav: true, daysAgo: 50 },
  { user: "theo", book: "intermezzo", status: "read", rating: 5, fav: true, daysAgo: 4 },
  { user: "theo", book: "giovannis-room", status: "read", rating: 5, fav: true, daysAgo: 80 },
  { user: "theo", book: "small-things", status: "read", rating: 4.5, daysAgo: 15 },
  { user: "theo", book: "stoner", status: "reading", progress: 140, daysAgo: 1 },
  { user: "theo", book: "a-little-life", status: "read", rating: 4, daysAgo: 200 },
  { user: "theo", book: "conversations-with-friends", status: "read", rating: 3.5, daysAgo: 100 },
  // saoirse
  { user: "saoirse", book: "bluets", status: "read", rating: 5, fav: true, daysAgo: 22 },
  { user: "saoirse", book: "briefly-gorgeous", status: "read", rating: 4.5, fav: true, daysAgo: 33 },
  { user: "saoirse", book: "mrs-dalloway", status: "reading", progress: 88, daysAgo: 2 },
  { user: "saoirse", book: "crying-in-h-mart", status: "read", rating: 4.5, daysAgo: 55 },
  { user: "saoirse", book: "bell-jar", status: "read", rating: 4, daysAgo: 140 },
  { user: "saoirse", book: "normal-people", status: "read", rating: 4, daysAgo: 160 },
  // kenji
  { user: "kenji", book: "kafka-on-the-shore", status: "read", rating: 4.5, fav: true, daysAgo: 28 },
  { user: "kenji", book: "norwegian-wood", status: "read", rating: 4, daysAgo: 64 },
  { user: "kenji", book: "klara-and-the-sun", status: "read", rating: 4, daysAgo: 18 },
  { user: "kenji", book: "dune", status: "reading", progress: 301, daysAgo: 1 },
  { user: "kenji", book: "left-hand-of-darkness", status: "read", rating: 5, fav: true, daysAgo: 110 },
  { user: "kenji", book: "kindred", status: "want_to_read", daysAgo: 7 },
  { user: "kenji", book: "convenience-store-woman", status: "read", rating: 4.5, daysAgo: 10 },
  // noor
  { user: "noor", book: "evelyn-hugo", status: "read", rating: 5, fav: true, daysAgo: 14 },
  { user: "noor", book: "song-of-achilles", status: "read", rating: 5, fav: true, daysAgo: 38 },
  { user: "noor", book: "pride-and-prejudice", status: "read", rating: 5, fav: true, daysAgo: 300 },
  { user: "noor", book: "normal-people", status: "read", rating: 3.5, daysAgo: 42 },
  { user: "noor", book: "night-circus", status: "reading", progress: 160, daysAgo: 2 },
  { user: "noor", book: "fourth-wing", status: "read", rating: 4.5, daysAgo: 26 },
  // wren
  { user: "wren", book: "hill-house", status: "read", rating: 5, fav: true, daysAgo: 16 },
  { user: "wren", book: "rebecca", status: "read", rating: 5, fav: true, daysAgo: 48 },
  { user: "wren", book: "frankenstein", status: "read", rating: 4.5, daysAgo: 75 },
  { user: "wren", book: "bunny", status: "read", rating: 4, daysAgo: 11 },
  { user: "wren", book: "jane-eyre", status: "reading", progress: 300, daysAgo: 3 },
  { user: "wren", book: "beloved", status: "read", rating: 5, fav: true, daysAgo: 130 },
  // ollie
  { user: "ollie", book: "name-of-the-wind", status: "read", rating: 4, daysAgo: 52 },
  { user: "ollie", book: "dune", status: "dnf", rating: 2.5, daysAgo: 19 },
  { user: "ollie", book: "fourth-wing", status: "read", rating: 4, fav: true, daysAgo: 29 },
  { user: "ollie", book: "a-little-life", status: "dnf", daysAgo: 66 },
  { user: "ollie", book: "midnight-library", status: "read", rating: 3.5, daysAgo: 9 },
  { user: "ollie", book: "yellowface", status: "reading", progress: 95, daysAgo: 1 },
  // amara
  { user: "amara", book: "pachinko", status: "read", rating: 5, fav: true, daysAgo: 44 },
  { user: "amara", book: "beloved", status: "read", rating: 5, fav: true, daysAgo: 95 },
  { user: "amara", book: "kindred", status: "read", rating: 4.5, daysAgo: 21 },
  { user: "amara", book: "crying-in-h-mart", status: "read", rating: 4, daysAgo: 13 },
  { user: "amara", book: "demon-copperhead", status: "reading", progress: 240, daysAgo: 2 },
  { user: "amara", book: "small-things", status: "read", rating: 4.5, daysAgo: 8 },
  // bea
  { user: "bea", book: "pride-and-prejudice", status: "read", rating: 5, fav: true, daysAgo: 150 },
  { user: "bea", book: "jane-eyre", status: "read", rating: 4.5, fav: true, daysAgo: 85 },
  { user: "bea", book: "night-circus", status: "read", rating: 4.5, fav: true, daysAgo: 31 },
  { user: "bea", book: "midnight-library", status: "read", rating: 3.5, daysAgo: 17 },
  { user: "bea", book: "wuthering-heights", status: "reading", progress: 120, daysAgo: 4 },
  { user: "bea", book: "piranesi", status: "read", rating: 4.5, daysAgo: 23 },
];

export interface SeedReview {
  user: string;
  book: string;
  rating: number;
  title?: string;
  body: string;
  spoilers?: boolean;
  daysAgo: number;
}

export const SEED_REVIEWS: SeedReview[] = [
  { user: "margo", book: "secret-history", rating: 5, title: "a love letter to bad decisions in good coats", daysAgo: 39,
    body: "Fourth reread and I still think the first sentence is a dare. Richard is the most unreliable kind of narrator: the one who desperately wants you to like the people he's describing. Every time I go back I catch him lying a little earlier.\n\nIt's a book about beauty as a moral alibi. Everyone is so clever and so cold and you want to sit at that table anyway. Henry remains the most dangerous man in fiction to have ever owned a pair of reading glasses." },
  { user: "margo", book: "if-we-were-villains", rating: 3.5, title: "Shakespeare kids, unwell", daysAgo: 11,
    body: "Gorgeous premise, and the scenes where they speak in verse at the dinner table genuinely delighted me. But it wants so badly to be The Secret History that it forgets to be itself in the middle third. Still: the last act? Worth it." },
  { user: "juniper", book: "circe", rating: 5, title: "a witch, finally allowed to be bored, angry and free", daysAgo: 24,
    body: "Miller writes immortality as loneliness measured in centuries, and then lets Circe fill that time with herbs, pigs, lovers, a son. I loved that the climax is a choice rather than a battle. I want to plant a garden about it." },
  { user: "juniper", book: "babel", rating: 4.5, daysAgo: 5,
    body: "The footnotes alone deserve a review. Kuang builds a magic system out of the gap between two words and then uses it to indict an entire empire. Robin's arc made me furious in the right way. Ramy deserved better (we all know).", spoilers: true },
  { user: "theo", book: "intermezzo", rating: 5, title: "Peter's chapters made me hold my breath", daysAgo: 3,
    body: "I didn't know Rooney could write like this. Peter's sections are clipped, jagged, almost unpunctuated — a man thinking faster than he can feel. Ivan's are slow and literal and devastatingly sweet. It's a book about grief that is mostly about tenderness, and I'm still a bit wrecked." },
  { user: "theo", book: "small-things", rating: 4.5, daysAgo: 14,
    body: "128 pages and not a wasted word. Bill Furlong's decency is so ordinary and so costly. Read it in one sitting on the train back from Wexford and had to stare out the window for a while after." },
  { user: "saoirse", book: "bluets", rating: 5, title: "proposition 1: I have underlined all of it", daysAgo: 21,
    body: "Reading Bluets feels like eavesdropping on someone who is trying very hard to be honest. It's philosophy, it's heartbreak, it's a list of every blue thing she's ever loved. I bought a blue notebook immediately. I am a cliché and I'm at peace with it." },
  { user: "saoirse", book: "briefly-gorgeous", rating: 4.5, daysAgo: 32,
    body: "A novel written by a poet, which means some pages are so beautiful you have to put the book face down on your chest. The tobacco field chapters are among the best things I've read this year." },
  { user: "kenji", book: "kafka-on-the-shore", rating: 4.5, title: "the cat chapters are canon to me", daysAgo: 27,
    body: "Nakata talking to cats is the emotional centre of this book and nobody can tell me otherwise. The Kafka half is strange and occasionally frustrating, but the metaphysical storm stuff stayed with me for weeks. Best read in a small library while it rains." },
  { user: "kenji", book: "convenience-store-woman", rating: 4.5, daysAgo: 9,
    body: "Keiko is the most well-adjusted protagonist I've ever met and the world simply cannot handle it. Funny, eerie, and over in an afternoon. I now say \"Irasshaimase!\" in my head when I open the fridge." },
  { user: "noor", book: "evelyn-hugo", rating: 5, title: "the green dress. that's the review.", daysAgo: 13,
    body: "I picked this up expecting glamour and got a love story that made me sob on public transport. Evelyn is monstrous and magnificent and I would let her ruin my life. Celia St. James, you will always be famous." },
  { user: "noor", book: "song-of-achilles", rating: 5, daysAgo: 37,
    body: "Third read. Still thought it might end differently this time. The last chapter is not a chapter, it's a wound." },
  { user: "wren", book: "hill-house", rating: 5, title: "the house is not haunted, the house is lonely", daysAgo: 15,
    body: "Jackson understood that the scariest thing in a haunted house is the person who wants to stay. Eleanor's longing to belong anywhere, even somewhere that wants to eat her, is the real ghost. The opening paragraph is perfect and I will die on this hill (house)." },
  { user: "wren", book: "bunny", rating: 4, daysAgo: 10,
    body: "This book is a sugar-glazed nightmare. The Bunnies' dialogue is so funny it hurts and then suddenly it's body horror. Not for everyone. Absolutely for me." },
  { user: "ollie", book: "dune", rating: 2.5, title: "DNF at page 310, respectfully", daysAgo: 18,
    body: "I get it. I get why it's important. But I don't need four pages of internal monologue every time someone raises an eyebrow. Will watch the films instead and feel only slightly guilty. The sandworms are great though." },
  { user: "ollie", book: "fourth-wing", rating: 4, daysAgo: 28,
    body: "Is it literature? No. Did I read it in two days with my heart rate up the entire time? Yes. Tairn is the best character and he's a dragon who is mostly annoyed." },
  { user: "amara", book: "pachinko", rating: 5, title: "\"history has failed us, but no matter\"", daysAgo: 43,
    body: "Min Jin Lee lets time move like weather over this family. No one is a hero, everyone is trying. Sunja is one of the great literary mothers. I read the last section twice." },
  { user: "amara", book: "kindred", rating: 4.5, daysAgo: 20,
    body: "Butler wastes no time on the mechanics of the time travel because the point isn't how — it's what it does to Dana to keep surviving. Terrifying, clear-eyed, essential." },
  { user: "bea", book: "night-circus", rating: 4.5, title: "a book to read by candlelight", daysAgo: 30,
    body: "The plot is gossamer, but who cares when the tents are this beautiful? I want to live in the Ice Garden. I want a scarf in exactly that shade of red. Perfect for a November weekend." },
  { user: "bea", book: "piranesi", rating: 4.5, daysAgo: 22,
    body: "I read this slowly, one hall a night. It made me want to be kinder to birds and more curious about statues. The reveal is clever but the real joy is Piranesi himself — the gentlest narrator I've met." },
];

export interface SeedQuote {
  user: string;
  book: string;
  body: string;
  page?: string;
  commentary?: string;
  daysAgo: number;
}

export const SEED_QUOTES: SeedQuote[] = [
  { user: "juniper", book: "piranesi", body: "The Beauty of the House is immeasurable; its Kindness infinite.", commentary: "Saying this to myself every morning now.", daysAgo: 68 },
  { user: "margo", book: "secret-history", body: "Does such a thing as 'the fatal flaw,' that showy dark crack running down the middle of a life, exist outside literature?", page: "1", commentary: "The first line that started it all.", daysAgo: 38 },
  { user: "saoirse", book: "bell-jar", body: "I took a deep breath and listened to the old brag of my heart. I am, I am, I am.", commentary: "Written on a post-it on my mirror.", daysAgo: 6 },
  { user: "bea", book: "jane-eyre", body: "I am no bird; and no net ensnares me: I am a free human being with an independent will.", daysAgo: 84 },
  { user: "saoirse", book: "mrs-dalloway", body: "Mrs. Dalloway said she would buy the flowers herself.", page: "3", commentary: "The best opening sentence in English, don't @ me.", daysAgo: 1 },
  { user: "noor", book: "pride-and-prejudice", body: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.", daysAgo: 52 },
  { user: "wren", book: "frankenstein", body: "Beware; for I am fearless, and therefore powerful.", commentary: "The creature had a point.", daysAgo: 74 },
  { user: "wren", book: "rebecca", body: "Last night I dreamt I went to Manderley again.", page: "1", daysAgo: 47 },
  { user: "wren", book: "hill-house", body: "…and whatever walked there, walked alone.", page: "1", commentary: "Chills, every single time.", daysAgo: 15 },
  { user: "bea", book: "wuthering-heights", body: "Whatever our souls are made of, his and mine are the same.", daysAgo: 4 },
  { user: "noor", book: "song-of-achilles", body: "He is half of my soul, as the poets say.", commentary: "I'm fine. Totally fine.", daysAgo: 36 },
  { user: "juniper", book: "circe", body: "But in a solitary life, there are rare moments when another soul dips near yours, as stars once a year brush the earth.", daysAgo: 24 },
  { user: "kenji", book: "dune", body: "I must not fear. Fear is the mind-killer.", commentary: "Reading this before every dentist appointment.", daysAgo: 2 },
  { user: "kenji", book: "kafka-on-the-shore", body: "And once the storm is over, you won't remember how you made it through, how you managed to survive.", daysAgo: 26 },
  { user: "saoirse", book: "bluets", body: "Suppose I were to begin by saying that I had fallen in love with a color.", page: "1", daysAgo: 21 },
  { user: "theo", book: "dorian-gray", body: "The only way to get rid of a temptation is to yield to it.", commentary: "Wilde was a menace and I love him.", daysAgo: 58 },
  { user: "saoirse", book: "briefly-gorgeous", body: "Let me begin again.", page: "3", daysAgo: 31 },
  { user: "bea", book: "night-circus", body: "The circus arrives without warning.", page: "3", daysAgo: 30 },
  { user: "ollie", book: "midnight-library", body: "Between life and death there is a library.", daysAgo: 9 },
  { user: "juniper", book: "station-eleven", body: "Because survival is insufficient.", daysAgo: 100 },
];

export interface SeedList {
  key: string;
  user: string;
  title: string;
  description: string;
  cover: ListCoverStyle;
  ranked?: boolean;
  books: { book: string; note?: string }[];
  daysAgo: number;
}

export const SEED_LISTS: SeedList[] = [
  { key: "radiohead", user: "kenji", title: "Books that feel like Radiohead songs", cover: "ink", daysAgo: 12,
    description: "Paranoid androids, quiet dread, weirdly tender. Best read with headphones on and the lights low.",
    books: [{ book: "klara-and-the-sun", note: "this is literally 'Fake Plastic Trees'" }, { book: "never-let-me-go", note: "No Surprises" }, { book: "kafka-on-the-shore" }, { book: "station-eleven", note: "How to Disappear Completely" }, { book: "convenience-store-woman" }] },
  { key: "broke-my-heart", user: "noor", title: "Books that broke my heart", cover: "rose", ranked: true, daysAgo: 20,
    description: "Ranked by how long I had to stare at the ceiling afterwards.",
    books: [{ book: "song-of-achilles", note: "obviously" }, { book: "a-little-life" }, { book: "giovannis-room" }, { book: "evelyn-hugo" }, { book: "never-let-me-go" }, { book: "normal-people" }] },
  { key: "overthinkers", user: "theo", title: "Literature for overthinkers", cover: "sage", daysAgo: 8,
    description: "Narrators who think about thinking. If you've ever replayed a conversation from 2017 at 3am, welcome home.",
    books: [{ book: "remains-of-the-day" }, { book: "mrs-dalloway" }, { book: "intermezzo" }, { book: "bluets" }, { book: "stoner" }, { book: "conversations-with-friends" }] },
  { key: "rainy-sunday", user: "bea", title: "Books to read on a rainy Sunday", cover: "butter", daysAgo: 5,
    description: "Kettle on. Socks on. Phone in another room.",
    books: [{ book: "piranesi", note: "the tides!" }, { book: "night-circus" }, { book: "small-things" }, { book: "midnight-library" }, { book: "jane-eyre" }, { book: "norwegian-wood" }] },
  { key: "red-flags", user: "wren", title: "My literary red flags", cover: "burgundy", daysAgo: 16,
    description: "Men I would have married anyway. A cautionary tale in six volumes.",
    books: [{ book: "wuthering-heights", note: "Heathcliff, no" }, { book: "rebecca", note: "Maxim, NO" }, { book: "jane-eyre", note: "the attic, Edward" }, { book: "secret-history", note: "Henry. Just Henry." }, { book: "dorian-gray" }] },
  { key: "dark-academia-starter", user: "margo", title: "Dark academia, a starter kit", cover: "collage", ranked: true, daysAgo: 35,
    description: "Tweed, Greek, terrible choices. Read in this order for maximum unease.",
    books: [{ book: "secret-history" }, { book: "if-we-were-villains" }, { book: "babel" }, { book: "bunny" }, { book: "stoner", note: "the gentle palate cleanser" }] },
  { key: "myths-retold", user: "juniper", title: "Myths, retold by the people they happened to", cover: "sage", daysAgo: 27,
    description: "Gods, witches and boys who loved heroes, finally getting the mic.",
    books: [{ book: "circe" }, { book: "song-of-achilles" }, { book: "piranesi", note: "not a myth, but it feels like one" }] },
];

export interface SeedUpdate {
  user: string;
  book?: string;
  body: string;
  progressPercent?: number;
  kind?: "update" | "recommendation";
  daysAgo: number;
}

export const SEED_UPDATES: SeedUpdate[] = [
  { user: "margo", book: "babel", body: "Page 212 and the footnotes have started fighting each other. Love it here.", progressPercent: 39, daysAgo: 0.2 },
  { user: "theo", book: "stoner", body: "Reading Stoner on a delayed train feels thematically appropriate.", progressPercent: 50, daysAgo: 0.6 },
  { user: "kenji", book: "dune", body: "Page 301. The spice must flow and so must my coffee.", progressPercent: 49, daysAgo: 0.9 },
  { user: "noor", book: "night-circus", body: "Le Cirque des Rêves has entered my dreams, literally. Halfway and swooning.", progressPercent: 40, daysAgo: 1.4 },
  { user: "saoirse", book: "mrs-dalloway", body: "Reading Woolf on a park bench like the cliché I aspire to be.", progressPercent: 45, daysAgo: 1.8 },
  { user: "ollie", book: "yellowface", body: "June Hayward is the worst person I've ever spent a weekend with and I cannot stop.", progressPercent: 28, daysAgo: 0.4 },
  { user: "amara", book: "demon-copperhead", body: "Demon's voice is so alive. Dickens would be proud and also a bit jealous.", progressPercent: 43, daysAgo: 1.1 },
  { user: "juniper", kind: "recommendation", book: "left-hand-of-darkness", body: "If you loved Piranesi's quiet strangeness, try Le Guin's ice planet next. Same feeling of being let into a world slowly.", daysAgo: 2.2 },
  { user: "wren", kind: "recommendation", book: "hill-house", body: "October is over but Hill House season never ends. 182 pages. No excuses.", daysAgo: 3.5 },
];

/** Comments: [user, target post descriptor, body] — target resolved in the seeder. */
export const SEED_COMMENTS: { user: string; on: { reviewOf: [string, string] } | { quoteOf: [string, string] } | { list: string }; body: string; reply?: { user: string; body: string } }[] = [
  { user: "wren", on: { reviewOf: ["margo", "secret-history"] }, body: "Henry and his reading glasses. You've ruined me.", reply: { user: "margo", body: "He'd read Homer at your funeral and you'd thank him for it." } },
  { user: "theo", on: { reviewOf: ["margo", "secret-history"] }, body: "Fourth reread?? Respect. I'm scared to do a second." },
  { user: "noor", on: { reviewOf: ["juniper", "circe"] }, body: "\"I want to plant a garden about it\" is the most accurate review of Circe ever written." },
  { user: "saoirse", on: { reviewOf: ["theo", "intermezzo"] }, body: "Peter's chapters!!! I had to read them out loud to keep up.", reply: { user: "theo", body: "Exactly — it's like he's out of breath the whole time." } },
  { user: "kenji", on: { list: "radiohead" }, body: "Should I add Piranesi as 'Everything in Its Right Place'?" },
  { user: "juniper", on: { list: "radiohead" }, body: "Yes, and Le Guin is 'Reckoner'." },
  { user: "bea", on: { reviewOf: ["wren", "hill-house"] }, body: "Die on this hill (house). Iconic." },
  { user: "ollie", on: { reviewOf: ["noor", "evelyn-hugo"] }, body: "Okay fine I'm adding it to my TBR." },
  { user: "margo", on: { list: "red-flags" }, body: "Henry being on this list is personal and correct." },
  { user: "amara", on: { quoteOf: ["saoirse", "bell-jar"] }, body: "I have this one written inside my journal cover." },
];

/** Likes: [user, descriptor] */
export const SEED_LIKES: { user: string; on: { reviewOf: [string, string] } | { quoteOf: [string, string] } | { list: string } }[] = [
  ...["wren", "theo", "juniper", "bea", "saoirse"].map((u) => ({ user: u, on: { reviewOf: ["margo", "secret-history"] as [string, string] } })),
  ...["noor", "amara", "kenji", "margo"].map((u) => ({ user: u, on: { reviewOf: ["juniper", "circe"] as [string, string] } })),
  ...["saoirse", "margo", "amara", "noor", "kenji", "bea"].map((u) => ({ user: u, on: { reviewOf: ["theo", "intermezzo"] as [string, string] } })),
  ...["theo", "margo", "kenji"].map((u) => ({ user: u, on: { reviewOf: ["saoirse", "bluets"] as [string, string] } })),
  ...["juniper", "ollie", "saoirse", "theo", "noor", "margo", "wren"].map((u) => ({ user: u, on: { list: "radiohead" } })),
  ...["juniper", "bea", "theo", "amara", "ollie"].map((u) => ({ user: u, on: { list: "broke-my-heart" } })),
  ...["saoirse", "margo", "amara"].map((u) => ({ user: u, on: { list: "overthinkers" } })),
  ...["noor", "margo", "wren", "juniper"].map((u) => ({ user: u, on: { list: "rainy-sunday" } })),
  ...["margo", "bea", "noor", "theo", "amara", "saoirse"].map((u) => ({ user: u, on: { list: "red-flags" } })),
  ...["margo", "bea", "amara", "juniper"].map((u) => ({ user: u, on: { reviewOf: ["wren", "hill-house"] as [string, string] } })),
  ...["juniper", "bea", "ollie", "theo"].map((u) => ({ user: u, on: { reviewOf: ["noor", "evelyn-hugo"] as [string, string] } })),
  ...["kenji", "juniper"].map((u) => ({ user: u, on: { reviewOf: ["ollie", "dune"] as [string, string] } })),
  ...["theo", "margo", "kenji", "amara", "wren"].map((u) => ({ user: u, on: { quoteOf: ["saoirse", "bell-jar"] as [string, string] } })),
  ...["margo", "kenji", "bea"].map((u) => ({ user: u, on: { quoteOf: ["juniper", "piranesi"] as [string, string] } })),
  ...["margo", "bea", "theo"].map((u) => ({ user: u, on: { quoteOf: ["wren", "hill-house"] as [string, string] } })),
];
