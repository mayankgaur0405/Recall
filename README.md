# Recall - Your Memory for the Internet

An AI-powered web application that turns your saved Instagram Reels into a searchable personal knowledge library. 

## Features
- Save Instagram Reels (or manually add transcript/description)
- AI automatically extracts titles, summaries, key points, products, and more
- Semantic search (ask natural language questions to find your saved content)
- Mobile-first, responsive minimal design
- Powered by Next.js, Supabase, pgvector, and Gemini AI

## Setup Instructions

### 1. Supabase Setup
1. Create a new project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Copy the contents of `supabase_setup.sql` (found in the root of this project) and run it. This will create the `reels` table, enable the `vector` extension, and set up the `match_reels` function and Row Level Security.
4. Go to **Authentication -> Providers** and ensure Email provider is enabled.

### 2. Environment Variables
1. Copy `.env.example` to a new file called `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in the variables in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon public key
   - `GEMINI_API_KEY`: Your Google Gemini API Key (Get it from Google AI Studio)

### 3. Install & Run
```bash
# Install dependencies if you haven't already
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## Using the MVP
1. Sign up for an account.
2. Paste an Instagram Reel URL on the Home screen.
3. *Note: Since serverless scraping of Instagram often hits login walls, the app will gracefully fallback and prompt you to manually paste a description or transcript if it gets blocked.*
4. Ask a question in the search bar like "What was the laptop I saved?"

## Architecture
- **Frontend**: Next.js 15 (App Router), React, Tailwind CSS, Framer Motion, Lucide Icons
- **Backend**: Next.js Server API Routes
- **Database**: Supabase PostgreSQL with `pgvector` for semantic search
- **Auth**: Supabase Auth (Server-side rendered compatible)
- **AI**: `@google/genai` (Gemini 2.5 Pro for generation, text-embedding-004 for embeddings)
