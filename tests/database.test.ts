import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const maker = "11111111-1111-4111-8111-111111111111",
  visitor = "22222222-2222-4222-8222-222222222222",
  third = "33333333-3333-4333-8333-333333333333";
let product: string;
async function asUser(id: string, sql: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
  );
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role;");
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create schema auth; create schema storage; create role anon; create role authenticated; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public,storage to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; grant insert,delete,select on storage.objects to authenticated; create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;`,
  );
  const schema = readFileSync(
    "supabase/migrations/202610110001_battlefield.sql",
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(schema);
  await db.exec(
    `insert into auth.users values('${maker}','{"display_name":"Maker One"}'),('${visitor}','{"display_name":"Visitor Two"}'),('${third}','{"display_name":"Third Member"}');`,
  );
  const response = await asUser(
    maker,
    `insert into public.products(maker_id,name,tagline,description,category,website,trial_label,trial_limit) values('${maker}','Test Product','A useful little product','An actual description with enough detail for visitors.','Productivity','https://example.com','10 free credits',1) returning id;`,
  );
  product = (response.rows[0] as { id: string }).id;
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("Postgres permissions and business rules", () => {
  it("creates a profile without exposing email", async () => {
    const r = await db.query(
      `select name,handle from public.profiles where id='${maker}'`,
    );
    expect(r.rows[0]).toEqual({
      name: "Maker One",
      handle: expect.stringMatching(/^explorer-/),
    });
  });
  it("counts an idempotent daily vote and permits withdrawal", async () => {
    await asUser(visitor, `select public.set_vote('${product}',true)`);
    await asUser(visitor, `select public.set_vote('${product}',true)`);
    const r = await db.query(
      `select count(*)::int as n from public.votes where product_id='${product}'`,
    );
    expect(r.rows[0]).toEqual({ n: 1 });
    await asUser(visitor, `select public.set_vote('${product}',false)`);
    expect(
      (await db.query("select count(*)::int as n from public.votes")).rows[0],
    ).toEqual({ n: 0 });
  });
  it("prevents direct inserts and deleting closed-day votes", async () => {
    await expect(
      asUser(
        visitor,
        `insert into public.votes values('${product}','${visitor}','2020-01-01',now())`,
      ),
    ).rejects.toThrow(/permission denied/);
    await db.exec(
      `insert into public.votes(product_id,user_id,vote_day) values('${product}','${visitor}','2020-01-01')`,
    );
    await expect(
      asUser(visitor, `delete from public.votes where vote_day='2020-01-01'`),
    ).rejects.toThrow(/permission denied/);
  });
  it("keeps vote histories and bookmarks private", async () => {
    await asUser(maker, `select public.set_vote('${product}',true)`);
    expect(
      (await asUser(visitor, "select * from public.votes")).rows.every(
        (row: any) => row.user_id === visitor,
      ),
    ).toBe(true);
    await asUser(
      maker,
      `insert into public.bookmarks(product_id,user_id) values('${product}','${maker}')`,
    );
    expect(
      (await asUser(visitor, "select * from public.bookmarks")).rows,
    ).toHaveLength(0);
    await expect(
      asUser(
        visitor,
        `insert into public.bookmarks(product_id,user_id) values('${product}','${maker}')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("reserves a trial once and enforces inventory", async () => {
    const first = await asUser(
      visitor,
      `select public.claim_trial('${product}') as code`,
    );
    const again = await asUser(
      visitor,
      `select public.claim_trial('${product}') as code`,
    );
    expect(first.rows[0]).toEqual(again.rows[0]);
    await expect(
      asUser(third, `select public.claim_trial('${product}')`),
    ).rejects.toThrow(/All trial spots/);
    expect(
      (await asUser(third, "select * from public.claims")).rows,
    ).toHaveLength(0);
  });
  it("allows only one review and replaces forged author names", async () => {
    const review = `insert into public.feedback(product_id,user_id,author_name,kind,body,rating) values('${product}','${visitor}','Forged Name','review','I tried this product and found it useful.',4)`;
    await asUser(visitor, review);
    await expect(asUser(visitor, review)).rejects.toThrow(
      /one_review_per_member/,
    );
    expect(
      (
        await db.query(
          `select author_name from public.feedback where kind='review'`,
        )
      ).rows[0],
    ).toEqual({ author_name: "Visitor Two" });
  });
  it("allows only the maker to resolve a reported bug", async () => {
    const r = await asUser(
      visitor,
      `insert into public.feedback(product_id,user_id,author_name,kind,body) values('${product}','${visitor}','Visitor','bug','Open settings and click save: a blank screen appears.') returning id`,
    );
    const id = (r.rows[0] as { id: string }).id;
    await expect(
      asUser(visitor, `select public.resolve_bug('${id}')`),
    ).rejects.toThrow(/Only the maker/);
    await asUser(maker, `select public.resolve_bug('${id}')`);
    expect(
      (await db.query(`select status from public.feedback where id='${id}'`))
        .rows[0],
    ).toEqual({ status: "resolved" });
  });
  it("prevents changing ownership and permits maker listing edits", async () => {
    await expect(
      asUser(
        maker,
        `update public.products set maker_id='${visitor}' where id='${product}'`,
      ),
    ).rejects.toThrow(/permission denied/);
    await asUser(
      visitor,
      `update public.products set name='Hijacked' where id='${product}'`,
    );
    expect(
      (await db.query(`select name from public.products where id='${product}'`))
        .rows[0],
    ).toEqual({ name: "Test Product" });
    await asUser(
      maker,
      `update public.products set name='Updated Product' where id='${product}'`,
    );
  });
  it("aggregates public ranks without exposing vote identities", async () => {
    await db.exec("set role anon");
    try {
      const r = await db.query("select public.list_products() as products");
      const p = (r.rows[0] as any).products[0];
      expect(p.votes_today).toBe(1);
      expect(p.rating).toBe(4);
      expect(p.claim_count).toBe(1);
      expect(p).not.toHaveProperty("hidden");
    } finally {
      await db.exec("reset role");
    }
  });
  it("restricts uploads to the member’s own path", async () => {
    await asUser(
      visitor,
      `insert into storage.objects(bucket_id,name) values('product-assets','${visitor}/example.txt')`,
    );
    await expect(
      asUser(
        visitor,
        `insert into storage.objects(bucket_id,name) values('product-assets','${maker}/example.txt')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("rejects unauthenticated write functions", async () => {
    await db.exec(
      "select set_config('request.jwt.claim.sub','',false); set role anon",
    );
    try {
      await expect(
        db.query(`select public.claim_trial('${product}')`),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});
