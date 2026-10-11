# Battlefield: product and interaction research

Research reviewed 11 October 2026. Sources are primary documentation; recommendations below are design decisions, not claimed research results or validated growth forecasts.

## What to build

A product discovery community where every available product can compete each day, independent of launch date or category. The core loop is discovery → product overview → trial or external visit → useful feedback → return to the daily ranking. Makers get a permanent home, trial distribution, discussions, reproducible bug reports, and a simple activity dashboard.

**Product Hunt** establishes daily competition and permanent product pages. Its launch guide emphasizes readable product information, visuals, conversations, and post-launch improvements. Its ranking combines multiple signals and authenticity checks. Battlefield instead starts with an auditable one-vote-one-point model because an opaque algorithm would be hard to explain or validate at an early stage. This is a deliberate simplification, not a claim to match Product Hunt’s algorithm.

Sources: [Launch guide](https://help.producthunt.com/en/articles/17350772-launch-guide), [Homepage ranking](https://help.producthunt.com/en/articles/484938-how-is-the-homepage-ranked), [Daily awards](https://help.producthunt.com/en/articles/11751186-product-of-the-day-week-month).

**X** provides familiar navigation, a central stream, clickable detail views, conversations, and saving for later. Battlefield borrows these interaction patterns with original branding and product-specific content. It uses Trending, Newest, and Free to try rather than pretending to have personalized recommendations before behavioral data exists.

Sources: [Timeline behavior](https://help.x.com/en/using-x/x-timeline), [Bookmarks](https://help.x.com/en/using-x/bookmarks).

## Most intuitive starting experience

1. Visitors can browse and search without an account. Product information and community feedback are public.
2. One obvious product card contains the maker, name, one-line pitch, preview, category, trial offer, votes, and review summary.
3. Product detail separates Overview, Discussion, Reviews, and Bug reports. Bugs should not be lost among congratulatory comments.
4. Signing in is requested at the first action requiring identity, rather than blocking exploration.
5. Launching uses one compact form with optional screenshots, downloadable resources, and trial inventory. Makers can edit their own listing.
6. Saved products and a trial wallet make return visits useful beyond the leaderboard.
7. Desktop uses a three-column social layout. Tablet removes the secondary rail. Mobile uses a bottom navigation and a single readable feed.

## Ranking and fairness

All available products participate every UTC day. Each authenticated member can vote once per product per day and withdraw a vote before the day closes. The primary key `(product_id,user_id,vote_day)` and server functions enforce this rule. Yesterday’s vote rows remain; a new date automatically starts the next round. No scheduler is needed for daily voting. Equal scores sort by the earlier product creation time, then product ID. A displayed leading product is provisional until midnight UTC.

The policy differs from Product Hunt’s launch-day-only competition and matches the requested repeated daily competition. Existing products may accumulate a loyal voting audience. Category filtering and Newest provide discovery for smaller entrants; later experiments could compare a separate new-launch division. No unvalidated fairness claim is made.

Reviews, downloads, trial claims, and bug reports do not contribute ranking points. Free trials never require votes or favorable reviews. Star ratings are simple review averages, not evidence of verified usage. Claiming a trial is not represented as proof that the person used the product. A confirmed email limits trivial anonymous actions but does not solve coordinated voting or multiple accounts.

## Trials and product usage

A discovery platform cannot safely run arbitrary startups’ applications under one shared origin. The initial implementation links to maker websites and hosts public resources. Seeded fictional products have a small interactive concept preview. A claim reserves a unique code against inventory; the maker honors it on their website. Automatic credit issuance, external account linking, in-platform SaaS execution, and actual redemption tracking require a maker-specific API/SDK integration and are not claimed as implemented.

## Supabase architecture

React + TypeScript + Vite produces a portable static frontend. A single repository interface selects browser-local demo persistence or Supabase based on environment variables. Configured Supabase never silently falls back to fictional data.

Supabase supplies Postgres, email-link authentication, and Storage. Tables use explicit grants and row-level security. Votes and inventory use narrowly granted server functions. Trial claims lock the product row before checking stock. Private bookmarks, vote histories, claims, and reports are owner-scoped. Public ranking aggregates keep other users’ vote histories private. File uploads use user-prefixed storage paths and a 3 MB limit.

Sources: [Row-level security and grants](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database functions](https://supabase.com/docs/guides/database/functions), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Email passwordless authentication](https://supabase.com/docs/guides/auth/auth-email-passwordless).

## Rollout and learning

Start with a small invited cohort across a few categories and personally recruit makers who can respond to feedback. Measure listing→detail, detail→trial/visit, trial→feedback, return visits, time to first meaningful response, and distribution of votes across products. These metrics are recommendations; no analytics integration is included.

Before a wider public launch, run Supabase permission tests against the actual project, verify email delivery and redirect URLs, review storage retention and abuse handling, set operational rate limits/CAPTCHA, and assign moderation ownership. The initial moderation path is report intake plus administrative SQL; a staffed moderation console, notifications from other users, email digests, automatic redemption, and abuse-detection models are subsequent work. Daily results are calculated from immutable closed-day votes; historical product metadata and star ratings are current, not versioned snapshots.
