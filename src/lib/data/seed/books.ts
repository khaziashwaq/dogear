// Real books with real ISBNs. Covers resolve through the Open Library Covers API;
// when a cover is unavailable the UI renders a typeset fallback jacket.
// Descriptions are dogear.'s own short editorial blurbs.

export interface SeedBook {
  key: string;
  title: string;
  subtitle?: string;
  authors: string[];
  year: number;
  publisher: string;
  pages: number;
  isbn13: string;
  genres: string[];
  moods: string[];
  description: string;
}

export const SEED_BOOKS: SeedBook[] = [
  {
    key: "piranesi", title: "Piranesi", authors: ["Susanna Clarke"], year: 2020, publisher: "Bloomsbury", pages: 272, isbn13: "9781635575637",
    genres: ["fantasy", "literary fiction"], moods: ["dreamy", "hopeful", "rainy-day"],
    description: "A man lives in a House of endless marble halls, tidal staircases and statues, keeping meticulous journals of its weather and its birds. A quiet, luminous puzzle about wonder, memory and what it costs to be found.",
  },
  {
    key: "secret-history", title: "The Secret History", authors: ["Donna Tartt"], year: 1992, publisher: "Vintage", pages: 559, isbn13: "9781400031702",
    genres: ["dark academia", "literary fiction", "mystery"], moods: ["unsettling", "melancholic", "tense"],
    description: "A scholarship student falls in with an insular circle of Classics students at a Vermont college, and learns exactly how far beauty and Greek can carry a group of friends toward murder. The urtext of dark academia.",
  },
  {
    key: "normal-people", title: "Normal People", authors: ["Sally Rooney"], year: 2018, publisher: "Hogarth", pages: 273, isbn13: "9781984822185",
    genres: ["contemporary", "literary fiction", "romance"], moods: ["heartbreaking", "romantic", "reflective"],
    description: "Connell and Marianne orbit each other from a small town in the west of Ireland to Trinity College Dublin, misunderstanding and rescuing one another in equal measure.",
  },
  {
    key: "a-little-life", title: "A Little Life", authors: ["Hanya Yanagihara"], year: 2015, publisher: "Anchor", pages: 832, isbn13: "9780804172707",
    genres: ["literary fiction", "contemporary"], moods: ["heartbreaking", "melancholic"],
    description: "Four college friends build lives in New York over decades, while one of them, Jude, carries a past he cannot speak about. Enormous, devastating, and impossible to read casually.",
  },
  {
    key: "never-let-me-go", title: "Never Let Me Go", authors: ["Kazuo Ishiguro"], year: 2005, publisher: "Vintage", pages: 288, isbn13: "9781400078776",
    genres: ["literary fiction", "sci-fi"], moods: ["melancholic", "heartbreaking", "reflective"],
    description: "Kathy remembers her childhood at Hailsham, an English boarding school where the students were told they were special. A soft-spoken novel whose quietness is its horror.",
  },
  {
    key: "song-of-achilles", title: "The Song of Achilles", authors: ["Madeline Miller"], year: 2011, publisher: "Ecco", pages: 378, isbn13: "9780062060624",
    genres: ["mythology", "historical fiction", "romance"], moods: ["romantic", "heartbreaking"],
    description: "The Iliad retold by Patroclus, exiled prince and Achilles' companion, from boyhood in Phthia to the walls of Troy. You know how it ends. It ruins you anyway.",
  },
  {
    key: "circe", title: "Circe", authors: ["Madeline Miller"], year: 2018, publisher: "Little, Brown", pages: 393, isbn13: "9780316556347",
    genres: ["mythology", "fantasy"], moods: ["reflective", "hopeful", "adventurous"],
    description: "The witch of Aiaia, banished daughter of Helios, tells her own story: gods and monsters, Odysseus and Daedalus, and the long work of becoming oneself.",
  },
  {
    key: "klara-and-the-sun", title: "Klara and the Sun", authors: ["Kazuo Ishiguro"], year: 2021, publisher: "Knopf", pages: 303, isbn13: "9780593318171",
    genres: ["literary fiction", "sci-fi"], moods: ["melancholic", "hopeful", "reflective"],
    description: "An Artificial Friend watches the world from a shop window, then from inside a family's fragile home, trying to understand love by watching the Sun.",
  },
  {
    key: "tomorrow-x3", title: "Tomorrow, and Tomorrow, and Tomorrow", authors: ["Gabrielle Zevin"], year: 2022, publisher: "Knopf", pages: 416, isbn13: "9780593321201",
    genres: ["contemporary", "literary fiction"], moods: ["reflective", "heartbreaking", "hopeful"],
    description: "Two friends make video games together across thirty years — partners, rivals, never quite lovers. A novel about creative collaboration as a form of intimacy.",
  },
  {
    key: "bell-jar", title: "The Bell Jar", authors: ["Sylvia Plath"], year: 1963, publisher: "Harper Perennial", pages: 294, isbn13: "9780060837020",
    genres: ["classics", "literary fiction"], moods: ["melancholic", "reflective"],
    description: "Esther Greenwood wins a summer internship at a New York magazine and feels the glass close around her. Sharp, funny and frightening about the expectations placed on young women.",
  },
  {
    key: "pachinko", title: "Pachinko", authors: ["Min Jin Lee"], year: 2017, publisher: "Grand Central", pages: 496, isbn13: "9781455563920",
    genres: ["historical fiction", "literary fiction"], moods: ["heartbreaking", "hopeful"],
    description: "Four generations of a Korean family make a life in Japan across the twentieth century. Patient, sweeping and full of small mercies.",
  },
  {
    key: "night-circus", title: "The Night Circus", authors: ["Erin Morgenstern"], year: 2011, publisher: "Anchor", pages: 400, isbn13: "9780307744432",
    genres: ["fantasy", "romance"], moods: ["dreamy", "romantic", "cosy"],
    description: "A black-and-white circus open only at night is the stage for a duel between two young magicians who were never meant to fall in love.",
  },
  {
    key: "norwegian-wood", title: "Norwegian Wood", authors: ["Haruki Murakami"], year: 1987, publisher: "Vintage", pages: 296, isbn13: "9780375704024",
    genres: ["literary fiction", "romance"], moods: ["melancholic", "romantic", "rainy-day"],
    description: "A Beatles song carries Toru back to Tokyo in the late sixties, to Naoko and to Midori, grief and first love. Murakami at his most realist and most tender.",
  },
  {
    key: "mrs-dalloway", title: "Mrs Dalloway", authors: ["Virginia Woolf"], year: 1925, publisher: "Harcourt", pages: 194, isbn13: "9780156628709",
    genres: ["classics", "literary fiction"], moods: ["reflective", "dreamy"],
    description: "A single June day in London: Clarissa Dalloway prepares for a party while a shell-shocked veteran walks the same streets. Consciousness rendered like light through water.",
  },
  {
    key: "giovannis-room", title: "Giovanni's Room", authors: ["James Baldwin"], year: 1956, publisher: "Vintage", pages: 169, isbn13: "9780345806567",
    genres: ["classics", "literary fiction", "romance"], moods: ["heartbreaking", "melancholic"],
    description: "In Paris, an American man waiting for his fiancée falls for an Italian bartender and cannot forgive himself for it. Short, exquisite and unbearably honest.",
  },
  {
    key: "beloved", title: "Beloved", authors: ["Toni Morrison"], year: 1987, publisher: "Vintage", pages: 324, isbn13: "9781400033416",
    genres: ["classics", "historical fiction"], moods: ["unsettling", "heartbreaking"],
    description: "Sethe escaped slavery, but in a house on Bluestone Road in Ohio the past has a body and a name. A ghost story that is also a reckoning.",
  },
  {
    key: "remains-of-the-day", title: "The Remains of the Day", authors: ["Kazuo Ishiguro"], year: 1989, publisher: "Vintage", pages: 245, isbn13: "9780679731726",
    genres: ["literary fiction", "classics"], moods: ["melancholic", "reflective"],
    description: "An English butler takes a motoring trip across the West Country and slowly, politely, avoids looking at the life he did not live.",
  },
  {
    key: "jane-eyre", title: "Jane Eyre", authors: ["Charlotte Brontë"], year: 1847, publisher: "Penguin Classics", pages: 532, isbn13: "9780141441146",
    genres: ["classics", "romance", "gothic"], moods: ["romantic", "unsettling", "rainy-day"],
    description: "An orphaned governess with a fierce conscience arrives at Thornfield Hall, where the master is brooding and the attic is not empty.",
  },
  {
    key: "pride-and-prejudice", title: "Pride and Prejudice", authors: ["Jane Austen"], year: 1813, publisher: "Penguin Classics", pages: 480, isbn13: "9780141439518",
    genres: ["classics", "romance"], moods: ["funny", "romantic", "cosy"],
    description: "Elizabeth Bennet and Mr Darcy misjudge one another magnificently. Still the funniest, sharpest romance in the canon.",
  },
  {
    key: "frankenstein", title: "Frankenstein", authors: ["Mary Shelley"], year: 1818, publisher: "Penguin Classics", pages: 280, isbn13: "9780141439471",
    genres: ["classics", "horror", "gothic", "sci-fi"], moods: ["unsettling", "melancholic"],
    description: "A young scientist makes a living creature and abandons it. Written by a nineteen-year-old, it invented science fiction and has not stopped asking who the monster is.",
  },
  {
    key: "rest-and-relaxation", title: "My Year of Rest and Relaxation", authors: ["Ottessa Moshfegh"], year: 2018, publisher: "Penguin Press", pages: 289, isbn13: "9780525522133",
    genres: ["contemporary", "literary fiction"], moods: ["funny", "unsettling"],
    description: "A young woman in 2000s Manhattan decides to sleep for a year with the help of a spectacularly irresponsible psychiatrist. Bleak, bratty and very funny.",
  },
  {
    key: "conversations-with-friends", title: "Conversations with Friends", authors: ["Sally Rooney"], year: 2017, publisher: "Hogarth", pages: 321, isbn13: "9780451499073",
    genres: ["contemporary", "literary fiction"], moods: ["reflective", "romantic"],
    description: "Frances, a student poet in Dublin, and her ex Bobbi are drawn into the lives of an older married couple. Clever people being careless with each other.",
  },
  {
    key: "dorian-gray", title: "The Picture of Dorian Gray", authors: ["Oscar Wilde"], year: 1890, publisher: "Penguin Classics", pages: 254, isbn13: "9780141439570",
    genres: ["classics", "gothic"], moods: ["unsettling", "funny"],
    description: "A beautiful young man wishes his portrait would age instead of him, and gets his wish. Epigrams and decadence over a rotting core.",
  },
  {
    key: "station-eleven", title: "Station Eleven", authors: ["Emily St. John Mandel"], year: 2014, publisher: "Vintage", pages: 333, isbn13: "9780804172448",
    genres: ["sci-fi", "literary fiction"], moods: ["hopeful", "melancholic", "reflective"],
    description: "Twenty years after a pandemic ends the world as we know it, a travelling troupe performs Shakespeare along the shores of Lake Michigan. A tender post-apocalypse.",
  },
  {
    key: "left-hand-of-darkness", title: "The Left Hand of Darkness", authors: ["Ursula K. Le Guin"], year: 1969, publisher: "Ace", pages: 304, isbn13: "9780441478125",
    genres: ["sci-fi", "classics"], moods: ["reflective", "adventurous"],
    description: "An envoy is sent to the ice world of Gethen, whose people have no fixed sex. Politics, friendship and one of the great journeys across a glacier.",
  },
  {
    key: "babel", title: "Babel", subtitle: "Or the Necessity of Violence", authors: ["R. F. Kuang"], year: 2022, publisher: "Harper Voyager", pages: 545, isbn13: "9780063021426",
    genres: ["fantasy", "dark academia", "historical fiction"], moods: ["tense", "heartbreaking"],
    description: "In an alternate 1830s Oxford, translation powers the British Empire through enchanted silver. A dark-academia fantasy about language, complicity and revolution.",
  },
  {
    key: "yellowface", title: "Yellowface", authors: ["R. F. Kuang"], year: 2023, publisher: "William Morrow", pages: 336, isbn13: "9780063250833",
    genres: ["contemporary", "mystery"], moods: ["funny", "tense"],
    description: "When her more successful friend dies, a struggling author steals her unfinished manuscript and publishes it as her own. A gleefully uncomfortable satire of publishing.",
  },
  {
    key: "evelyn-hugo", title: "The Seven Husbands of Evelyn Hugo", authors: ["Taylor Jenkins Reid"], year: 2017, publisher: "Atria", pages: 389, isbn13: "9781501161933",
    genres: ["historical fiction", "romance", "contemporary"], moods: ["romantic", "heartbreaking"],
    description: "A reclusive Hollywood icon finally tells her life story to an unknown journalist — seven marriages, and the one love she hid from all of them.",
  },
  {
    key: "crying-in-h-mart", title: "Crying in H Mart", authors: ["Michelle Zauner"], year: 2021, publisher: "Knopf", pages: 239, isbn13: "9780525657743",
    genres: ["memoir"], moods: ["heartbreaking", "hopeful"],
    description: "The Japanese Breakfast musician writes about her Korean mother's illness and death, and about cooking her way back to her through food.",
  },
  {
    key: "bluets", title: "Bluets", authors: ["Maggie Nelson"], year: 2009, publisher: "Wave Books", pages: 95, isbn13: "9781933517407",
    genres: ["poetry", "essays"], moods: ["melancholic", "reflective", "rainy-day"],
    description: "Two hundred and forty numbered propositions about the colour blue, heartbreak and a friend's paralysis. Philosophy that reads like a diary.",
  },
  {
    key: "briefly-gorgeous", title: "On Earth We're Briefly Gorgeous", authors: ["Ocean Vuong"], year: 2019, publisher: "Penguin Press", pages: 246, isbn13: "9780525562047",
    genres: ["literary fiction", "poetry"], moods: ["heartbreaking", "dreamy"],
    description: "A letter from a son to his mother who cannot read it: Vietnam, Hartford, tobacco fields, first love. A poet's first novel, with every sentence weighed.",
  },
  {
    key: "convenience-store-woman", title: "Convenience Store Woman", authors: ["Sayaka Murata"], year: 2018, publisher: "Grove Press", pages: 163, isbn13: "9780802128256",
    genres: ["contemporary", "literary fiction"], moods: ["funny", "unsettling"],
    description: "Keiko has worked at the same Tokyo convenience store for eighteen years and is perfectly content. Everyone else is horrified. Small, strange and delightful.",
  },
  {
    key: "hill-house", title: "The Haunting of Hill House", authors: ["Shirley Jackson"], year: 1959, publisher: "Penguin Classics", pages: 182, isbn13: "9780143039983",
    genres: ["horror", "classics", "gothic"], moods: ["unsettling", "tense"],
    description: "Four people spend a summer in a house that was born bad. The finest haunted-house novel ever written, and the loneliest.",
  },
  {
    key: "rebecca", title: "Rebecca", authors: ["Daphne du Maurier"], year: 1938, publisher: "William Morrow", pages: 410, isbn13: "9780380730407",
    genres: ["classics", "gothic", "mystery"], moods: ["unsettling", "romantic", "rainy-day"],
    description: "A shy young bride arrives at Manderley and finds her husband's dead first wife still in every room.",
  },
  {
    key: "wuthering-heights", title: "Wuthering Heights", authors: ["Emily Brontë"], year: 1847, publisher: "Penguin Classics", pages: 416, isbn13: "9780141439556",
    genres: ["classics", "gothic", "romance"], moods: ["unsettling", "heartbreaking", "rainy-day"],
    description: "On the Yorkshire moors, Catherine and Heathcliff's love curdles into a vengeance that poisons two generations. Wild weather, wilder people.",
  },
  {
    key: "dune", title: "Dune", authors: ["Frank Herbert"], year: 1965, publisher: "Ace", pages: 617, isbn13: "9780441172719",
    genres: ["sci-fi", "classics"], moods: ["adventurous", "tense"],
    description: "A ducal heir is thrown onto the desert planet Arrakis, sole source of the universe's most precious substance. Ecology, empire and prophecy in the sand.",
  },
  {
    key: "name-of-the-wind", title: "The Name of the Wind", authors: ["Patrick Rothfuss"], year: 2007, publisher: "DAW", pages: 662, isbn13: "9780756404741",
    genres: ["fantasy"], moods: ["adventurous", "cosy"],
    description: "An innkeeper with a legendary past tells the story of how he became Kvothe: orphan, musician, university student and seeker of a secret name.",
  },
  {
    key: "kafka-on-the-shore", title: "Kafka on the Shore", authors: ["Haruki Murakami"], year: 2002, publisher: "Vintage", pages: 467, isbn13: "9781400079278",
    genres: ["literary fiction", "fantasy"], moods: ["dreamy", "unsettling"],
    description: "A fifteen-year-old runaway and an old man who talks to cats are pulled toward the same small library in Takamatsu. Fish fall from the sky.",
  },
  {
    key: "midnight-library", title: "The Midnight Library", authors: ["Matt Haig"], year: 2020, publisher: "Viking", pages: 288, isbn13: "9780525559474",
    genres: ["contemporary", "fantasy"], moods: ["hopeful", "cosy"],
    description: "Between life and death, Nora Seed finds a library of every life she might have lived, and gets to try them on.",
  },
  {
    key: "intermezzo", title: "Intermezzo", authors: ["Sally Rooney"], year: 2024, publisher: "Farrar, Straus and Giroux", pages: 448, isbn13: "9780374602635",
    genres: ["contemporary", "literary fiction"], moods: ["reflective", "melancholic", "romantic"],
    description: "Two grieving brothers — a chess prodigy and a lawyer — stumble through love and their father's death. Rooney's most ambitious and most tender.",
  },
  {
    key: "small-things", title: "Small Things Like These", authors: ["Claire Keegan"], year: 2021, publisher: "Grove Press", pages: 128, isbn13: "9780802158741",
    genres: ["literary fiction", "historical fiction"], moods: ["reflective", "hopeful", "cosy"],
    description: "In an Irish town in the weeks before Christmas 1985, a coal merchant makes a discovery at the local convent. A perfect, quiet novella about complicity and courage.",
  },
  {
    key: "demon-copperhead", title: "Demon Copperhead", authors: ["Barbara Kingsolver"], year: 2022, publisher: "Harper", pages: 560, isbn13: "9780063251922",
    genres: ["literary fiction", "contemporary"], moods: ["heartbreaking", "funny"],
    description: "David Copperfield transplanted to the opioid-era mountains of southern Appalachia, told by a boy with a voice you won't forget.",
  },
  {
    key: "fourth-wing", title: "Fourth Wing", authors: ["Rebecca Yarros"], year: 2023, publisher: "Entangled: Red Tower", pages: 498, isbn13: "9781649374042",
    genres: ["fantasy", "romance"], moods: ["adventurous", "romantic", "tense"],
    description: "Violet Sorrengail was meant for the quiet life of a scribe. Instead she's ordered into a war college for dragon riders, where the dragons choose — and burn — who they like.",
  },
  {
    key: "bunny", title: "Bunny", authors: ["Mona Awad"], year: 2019, publisher: "Viking", pages: 307, isbn13: "9780525559726",
    genres: ["horror", "dark academia", "contemporary"], moods: ["unsettling", "funny"],
    description: "A scholarship student in an elite MFA programme is invited into a clique of girls who call each other Bunny. Heathers meets a fever dream.",
  },
  {
    key: "stoner", title: "Stoner", authors: ["John Williams"], year: 1965, publisher: "NYRB Classics", pages: 278, isbn13: "9781590171998",
    genres: ["classics", "literary fiction"], moods: ["melancholic", "reflective"],
    description: "The quiet life of an assistant professor of English at the University of Missouri. Nothing happens and it is devastating.",
  },
  {
    key: "kindred", title: "Kindred", authors: ["Octavia E. Butler"], year: 1979, publisher: "Beacon Press", pages: 264, isbn13: "9780807083697",
    genres: ["sci-fi", "historical fiction", "classics"], moods: ["tense", "unsettling"],
    description: "Dana, a Black writer in 1976 Los Angeles, is repeatedly pulled back in time to a Maryland plantation to save the life of a white ancestor.",
  },
  {
    key: "if-we-were-villains", title: "If We Were Villains", authors: ["M. L. Rio"], year: 2017, publisher: "Flatiron", pages: 354, isbn13: "9781250095282",
    genres: ["dark academia", "mystery"], moods: ["tense", "melancholic"],
    description: "Seven Shakespeare students at an elite conservatory begin to play their roles offstage, and one of them ends up dead.",
  },
];

