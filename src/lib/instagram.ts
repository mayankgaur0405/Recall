import fs from 'fs';
import path from 'path';
import os from 'os';

export interface InstagramContent {
  caption: string | null;
  videoUrl: string | null;
  videoPath: string | null;
  thumbnailUrl: string | null;
  author: string | null;
}

/**
 * Known RapidAPI provider integration types.
 * Each provider has a different endpoint path, HTTP method, and response schema.
 */
type ProviderType = 'reel-summarizer' | 'instagram-video-reel-downloader' | 'instagram-reels-downloader' | 'instagram-scraper-api2' | 'generic';

function detectProvider(apiHost: string): ProviderType {
  if (apiHost.includes('reel-summarizer')) return 'reel-summarizer';
  if (apiHost.includes('instagram-video-reel-downloader')) return 'instagram-video-reel-downloader';
  if (apiHost.includes('reels-downloader')) return 'instagram-reels-downloader';
  if (apiHost.includes('instagram-scraper-api2')) return 'instagram-scraper-api2';
  return 'generic';
}

/**
 * Build the fetch request config for the detected provider.
 */
function buildProviderRequest(
  provider: ProviderType,
  apiHost: string,
  apiKey: string,
  url: string
): { endpoint: string; init: RequestInit } {
  const headers: Record<string, string> = {
    'X-RapidAPI-Key': apiKey,
    'X-RapidAPI-Host': apiHost,
  };

  switch (provider) {
    case 'reel-summarizer':
      // POST-based summarizer API: POST /summarize { url: "..." }
      return {
        endpoint: `https://${apiHost}/summarize`,
        init: {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        },
      };

    case 'instagram-reels-downloader':
      // GET-based downloader: GET /download?url=...
      return {
        endpoint: `https://${apiHost}/download?url=${encodeURIComponent(url)}`,
        init: { method: 'GET', headers },
      };

    case 'instagram-video-reel-downloader':
      // GET-based downloader: GET /instagram/video?url=...
      return {
        endpoint: `https://${apiHost}/instagram/video?url=${encodeURIComponent(url)}`,
        init: { method: 'GET', headers },
      };

    case 'instagram-scraper-api2':
    default:
      // GET-based scraper: GET /v1/post_info?code_or_id_or_url=...
      return {
        endpoint: `https://${apiHost}/v1/post_info?code_or_id_or_url=${encodeURIComponent(url)}`,
        init: { method: 'GET', headers },
      };
  }
}

/**
 * Parse the response body based on provider type.
 * Each provider returns a different JSON structure.
 */
function parseProviderResponse(
  provider: ProviderType,
  data: Record<string, unknown>,
  result: InstagramContent
): void {
  switch (provider) {
    case 'reel-summarizer':
      parseReelSummarizer(data, result);
      break;
    case 'instagram-reels-downloader':
    case 'instagram-video-reel-downloader':
      parseDownloader(data, result);
      break;
    case 'instagram-scraper-api2':
      parseScraperApi2(data, result);
      break;
    default:
      // Generic: try all known shapes
      if (!parseReelSummarizer(data, result)) {
        if (!parseDownloader(data, result)) {
          parseScraperApi2(data, result);
        }
      }
      break;
  }
}

/**
 * Parse reel-summarizer response.
 * Expected shapes: { videoUrl, caption, thumbnailUrl, ... }
 * or { data: { video_url, caption, thumbnail, ... } }
 * or { summary, title, ... } (AI-summarized response)
 */
function parseReelSummarizer(data: Record<string, unknown>, result: InstagramContent): boolean {
  // Shape 1: direct top-level media fields
  if (data.videoUrl || data.video_url || data.caption || data.thumbnail) {
    result.videoUrl = (data.videoUrl || data.video_url || null) as string | null;
    result.caption = (data.caption || null) as string | null;
    result.thumbnailUrl = (data.thumbnailUrl || data.thumbnail || data.thumbnail_url || null) as string | null;
    result.author = (data.author || data.authorUsername || data.username || null) as string | null;
    return true;
  }

  // Shape 2: nested under data
  const nested = data.data as Record<string, unknown> | undefined;
  if (nested) {
    result.videoUrl = (nested.videoUrl || nested.video_url || null) as string | null;
    result.caption = (nested.caption || null) as string | null;
    result.thumbnailUrl = (nested.thumbnailUrl || nested.thumbnail || nested.thumbnail_url || null) as string | null;
    result.author = (nested.author || nested.username || null) as string | null;
    return true;
  }

  // Shape 3: summarized response with title/summary but no media
  if (data.title || data.summary) {
    result.caption = [data.title, data.summary, data.description]
      .filter(Boolean)
      .join(' — ') || null;
    result.thumbnailUrl = (data.thumbnailUrl || data.thumbnail || data.image || null) as string | null;
    return !!result.caption;
  }

  return false;
}

