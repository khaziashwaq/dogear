/** Share-card templates for reviews (rendered by /u/[username]/reviews/[book]/card). */
export const SHARE_TEMPLATES = [
  { key: "minimal", label: "Minimal editorial" },
  { key: "vintage", label: "Vintage paper" },
  { key: "scrapbook", label: "Scrapbook" },
  { key: "dark", label: "Dark academia" },
] as const;
export type ShareTemplate = (typeof SHARE_TEMPLATES)[number]["key"];
