export const CATEGORIES = [
  "All products",
  "AI & machine learning",
  "Productivity",
  "Design",
  "Developer tools",
  "Lifestyle",
  "Finance",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type View =
  | "Discover"
  | "Leaderboard"
  | "Explore"
  | "Saved products"
  | "Maker studio"
  | "Notifications";
export type FeedbackKind = "comment" | "review" | "bug";
export interface Profile {
  id: string;
  name: string;
  handle: string;
}
export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  tags: string[];
  maker_id: string;
  maker_name: string;
  maker_handle: string;
  logo: string;
  theme: string;
  website: string;
  trial_label: string;
  trial_limit: number;
  claim_count: number;
  launch_date: string;
  created_at: string;
  votes_today: number;
  reviews_count: number;
  comments_count: number;
  rating: number;
  screenshot_url: string;
  resource_url: string;
  resource_name: string;
  demo?: boolean;
}
export interface Feedback {
  id: string;
  product_id: string;
  user_id: string;
  author_name: string;
  kind: FeedbackKind;
  body: string;
  rating: number | null;
  status: "open" | "resolved";
  created_at: string;
  attachment_url?: string;
  attachment_name?: string;
  parent_id?: string | null;
}
export interface Claim {
  product_id: string;
  user_id: string;
  code: string;
  created_at: string;
}
export interface Notice {
  id: string;
  text: string;
  created_at: string;
  product_id?: string;
}
export interface AppData {
  products: Product[];
  feedback: Feedback[];
  votes: string[];
  saved: string[];
  claims: Claim[];
  profile: Profile | null;
  notices: Notice[];
}
export type ProductInput = Pick<
  Product,
  | "name"
  | "tagline"
  | "description"
  | "category"
  | "tags"
  | "website"
  | "trial_label"
  | "trial_limit"
  | "screenshot_url"
  | "resource_url"
  | "resource_name"
>;
export const utcDay = (date = new Date()) => date.toISOString().slice(0, 10);
export function sortProducts(products: Product[]) {
  return [...products].sort(
    (a, b) =>
      b.votes_today - a.votes_today ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  );
}
export function safeUrl(raw: string) {
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