function parseDownloader(data: Record<string, unknown>, result: InstagramContent): boolean {
  // Support nested data/result envelopes
  const payload = (
    data.data && typeof data.data === 'object' && !Array.isArray(data.data)
      ? data.data
      : data.result && typeof data.result === 'object' && !Array.isArray(data.result)
      ? data.result
      : data
  ) as Record<string, unknown>;

  const downloads = (payload.medias || payload.downloads || payload.media || payload.videos) as Array<Record<string, unknown>> | undefined;
  const firstDownload = downloads?.[0];

  // Helper to ensure we don't treat Instagram HTML web URLs as direct media URLs
  const isDirectMedia = (url: unknown): url is string => {
    if (typeof url !== 'string' || !url) return false;
    if (url.includes('instagram.com/reel/') || url.includes('instagram.com/p/')) return false;
    return true;
  };

  const candidateVideoUrl =
    firstDownload?.url ||
    firstDownload?.videoUrl ||
    firstDownload?.video_url ||
    firstDownload?.download_url ||
    firstDownload?.link ||
    payload.videoUrl ||
    payload.video_url ||
    payload.download_url ||
    payload.downloadUrl ||
    payload.video ||
    (isDirectMedia(payload.url) ? payload.url : null);

  result.videoUrl = (candidateVideoUrl || null) as string | null;

  result.caption = (
    payload.caption ||
    payload.title ||
    payload.description ||
    null
  ) as string | null;

  result.thumbnailUrl = (
    firstDownload?.thumbnail ||
    firstDownload?.thumbnail_url ||
    firstDownload?.thumb ||
    firstDownload?.thu ||
    payload.thumbnail ||
    payload.thumbnailUrl ||
    payload.thumbnail_url ||
    payload.thumb ||
    payload.thu ||
    null
  ) as string | null;

  const owner = (payload.owner || payload.user) as Record<string, unknown> | undefined;
  result.author = (
    payload.authorUsername ||
    payload.author ||
    owner?.username ||
    null
  ) as string | null;

  return !!(result.videoUrl || result.caption);
}

function parseScraperApi2(data: Record<string, unknown>, result: InstagramContent): boolean {
  const item = data.data as Record<string, unknown> | undefined;
  if (!item) return false;

  // Extract Video URL
  if (item.video_url) {
    result.videoUrl = item.video_url as string;
  } else {
    const items = item.items as Array<Record<string, unknown>> | undefined;
    const videoVersions = items?.[0]?.video_versions as Array<Record<string, unknown>> | undefined;
    if (videoVersions?.[0]?.url) {
      result.videoUrl = videoVersions[0].url as string;
    }
  }

  // Extract Caption
  const captionObj = item.caption as Record<string, unknown> | undefined;
  if (captionObj?.text) {
    result.caption = captionObj.text as string;
  } else {
    const items = item.items as Array<Record<string, unknown>> | undefined;
    const itemCaption = items?.[0]?.caption as Record<string, unknown> | undefined;
    if (itemCaption?.text) {
      result.caption = itemCaption.text as string;
    }
  }

  // Extract Thumbnail
  if (item.thumbnail_url) {
    result.thumbnailUrl = item.thumbnail_url as string;
  }

  // Extract Author
  const user = item.user as Record<string, unknown> | undefined;
  if (user?.username) {
    result.author = user.username as string;
  }

  return true;
}

/**
 * Extracts Instagram Reel media (Video URL, Caption, Thumbnail) using a third-party API provider.
 * Supports multiple RapidAPI providers with auto-detection.
 *
 * If the API fails entirely, throws an error so the caller can decide whether to
 * fall back to URL-only analysis.
 */
