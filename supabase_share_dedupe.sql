-- Run after supabase_setup.sql.
-- 1) Normalize Instagram URLs
-- 2) Delete duplicate rows for the same user + URL
-- 3) Add a unique index so the same Reel cannot be saved twice

update public.reels
set source_url = trim(source_url)
where source_url is distinct from trim(source_url);

update public.reels
set source_url = 'https://www.instagram.com/reel/' ||
  (regexp_match(
    trim(source_url),
    'instagram\.com/(?:share/)?(?:reel|reels|p|tv)/([A-Za-z0-9_-]+)',
    'i'
  ))[1] || '/'
where regexp_match(
  trim(source_url),
  'instagram\.com/(?:share/)?(?:reel|reels|p|tv)/([A-Za-z0-9_-]+)',
  'i'
) is not null;

delete from public.reels
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by user_id, source_url
        order by
          case when processing_status = 'completed' then 0 else 1 end,
          created_at asc,
          id asc
      ) as rn
    from public.reels
  ) ranked
  where rn > 1
);

create unique index if not exists reels_user_source_url_idx
  on public.reels (user_id, source_url);