export const GENRES = [
  "literary fiction",
  "fantasy",
  "sci-fi",
  "classics",
  "romance",
  "dark academia",
  "mythology",
  "historical fiction",
  "contemporary",
  "horror",
  "gothic",
  "mystery",
  "memoir",
  "poetry",
  "essays",
] as const;

export const MOODS: { key: string; label: string; blurb: string }[] = [
  { key: "melancholic", label: "melancholic", blurb: "for when you want to feel it" },
  { key: "cosy", label: "cosy", blurb: "tea, blanket, nowhere to be" },
  { key: "unsettling", label: "unsettling", blurb: "lights on, please" },
  { key: "heartbreaking", label: "heartbreaking", blurb: "bring tissues" },
  { key: "hopeful", label: "hopeful", blurb: "a little light" },
  { key: "dreamy", label: "dreamy", blurb: "soft focus, strange logic" },
  { key: "funny", label: "funny", blurb: "laughing on the bus" },
  { key: "tense", label: "tense", blurb: "one more chapter" },
  { key: "romantic", label: "romantic", blurb: "yearning, mostly" },
  { key: "reflective", label: "reflective", blurb: "underline everything" },
  { key: "adventurous", label: "adventurous", blurb: "maps in the endpapers" },
  { key: "rainy-day", label: "rainy day", blurb: "Sunday, grey sky" },
];
