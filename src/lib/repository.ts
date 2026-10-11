import { createClient } from "@supabase/supabase-js";
import { seedData } from "./seed";
import {
  utcDay,
  type AppData,
  type Feedback,
  type FeedbackKind,
  type ProductInput,
  type Profile,
} from "./types";
const env = import.meta.env as Record<string, string>;
export const supabase =
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
    : null;
export const isLive = !!supabase;
const KEY = "battlefield-v1";
type LocalStore = AppData & {
  day: string;
  identity?: Profile;
  reports?: { product_id: string; reason: string; created_at: string }[];
  baseVotes: Record<string, number>;
  baseStats: Record<
    string,
    { count: number; rating: number; comments: number }
  >;
  dailyVotes: Record<string, string[]>;
  dailyScores: Record<string, Record<string, number>>;
};
function local(): LocalStore {
  const raw = localStorage.getItem(KEY);
  let data: LocalStore;
  try {
    data = JSON.parse(raw || "null");
    if (!data?.products || !data.baseStats) throw new Error();
  } catch {
    const seed = seedData();
    data = {
      ...seed,
      day: utcDay(),
      baseVotes: Object.fromEntries(
        seed.products.map((p) => [p.id, p.votes_today]),
      ),
      baseStats: Object.fromEntries(
        seed.products.map((p) => [
          p.id,
          {
            count: p.reviews_count,
            rating: p.rating,
            comments: p.comments_count,
          },
        ]),
      ),
      dailyVotes: {},
      dailyScores: {},
    };
  }
  data.dailyScores ||= {};
  if (data.day !== utcDay()) {
    data.dailyVotes[data.day] = data.votes;
    data.dailyScores[data.day] = Object.fromEntries(
      data.products.map((p) => [
        p.id,
        (data.baseVotes[p.id] || 0) + (data.votes.includes(p.id) ? 1 : 0),
      ]),
    );
    data.day = utcDay();
    data.votes = [];
    data.baseVotes = {};
  }
  return data;
}
function commit(data: LocalStore) {
  localStorage.setItem(KEY, JSON.stringify(data));
}
function notice(data: LocalStore, text: string, product_id?: string) {
  data.notices.unshift({
    id: crypto.randomUUID(),
    text,
    product_id,
    created_at: new Date().toISOString(),
  });
}
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
async function profile(): Promise<Profile | null> {
  const { data, error } = await supabase!.auth.getSession();
  check(error);
  if (!data.session) return null;
  const response = await supabase!
    .from("profiles")
    .select("*")
    .eq("id", data.session.user.id)
    .single();
  check(response.error);
  return response.data;
}
export const repository = {
  async load(day = utcDay()): Promise<AppData> {
    if (!supabase) {
      const data = local();
      commit(data);
      const votes = day === data.day ? data.votes : data.dailyVotes[day] || [];
      return {
        ...data,
        votes,
        products: data.products
          .filter((p) => p.launch_date <= day)
          .map((p) => {
            const reviews = data.feedback.filter(
              (f) => f.product_id === p.id && f.kind === "review",
            );
            const stats = data.baseStats[p.id] || {
              count: 0,
              rating: 0,
              comments: 0,
            };
            return {
              ...p,
              votes_today:
                day === data.day
                  ? (data.baseVotes[p.id] || 0) + (votes.includes(p.id) ? 1 : 0)
                  : data.dailyScores[day]?.[p.id] || 0,
              claim_count:
                data.claims.filter((c) => c.product_id === p.id).length +
                (p.demo ? 20 + Number(p.id.slice(5)) * 3 - 3 : 0),
              reviews_count:
                stats.count +
                reviews.filter((f) => !f.id.startsWith("sample")).length,
              rating: stats.count
                ? (stats.rating * stats.count +
                    reviews
                      .filter((f) => !f.id.startsWith("sample"))
                      .reduce((s, f) => s + (f.rating || 0), 0)) /
                  (stats.count +
                    reviews.filter((f) => !f.id.startsWith("sample")).length)
                : reviews.length
                  ? reviews.reduce((s, f) => s + (f.rating || 0), 0) /
                    reviews.length
                  : 0,
              comments_count:
                stats.comments +
                data.feedback.filter(
                  (f) => f.product_id === p.id && !f.id.startsWith("sample"),
                ).length,
            };
          }),
      };
    }
    const me = await profile();
    const results = await Promise.all([
      supabase.rpc("list_products", { ranking_day: day }),
      supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false }),
      me
        ? supabase
            .from("votes")
            .select("product_id")
            .eq("user_id", me.id)
            .eq("vote_day", day)
        : Promise.resolve({ data: [], error: null }),
      me
        ? supabase.from("bookmarks").select("product_id").eq("user_id", me.id)
        : Promise.resolve({ data: [], error: null }),
      me
        ? supabase.from("claims").select("*").eq("user_id", me.id)
        : Promise.resolve({ data: [], error: null }),
    ]);
    results.forEach((r) => check(r.error));
    const products = results[0].data || [];
    const feedback = results[1].data || [];
    const claims = results[4].data || [];
    const notices = me
      ? [
          ...feedback
            .filter(
              (f: Feedback) =>
                f.user_id === me.id ||
                products.some(
                  (p: { id: string; maker_id: string }) =>
                    p.id === f.product_id && p.maker_id === me.id,
                ),
            )
            .map((f: Feedback) => ({
              id: f.id,
              text: `${f.user_id === me.id ? "You" : f.author_name} posted ${f.kind === "review" ? "a review" : f.kind === "bug" ? "a bug report" : "a comment"} on ${products.find((p: { id: string }) => p.id === f.product_id)?.name || "a product"}.`,
              product_id: f.product_id,
              created_at: f.created_at,
            })),
          ...claims.map(
            (c: { product_id: string; code: string; created_at: string }) => ({
              id: c.code,
              text: `You claimed a trial for ${products.find((p: { id: string }) => p.id === c.product_id)?.name || "a product"}.`,
              product_id: c.product_id,
              created_at: c.created_at,
            }),
          ),
        ]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 30)
      : [];
    return {
      products,
      feedback,
      votes: (results[2].data || []).map(
        (r: { product_id: string }) => r.product_id,
      ),
      saved: (results[3].data || []).map(
        (r: { product_id: string }) => r.product_id,
      ),
      claims: results[4].data || [],
      profile: me,
      notices,
    };
  },
  async login(name: string, email?: string) {
    if (supabase) {
      const { error } = await supabase.auth.signInWithOtp({
        email: email!,
        options: {
          emailRedirectTo: location.origin,
          data: { display_name: name.trim() || "New Explorer" },
        },
      });
      check(error);
      return;
    }
    const data = local();
    data.profile = {
      id: data.identity?.id || data.profile?.id || crypto.randomUUID(),
      name: name.trim(),
      handle:
        name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 24) || "maker",
    };
    data.identity = data.profile;
    notice(
      data,
      "Welcome to Battlefield. Your next favorite product is waiting.",
    );
    commit(data);
  },
  async logout() {
    if (supabase) {
      check((await supabase.auth.signOut()).error);
      return;
    }
    const data = local();
    data.profile = null;
    commit(data);
  },
  async vote(id: string, wanted: boolean) {
    if (supabase) {
      check(
        (await supabase.rpc("set_vote", { target_product: id, wanted })).error,
      );
      return;
    }
    const data = local();
    if (!data.profile) throw new Error("Join the community first.");
    data.votes = data.votes.filter((x) => x !== id);
    if (wanted) data.votes.push(id);
    commit(data);
  },
  async save(id: string, wanted: boolean) {
    if (supabase) {
      const me = await profile();
      if (!me) throw new Error("Sign in first.");
      check(
        (wanted
          ? await supabase
              .from("bookmarks")
              .insert({ user_id: me.id, product_id: id })
          : await supabase
              .from("bookmarks")
              .delete()
              .eq("user_id", me.id)
              .eq("product_id", id)
        ).error,
      );
      return;
    }
    const data = local();
    if (!data.profile) throw new Error("Join the community first.");
    data.saved = data.saved.filter((x) => x !== id);
    if (wanted) data.saved.push(id);
    commit(data);
  },
  async claim(id: string) {
    if (supabase) {
      const r = await supabase.rpc("claim_trial", { target_product: id });
      check(r.error);
      return r.data as string;
    }
    const data = local();
    if (!data.profile) throw new Error("Join the community first.");
    const old = data.claims.find((c) => c.product_id === id);
    if (old) return old.code;
    const p = data.products.find((p) => p.id === id)!;
    const claimed =
      data.claims.filter((c) => c.product_id === id).length +
      (p.demo ? 20 + Number(id.slice(5)) * 3 - 3 : 0);
    if (!p.trial_label || claimed >= p.trial_limit)
      throw new Error("All trial spots have been claimed.");
    const code = `BF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    data.claims.push({
      product_id: id,
      user_id: data.profile.id,
      code,
      created_at: new Date().toISOString(),
    });
    notice(data, `You claimed ${p.trial_label} for ${p.name}.`, id);
    commit(data);
    return code;
  },
  async create(input: ProductInput) {
    if (supabase) {
      const me = await profile();
      if (!me) throw new Error("Sign in first.");
      const r = await supabase
        .from("products")
        .insert({
          ...input,
          maker_id: me.id,
          logo: input.name.charAt(0).toLowerCase(),
          theme: "mint",
        })
        .select("id")
        .single();
      check(r.error);
      return r.data!.id as string;
    }
    const data = local();
    if (!data.profile) throw new Error("Join the community first.");
    const id = crypto.randomUUID();
    data.products.unshift({
      ...input,
      id,
      maker_id: data.profile.id,
      maker_name: data.profile.name,
      maker_handle: data.profile.handle,
      logo: input.name.charAt(0).toLowerCase(),
      theme: "mint",
      launch_date: utcDay(),
      created_at: new Date().toISOString(),
      votes_today: 0,
      rating: 0,
      reviews_count: 0,
      comments_count: 0,
      claim_count: 0,
    });
    notice(data, `${input.name} is live. Welcome to the battlefield.`, id);
    commit(data);
    return id;
  },
  async update(id: string, input: ProductInput) {
    if (supabase) {
      check(
        (
          await supabase
            .from("products")
            .update(input)
            .eq("id", id)
            .select("id")
            .single()
        ).error,
      );
      return;
    }
    const data = local();
    const p = data.products.find((p) => p.id === id);
    if (!p || p.maker_id !== data.profile?.id)
      throw new Error("Only the maker can edit this product.");
    if (
      input.trial_limit <
      data.claims.filter((c) => c.product_id === id).length +
        (p.demo ? 20 + Number(id.slice(5)) * 3 - 3 : 0)
    )
      throw new Error("Trial inventory cannot be less than existing claims.");
    Object.assign(p, input);
    notice(data, `${p.name} has been updated.`, id);
    commit(data);
  },
  async feedback(
    id: string,
    kind: FeedbackKind,
    body: string,
    rating: number | null,
    attachment?: { url: string; name: string },
    parent_id?: string,
  ) {
    if (supabase) {
      const me = await profile();
      if (!me) throw new Error("Sign in first.");
      check(
        (
          await supabase
            .from("feedback")
            .insert({
              product_id: id,
              user_id: me.id,
              author_name: me.name,
              kind,
              body,
              rating,
              attachment_url: attachment?.url || "",
              attachment_name: attachment?.name || "",
              parent_id: parent_id || null,
            })
        ).error,
      );
      return;
    }
    const data = local();
    if (!data.profile) throw new Error("Join the community first.");
    if (
      kind === "review" &&
      data.feedback.some(
        (f) =>
          f.product_id === id &&
          f.user_id === data.profile!.id &&
          f.kind === "review",
      )
    )
      throw new Error("You have already reviewed this product.");
    data.feedback.unshift({
      id: crypto.randomUUID(),
      product_id: id,
      user_id: data.profile.id,
      author_name: data.profile.name,
      kind,
      body,
      rating,
      status: "open",
      created_at: new Date().toISOString(),
      attachment_url: attachment?.url,
      attachment_name: attachment?.name,
      parent_id,
    });
    notice(
      data,
      kind === "bug"
        ? "Your bug report was shared with the maker."
        : kind === "review"
          ? "Your review is helping the next person discover this product."
          : "Your comment has been posted.",
      id,
    );
    commit(data);
  },
  async resolve(id: string) {
    if (supabase) {
      check((await supabase.rpc("resolve_bug", { target_feedback: id })).error);
      return;
    }
    const data = local();
    const f = data.feedback.find((f) => f.id === id)!;
    const p = data.products.find((p) => p.id === f.product_id)!;
    if (p.maker_id !== data.profile?.id)
      throw new Error("Only the maker can resolve this bug.");
    f.status = "resolved";
    commit(data);
  },
  async report(id: string, reason: string) {
    if (supabase) {
      const me = await profile();
      if (!me) throw new Error("Sign in first.");
      check(
        (
          await supabase
            .from("reports")
            .insert({ product_id: id, user_id: me.id, reason })
        ).error,
      );
      return;
    }
    const data = local();
    if (!data.profile) throw new Error("Join the community first.");
    (data.reports ||= []).push({
      product_id: id,
      reason,
      created_at: new Date().toISOString(),
    });
    notice(
      data,
      `Your report was saved for ${data.products.find((p) => p.id === id)?.name}. Demo reports are stored only in this browser.`,
      id,
    );
    commit(data);
  },
  async upload(file: File): Promise<{ url: string; name: string }> {
    if (file.size > 3 * 1024 * 1024)
      throw new Error("Choose a file smaller than 3 MB.");
    if (supabase) {
      const me = await profile();
      if (!me) throw new Error("Sign in to upload.");
      const path = `${me.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const r = await supabase.storage
        .from("product-assets")
        .upload(path, file);
      check(r.error);
      return {
        url: supabase.storage.from("product-assets").getPublicUrl(path).data
          .publicUrl,
        name: file.name,
      };
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({ url: reader.result as string, name: file.name });
      reader.onerror = () => reject(new Error("This file could not be read."));
      reader.readAsDataURL(file);
    });
  },
};
