-- Battlefield initial schema. Apply to a new Supabase project with `supabase db push`.
begin;
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 2 and 60),
 handle text not null unique check (handle ~ '^[a-z0-9_-]{3,48}$'),
 created_at timestamptz not null default now()
);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles (id,name,handle) values (new.id,coalesce(nullif(left(btrim(new.raw_user_meta_data->>'display_name'),60),''),'New Explorer'),'explorer-'||replace(new.id::text,'-',''));
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create table public.products (
 id uuid primary key default gen_random_uuid(),
 maker_id uuid not null references public.profiles(id),
 name text not null check (char_length(btrim(name)) between 1 and 40),
 tagline text not null check (char_length(btrim(tagline)) between 1 and 100),
 description text not null check (char_length(btrim(description)) between 20 and 1200),
 category text not null check (category in ('AI & machine learning','Productivity','Design','Developer tools','Lifestyle','Finance')),
 tags text[] not null default '{}' check (cardinality(tags)<=3),
 website text not null check (website ~ '^https?://[^[:space:]]+$' and char_length(website)<=500),
 logo text not null default 'b' check (char_length(logo)<=2),
 theme text not null default 'mint' check (theme in ('mint','lavender','peach','pink','blue','sand')),
 trial_label text not null default '' check (char_length(trial_label)<=80),
 trial_limit integer not null default 100 check (trial_limit between 1 and 100000),
 screenshot_url text not null default '' check (screenshot_url='' or screenshot_url ~ '^https?://'),
 resource_url text not null default '' check (resource_url='' or resource_url ~ '^https?://'),
 resource_name text not null default '' check (char_length(resource_name)<=255),
 launch_date date not null default (now() at time zone 'UTC')::date,
 created_at timestamptz not null default now(),
 hidden boolean not null default false
);
create index products_launch_idx on public.products(launch_date,created_at) where not hidden;
create table public.votes (
 product_id uuid not null references public.products(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 vote_day date not null default (now() at time zone 'UTC')::date,
 created_at timestamptz not null default now(),
 primary key(product_id,user_id,vote_day)
);
create index votes_day_product_idx on public.votes(vote_day,product_id);
create table public.bookmarks (
 product_id uuid not null references public.products(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(product_id,user_id)
);
create table public.claims (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 code text not null unique,
 offer_label text not null,
 created_at timestamptz not null default now(),
 unique(product_id,user_id)
);
create table public.feedback (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 author_name text not null,
 kind text not null check(kind in ('comment','review','bug')),
 body text not null check (char_length(btrim(body)) between 5 and 2000),
 rating smallint check(rating between 1 and 5),
 status text not null default 'open' check(status in ('open','resolved')),
 attachment_url text not null default '' check(attachment_url='' or attachment_url ~ '^https?://'),
 attachment_name text not null default '' check(char_length(attachment_name)<=255),
 parent_id uuid references public.feedback(id) on delete cascade,
 created_at timestamptz not null default now(),
 check((kind='review' and rating is not null and char_length(btrim(body))>=20) or (kind<>'review' and rating is null)),
 check(kind='bug' or status='open'),
 check(parent_id is null or kind='comment')
);
create index feedback_product_idx on public.feedback(product_id,created_at desc);
create unique index one_review_per_member on public.feedback(product_id,user_id) where kind='review';
create table public.reports (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 reason text not null check(char_length(btrim(reason)) between 10 and 1000),
 created_at timestamptz not null default now()
);
-- Do not trust display names or timestamps submitted by the browser.
create function public.validate_feedback() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.author_name := (select name from public.profiles where id=new.user_id);
 new.created_at := now();
 if new.status<>'open' then raise exception 'New feedback must be open'; end if;
 if new.parent_id is not null and not exists (select 1 from public.feedback f where f.id=new.parent_id and f.product_id=new.product_id and f.kind='comment') then raise exception 'Reply must belong to the same product discussion'; end if;
 return new;
end; $$;
create trigger feedback_validation before insert on public.feedback for each row execute function public.validate_feedback();
create function public.validate_product() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then new.launch_date := (now() at time zone 'UTC')::date; new.created_at := now(); new.hidden := false; end if;
 if TG_OP='UPDATE' and new.trial_limit < (select count(*) from public.claims where product_id=new.id) then raise exception 'Trial inventory cannot be less than existing claims'; end if;
 return new;
end; $$;
create trigger product_validation before insert or update on public.products for each row execute function public.validate_product();
-- Tables exposed by the Data API always have RLS and explicit grants.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.votes enable row level security;
alter table public.bookmarks enable row level security;
alter table public.claims enable row level security;
alter table public.feedback enable row level security;
alter table public.reports enable row level security;
revoke all on public.profiles,public.products,public.votes,public.bookmarks,public.claims,public.feedback,public.reports from anon,authenticated;
grant select on public.profiles,public.products,public.feedback to anon,authenticated;
grant select on public.votes,public.bookmarks,public.claims,public.reports to authenticated;
grant insert on public.products,public.feedback,public.bookmarks,public.reports to authenticated;
grant delete on public.bookmarks to authenticated;
grant update(name) on public.profiles to authenticated;
grant update(name,tagline,description,category,tags,website,trial_label,trial_limit,screenshot_url,resource_url,resource_name) on public.products to authenticated;
create policy profiles_read on public.profiles for select using(true);
create policy profile_name on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy products_read on public.products for select using(not hidden and launch_date <= (now() at time zone 'UTC')::date);
create policy products_create on public.products for insert to authenticated with check(maker_id=(select auth.uid()) and not hidden and launch_date=(now() at time zone 'UTC')::date);
create policy products_edit on public.products for update to authenticated using(maker_id=(select auth.uid()) and not hidden) with check(maker_id=(select auth.uid()) and not hidden);
create policy votes_read on public.votes for select to authenticated using(user_id=(select auth.uid()));
create policy bookmarks_read on public.bookmarks for select to authenticated using(user_id=(select auth.uid()));
create policy bookmarks_create on public.bookmarks for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.products where id=product_id and not hidden));
create policy bookmarks_remove on public.bookmarks for delete to authenticated using(user_id=(select auth.uid()));
create policy claims_read on public.claims for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.products where id=product_id and maker_id=(select auth.uid())));
create policy feedback_read on public.feedback for select using(exists(select 1 from public.products where id=product_id and not hidden));
create policy feedback_create on public.feedback for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.products where id=product_id and not hidden));
create policy reports_read on public.reports for select to authenticated using(user_id=(select auth.uid()));
create policy reports_create on public.reports for insert to authenticated with check(user_id=(select auth.uid()));
-- Only these server functions may mutate votes and trial claims.
create function public.set_vote(target_product uuid,wanted boolean) returns void language plpgsql security definer set search_path='' as $$
declare current_user_id uuid := auth.uid(); current_day date := (now() at time zone 'UTC')::date;
begin
 if current_user_id is null then raise exception 'Sign in to vote'; end if;
 if not exists(select 1 from public.products where id=target_product and not hidden and launch_date<=current_day) then raise exception 'Product is unavailable'; end if;
 if wanted then insert into public.votes(product_id,user_id,vote_day) values(target_product,current_user_id,current_day) on conflict do nothing;
 else delete from public.votes where product_id=target_product and user_id=current_user_id and vote_day=current_day;
 end if;
