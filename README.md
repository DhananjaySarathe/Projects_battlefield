# Battlefield

A complete product-discovery frontend with a persistent local demo and a Supabase integration. Built with React, TypeScript, Vite, and original CSS. The UI draws on familiar social-feed patterns: left navigation, central product feed, right daily ranking, and mobile bottom navigation.

## Run locally

```sh
npm install
npm run dev
```

Open the printed local URL, normally `http://localhost:5173`. Without Supabase environment variables, fictional sample products load automatically. Join with a display name to try the local flows. Activity is stored in this browser; this demo is a single local identity, not secure multi-user authentication. Uploads are limited to 3 MB, and local browser storage has a finite quota. Use Supabase Storage for real uploads.

```sh
npm test
npm run build
npm run preview
```

## Included flows

- Product discovery, search, categories, newest/trending/trial filters.
- Daily rankings for all available products, UTC countdown, archived daily votes.
- One vote per user/product/day with withdrawal and deterministic ties.
- Launch and edit your own listing, screenshot upload, downloadable resources.
- Trial inventory, one unique claim per member/product, and a personal trial wallet.
- Discussion threads and replies, one rated review per member, bug reports with attachments.
- Maker dashboard with votes, claims, and open bugs; maker-only bug resolution.
- Saved products, sharing, report intake, recent activity, and account controls.
- Responsive layouts, keyboard-accessible dialogs, focus management, reduced-motion support.

The demo’s existing votes and reviews are illustrative. Fictional product playgrounds are interactive concept previews. Real products open their maker websites. Trial codes reserve an offer; actual redemption and external credit issuance require the maker to honor or integrate those codes. Reviews are not labeled as verified usage.

## Connect Supabase

1. Create a new Supabase project.
2. Apply [the migration](supabase/migrations/202610110001_battlefield.sql) using the SQL editor, or configure the Supabase CLI and run `supabase db push`.
3. Enable email OTP/magic-link sign-in. Configure the Site URL and allowed redirect URLs for your local and deployed app origins.
4. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (a public/publishable key). Never put a service-role or secret key in a Vite variable.
5. Restart the dev server or rebuild and redeploy. The adapter switches to Supabase; fictional local data is not imported. A new project starts empty.
6. Sign in, launch a real product, and exercise the flows with two real users. Run the project’s Supabase security advisers and verify email delivery, Storage MIME rules, redirect behavior, and permissions in your actual project before opening registration broadly.

All operations are connected through `src/lib/repository.ts`; no UI rewrite is needed. The migration includes profiles, products, votes, bookmarks, claims, feedback, reports, authentication profile creation, RLS policies, explicit grants, Storage policies, daily ranking aggregation, and atomic claim/vote functions. The first uploaded screenshot and resource are public assets. Do not upload confidential files.

Trials are enforced with a product row lock, a stock check, and a unique user/product constraint. The frontend can never directly insert votes or claims. Closed-day votes cannot be removed by clients. The SQL integration tests execute the actual migration in embedded Postgres (PGlite) with Supabase auth/storage stubs; they do not replace checks against the deployed Supabase service.

The live app derives recent activity from feedback and trial claims. It refreshes rankings periodically while open. Email notifications and push subscriptions are not included.

## Moderation and operation

Report intake is implemented. Reports are private to their author and database administrators. Staff can review the `reports` table in the Supabase dashboard and hide a product with administrative SQL:

```sql
update public.products set hidden = true where id = '<product UUID>';
```

Hiding removes the product and its feedback from public reads. There is no moderation console or automated anti-abuse scoring. Rate limiting, CAPTCHA, storage retention, and moderation staffing are launch operations to configure for a public deployment. A confirmed email is not proof of one real-world person.

The UTC leaderboard date changes automatically; no scheduled reset is required. Archived vote rows determine historical ranks. Archived listing text, star averages, and trial totals reflect current metadata rather than historical snapshots. Deleting an account cascades that person’s feedback and votes; preserving audit records for account erasure needs an explicit retention policy. Products retain their maker foreign key; makers with live products need an administrative transfer/removal workflow before account deletion.

## Project map

- `src/App.tsx`: routes, feed, launch/edit forms, product detail, trial wallet, and feedback flows.
- `src/components/UI.tsx`: dialogs, branding, avatars, and illustrative product previews.
- `src/lib/repository.ts`: local/Supabase data adapter.
- `src/lib/types.ts`: data model, safe links, ranking helpers.
- `src/styles.css`: design system and responsive layouts.
- `supabase/migrations/`: complete initial database and storage setup.
- `tests/`: local persistence and Postgres business-rule/permission tests.
- [Research and product decisions](docs/RESEARCH.md).

Static build output is `dist/` and can be hosted on any HTTPS static host. Vite variables are injected at build time. Any added backend keys require a new build; they are not runtime configuration. The local demo and Supabase data are separate stores.
