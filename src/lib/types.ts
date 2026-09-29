export interface ReelData {
  title: string | null;
  summary: string | null;
  category: string | null;
  sub_category: string | null;
  key_points: string[] | null;
  entities: string[] | null;
  products: string[] | null;
  places: string[] | null;
  people: string[] | null;
  brands: string[] | null;
  ingredients: string[] | null;
  actions: string[] | null;
  price_mentions: string[] | null;
  use_case: string | null;
  why_useful: string | null;
  search_keywords: string[] | null;
}

export interface SavedReel extends ReelData {
  id: string;
  user_id: string;
  source_url: string;
  source_platform: string;
  original_caption: string | null;
  transcript: string | null;
  thumbnail_url: string | null;
  processing_status: string;
  created_at: string;
  updated_at: string;
}
