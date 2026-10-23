const REEL_PATH_PATTERN =
  /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i
const SHARE_PATH_PATTERN =
  /https?:\/\/(?:www\.)?instagram\.com\/share\/(?:reel\/|p\/|r\/)?([A-Za-z0-9_-]+)/i
const SHORT_PATTERN = /https?:\/\/(?:www\.)?instagr\.am\/(?:reel|p)\/([A-Za-z0-9_-]+)/i

/**
 * Pull an Instagram Reel/post URL out of shared text and normalize it.
 * Returns null when no supported Instagram URL is present.
 */
export function extractInstagramReelUrl(input: string | null | undefined): string | null {
  if (!input) return null

  const text = input.trim()
  if (!text) return null

  const shareMatch = text.match(SHARE_PATH_PATTERN)
  if (shareMatch?.[1]) {
    return canonicalReelUrl(shareMatch[1])
  }

  const reelMatch = text.match(REEL_PATH_PATTERN) || text.match(SHORT_PATTERN)
  if (reelMatch?.[1]) {
    return canonicalReelUrl(reelMatch[1])
  }

  return null
}

export function isInstagramReelUrl(input: string | null | undefined): boolean {
  return extractInstagramReelUrl(input) !== null
}

function canonicalReelUrl(shortcode: string): string {
  return `https://www.instagram.com/reel/${shortcode}/`
}