end; $$;
create function public.claim_trial(target_product uuid) returns text language plpgsql security definer set search_path='' as $$
declare current_user_id uuid := auth.uid(); product public.products; existing_code text; new_code text;
begin
 if current_user_id is null then raise exception 'Sign in to claim a trial'; end if;
 -- Serialize inventory checks for this product, including duplicate concurrent claims.
 select * into product from public.products where id=target_product for update;
 if product.id is null or product.hidden or product.launch_date>(now() at time zone 'UTC')::date then raise exception 'Product is unavailable'; end if;
 select code into existing_code from public.claims where product_id=target_product and user_id=current_user_id;
 if existing_code is not null then return existing_code; end if;
 if product.trial_label='' then raise exception 'This product has no trial offer'; end if;
 if (select count(*) from public.claims where product_id=target_product)>=product.trial_limit then raise exception 'All trial spots have been claimed'; end if;
 new_code := 'BF-'||upper(replace(gen_random_uuid()::text,'-',''));
 insert into public.claims(product_id,user_id,code,offer_label) values(target_product,current_user_id,new_code,product.trial_label);
 return new_code;
end; $$;
create function public.resolve_bug(target_feedback uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if not exists(select 1 from public.feedback f join public.products p on p.id=f.product_id where f.id=target_feedback and f.kind='bug' and p.maker_id=auth.uid() and not p.hidden) then raise exception 'Only the maker can resolve this bug'; end if;
 update public.feedback set status='resolved' where id=target_feedback;
end; $$;
-- Aggregate votes in the database; never expose other members' voting histories.
create function public.list_products(ranking_day date default (now() at time zone 'UTC')::date) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(item order by (item->>'votes_today')::integer desc,item->>'created_at',item->>'id'),'[]'::jsonb) from (
 select (to_jsonb(p)-'hidden')||jsonb_build_object(
 'maker_name',pr.name,'maker_handle',pr.handle,
 'votes_today',(select count(*) from public.votes v where v.product_id=p.id and v.vote_day=ranking_day),
 'claim_count',(select count(*) from public.claims c where c.product_id=p.id),
 'reviews_count',(select count(*) from public.feedback f where f.product_id=p.id and f.kind='review'),
 'comments_count',(select count(*) from public.feedback f where f.product_id=p.id),
 'rating',coalesce((select avg(f.rating) from public.feedback f where f.product_id=p.id and f.kind='review'),0)) as item
 from public.products p join public.profiles pr on pr.id=p.maker_id
 where not p.hidden and p.launch_date<=ranking_day and ranking_day<=(now() at time zone 'UTC')::date
 ) as items;
$$;
revoke all on function public.handle_new_user(),public.validate_feedback(),public.validate_product(),public.set_vote(uuid,boolean),public.claim_trial(uuid),public.resolve_bug(uuid),public.list_products(date) from public,anon,authenticated;
grant execute on function public.set_vote(uuid,boolean),public.claim_trial(uuid),public.resolve_bug(uuid) to authenticated;
grant execute on function public.list_products(date) to anon,authenticated;
-- Public assets contain intentionally public screenshots and downloadable resources.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-assets','product-assets',true,3145728,array['image/png','image/jpeg','image/webp','application/pdf','text/plain','text/csv','application/zip','application/x-zip-compressed','application/json']) on conflict(id) do nothing;
create policy asset_uploads on storage.objects for insert to authenticated with check(bucket_id='product-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy asset_delete on storage.objects for delete to authenticated using(bucket_id='product-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
