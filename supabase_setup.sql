-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Set up the table for storing saved reels
create table public.reels (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  source_url text not null,
  source_platform text not null default 'instagram',
  
  -- Extracted data
  title text,
  summary text,
  category text,
  sub_category text,
  key_points jsonb,
  entities jsonb,
  products jsonb,
  places jsonb,
  people jsonb,
  brands jsonb,
  ingredients jsonb,
  actions jsonb,
  use_case text,
  why_useful text,
  search_keywords jsonb,
  
  -- Raw data
  original_caption text,
  transcript text,
  thumbnail_url text,
  
  -- Vector embedding for semantic search
  embedding vector(768), -- Gemini uses 768 dimensions for text-embedding-004
  
  -- Metadata
  processing_status text default 'completed',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.reels enable row level security;

-- Policies
create policy "Users can insert their own reels."
  on public.reels for insert
  with check ( auth.uid() = user_id );

create policy "Users can read their own reels."
  on public.reels for select
  using ( auth.uid() = user_id );

create policy "Users can update their own reels."
  on public.reels for update
  using ( auth.uid() = user_id );

create policy "Users can delete their own reels."
  on public.reels for delete
  using ( auth.uid() = user_id );

-- Create a function to search reels via pgvector
create or replace function match_reels (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (
  id uuid,
  title text,
  summary text,
  category text,
  source_url text,
  created_at timestamp with time zone,
  similarity float
)
language sql stable
as $$
  select
    reels.id,
    reels.title,
    reels.summary,
    reels.category,
    reels.source_url,
    reels.created_at,
    1 - (reels.embedding <=> query_embedding) as similarity
  from reels
  where reels.user_id = p_user_id
    and 1 - (reels.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