export async function extractInstagramContent(url: string): Promise<InstagramContent> {
  const result: InstagramContent = {
    caption: null,
    videoUrl: null,
    videoPath: null,
    thumbnailUrl: null,
    author: null,
  };

  const apiKey = process.env.RAPIDAPI_KEY;
  const apiHost = process.env.RAPIDAPI_HOST || 'instagram-scraper-api2.p.rapidapi.com';

  if (!apiKey) {
    throw new Error(
      'RAPIDAPI_KEY is not configured. Set it in .env.local to enable Instagram content extraction.'
    );
  }

  const provider = detectProvider(apiHost);
  console.log(`[Instagram Service] Fetching media using provider "${provider}" (host: ${apiHost})`);

  try {
    let { endpoint, init } = buildProviderRequest(provider, apiHost, apiKey, url);
    console.log(`[Instagram Service] → ${init.method} ${endpoint.replace(/key=[^&]+/, 'key=***')}`);

    let apiRes: Response | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      apiRes = await fetch(endpoint, init);

      if (apiRes.ok) break;

      // If provider returned 404, try the alternate endpoint if available
      if (apiRes.status === 404 && provider === 'instagram-reels-downloader' && attempt === 0) {
        const alternatePath = endpoint.includes('/downloadReel') ? '/download' : '/downloadReel';
        const alternateEndpoint = `https://${apiHost}${alternatePath}?url=${encodeURIComponent(url)}`;
        console.log(`[Instagram Service] Primary endpoint 404, trying alternate: ${alternatePath}`);
        const altRes = await fetch(alternateEndpoint, init);
        if (altRes.ok || altRes.status !== 404) {
          endpoint = alternateEndpoint;
          apiRes = altRes;
          if (apiRes.ok) break;
        }
      }

      // If 500 (transient server or upstream maintenance), retry with exponential backoff
      if (apiRes.status === 500 && attempt < maxRetries) {
        const delayMs = (attempt + 1) * 1000;
        console.warn(`[Instagram Service] RapidAPI returned 500 (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      break;
    }

    if (!apiRes || !apiRes.ok) {
      const errorText = apiRes ? await apiRes.text().catch(() => '(no body)') : 'No response';
      const status = apiRes?.status || 0;

      if (status === 401 || status === 403) {
        throw new Error(
          `RapidAPI authentication failed (${status}). Check that RAPIDAPI_KEY is valid and subscribed to "${apiHost}".`
        );
      }
      if (status === 404) {
        throw new Error(
          `RapidAPI endpoint not found (404) on "${apiHost}". Verify endpoint path configuration.`
        );
      }
      if (status === 429) {
        throw new Error(
          `RapidAPI rate limit exceeded (429) for "${apiHost}". You may have hit your plan quota.`
        );
      }
      if (status === 500) {
        throw new Error(
          `RapidAPI upstream provider unavailable (500) after retries. The service reported maintenance or the Reel is unavailable.`
        );
      }
      throw new Error(`Media Extraction API failed (${status}): ${errorText.slice(0, 200)}`);
    }

    const data = await apiRes.json();
    parseProviderResponse(provider, data as Record<string, unknown>, result);

    if (!result.videoUrl && !result.caption && !result.thumbnailUrl) {
      console.warn('[Instagram Service] API returned 200 but no media data was found. Raw keys:', Object.keys(data));
      throw new Error(
        'API returned successfully but no usable media data (video, caption, or thumbnail) was found in the response.'
      );
    }

    console.log(
      `[Instagram Service] Extracted metadata — caption: ${result.caption ? result.caption.slice(0, 50) + '…' : '(none)'}, video: ${!!result.videoUrl}, thumbnail: ${!!result.thumbnailUrl}`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Instagram Service] API extraction failed:', message);
    throw new Error(`Media Extraction API failed: ${message}`);
  }

  // ── Download the actual video file to local temporary storage ──
  if (result.videoUrl) {
    try {
      console.log('[Instagram Service] Downloading actual video media...');
      const videoRes = await fetch(result.videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });

      if (!videoRes.ok) {
        throw new Error(`Failed to download media file (Status: ${videoRes.status})`);
      }

      const contentType = videoRes.headers.get('content-type') || '';
      // If the URL returned an image (e.g. data.thu was passed as a videoUrl), reassign to thumbnail
      if (contentType.startsWith('image/')) {
        console.warn(`[Instagram Service] Media URL returned image content-type (${contentType}), not a video. Reassigning to thumbnail.`);
        if (!result.thumbnailUrl) {
          result.thumbnailUrl = result.videoUrl;
        }
        result.videoUrl = null;
        return result;
      }

      const buffer = Buffer.from(await videoRes.arrayBuffer());
      
      // Ensure we actually got a decent sized media file (minimum 10KB to ensure it's not a text error page)
      if (buffer.length > 10000) {
        const tmpDir = os.tmpdir();
        // Extract a safe shortcode or generate a random string for the filename
        const safeId = url.replace(/[^a-zA-Z0-9]/g, '').slice(-10) || Date.now().toString();
        const tmpFile = path.join(tmpDir, `recall_media_${safeId}_${Date.now()}.mp4`);
        
        fs.writeFileSync(tmpFile, buffer);
        result.videoPath = tmpFile;
        
        console.log(`[Instagram Service] ✅ Video downloaded successfully to ${tmpFile} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
      } else {
        throw new Error('Downloaded media file was too small, likely an error response from the CDN.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Instagram Service] Actual video download failed:', message);
      // We do not throw here. If video download fails but we have caption, we still want to fall back to processing the caption.
    }
  }

  return result;
}

export function cleanupTempVideo(videoPath: string | null) {
  if (!videoPath) return;
  try {
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
      console.log('[Instagram Service] Cleaned up temporary video file.');
    }
  } catch (_) {
    // Silently ignore cleanup errors to prevent crashing the main thread
  }
}
