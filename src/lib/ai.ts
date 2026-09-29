import { GoogleGenAI, Type, Schema } from '@google/genai';
import fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy_api_key' });

const reelSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A concise and catchy title for the content" },
    summary: { type: Type.STRING, description: "A short, useful summary of the content (2-3 sentences)" },
    category: { type: Type.STRING, description: "Main category (e.g., Technology, Food, Travel, Fitness, Learning, Entertainment, Finance, Fashion, etc.)" },
    sub_category: { type: Type.STRING, description: "More specific category" },
    key_points: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of important takeaways" },
    entities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key entities mentioned" },
    products: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific products mentioned with details" },
    places: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Locations or places" },
    people: { type: Type.ARRAY, items: { type: Type.STRING }, description: "People mentioned" },
    brands: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Brands mentioned" },
    ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Ingredients (if food/recipe)" },
    actions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Actionable steps or instructions" },
    use_case: { type: Type.STRING, description: "Why would someone save this? What's the use case?" },
    why_useful: { type: Type.STRING, description: "Why is this information useful?" },
    search_keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Keywords for searchability (15-20 diverse keywords)" },
  },
  required: ["title", "summary", "category"],
};

const systemPrompt = `You are analyzing content saved by a user from an Instagram Reel.
Your goal is to extract ALL useful information so the user can find this content later using natural language search.
Extract only information supported by the provided content.
Do NOT invent product names, prices, specifications, locations, people, or claims.
Be thorough — extract every detail mentioned (names, numbers, prices, specs, locations, steps, etc).
Generate 15-20 diverse search keywords covering synonyms and related terms.
Be concise in summaries but comprehensive in extracted details.
If a field is not applicable or not found, leave it empty.`;

// ── Analyze a video file using Gemini multimodal ──
export async function analyzeVideo(videoPath: string, caption?: string | null) {
  console.log('[AI] Uploading video for multimodal analysis...');

  // Upload the video file to Gemini
  const uploadResult = await ai.files.upload({
    file: videoPath,
    config: { mimeType: 'video/mp4' },
  });

  if (!uploadResult.name) throw new Error('Video upload failed');

  // Wait for the video to finish processing
  let file = await ai.files.get({ name: uploadResult.name });
  let attempts = 0;
  while (file.state === 'PROCESSING' && attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000));
    file = await ai.files.get({ name: uploadResult.name! });
    attempts++;
    console.log(`[AI] Video processing... (attempt ${attempts})`);
  }

  if (file.state !== 'ACTIVE') {
    throw new Error(`Video processing failed with state: ${file.state}`);
  }

  console.log('[AI] Video processed. Running multimodal analysis...');

  const userPrompt = `Analyze this Instagram Reel video thoroughly.
Listen to everything said in the audio/speech.
Look at everything shown visually.
${caption ? `The caption posted with this Reel is: "${caption}"` : ''}

Extract all useful information: what is being discussed, any products/places/people mentioned, instructions given, recommendations made, prices quoted, etc.
Return structured JSON.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { fileUri: file.uri!, mimeType: 'video/mp4' } },
          { text: userPrompt },
        ],
      },
    ],
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: reelSchema,
      temperature: 0.2,
    },
  });

  // Clean up the uploaded file from Google servers
  try {
    await ai.files.delete({ name: uploadResult.name! });
  } catch (_) {
    // ignore cleanup errors
  }

  if (!response.text) throw new Error('Failed to generate content from video');
  return JSON.parse(response.text);
}

// ── Analyze text content only (caption / manual input) ──
export async function analyzeContent(content: string) {
  const prompt = `${systemPrompt}

Content to analyze:
${content}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: reelSchema,
      temperature: 0.2,
    },
  });

  if (!response.text) throw new Error('Failed to generate content');
  return JSON.parse(response.text);
}

// ── Generate embedding for semantic search ──
export async function generateEmbedding(text: string) {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: text,
    config: {
      outputDimensionality: 768,
    },
  });

  return response.embeddings?.[0]?.values;
}

// ── Answer a search question using saved context ──
export async function answerQuestion(query: string, context: any[]) {
  const contextText = context
    .map(
      (item) => `
Title: ${item.title}
Category: ${item.category}
Summary: ${item.summary}
URL: ${item.source_url}
Date Saved: ${new Date(item.created_at).toLocaleDateString()}`
    )
    .join('\n---\n');

  const prompt = `You are a helpful AI assistant for "Recall", answering a question using ONLY the following saved content belonging to this user.
Do not use outside knowledge.
If the answer is not present in the provided context, say you could not find it in their saved items.
Mention the relevant saved item, provide a concise answer, and always include its original source URL.

User's Question: ${query}

Saved Content Context:
${contextText}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      temperature: 0.3,
    },
  });

  return response.text;
}
