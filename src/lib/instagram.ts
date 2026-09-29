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
 * Extracts Instagram Reel media (Video URL, Caption, Thumbnail) using a third-party API provider.
 * This ensures we don't get blocked by Instagram's anti-bot protections.
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
    throw new Error('RAPIDAPI_KEY is not configured in .env.local. Please follow the setup instructions to enable automatic reel downloading.');
  }

  console.log(`[Instagram Service] Fetching media using RapidAPI provider: ${apiHost}`);

  try {
    let endpoint = '';
    const encodedUrl = encodeURIComponent(url);
    
    if (apiHost.includes('instagram-video-reel-downloader')) {
      // Logic for the 'awseeley' API
      endpoint = `https://${apiHost}/instagram/video?url=${encodedUrl}`;
    } else {
      // Logic for the 'reiyu' API (default)
      endpoint = `https://${apiHost}/v1/post_info?code_or_id_or_url=${encodedUrl}`;
    }

    const apiRes = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': apiHost,
      },
    });

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      throw new Error(`Media Extraction API failed (${apiRes.status}): ${errorText}`);
    }

    const data = await apiRes.json();
    
    // Check if we are dealing with the 'awseeley' API response format
    if (apiHost.includes('instagram-video-reel-downloader')) {
      if (!data.videoUrl && !data.caption) {
        throw new Error('API returned successfully but no media data was found in the response.');
      }
      
      result.videoUrl = data.videoUrl || data.downloads?.[0]?.videoUrl;
      result.caption = data.caption;
      result.thumbnailUrl = data.thumbnailUrl;
      result.author = data.authorUsername;
    } else {
      // Default to the 'reiyu' API response format
      const item = data?.data;

      if (!item) {
        throw new Error('API returned successfully but no media data was found in the response.');
      }

      // Extract Video URL
      if (item.video_url) {
        result.videoUrl = item.video_url;
      } else if (item.items && item.items[0]?.video_versions) {
        result.videoUrl = item.items[0].video_versions[0]?.url;
      }

      // Extract Caption
      if (item.caption?.text) {
        result.caption = item.caption.text;
      } else if (item.items && item.items[0]?.caption?.text) {
        result.caption = item.items[0].caption.text;
      }

      // Extract Thumbnail
      if (item.thumbnail_url) {
        result.thumbnailUrl = item.thumbnail_url;
      }

      // Extract Author
      if (item.user?.username) {
        result.author = item.user.username;
      }
    }

    console.log(`[Instagram Service] Successfully extracted metadata. Found Video URL: ${!!result.videoUrl}`);

  } catch (err: any) {
    console.error('[Instagram Service] API Extraction failed:', err.message);
    throw new Error(`Media Extraction API failed: ${err.message}`);
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
    } catch (err: any) {
      console.error('[Instagram Service] Actual video download failed:', err.message);
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
