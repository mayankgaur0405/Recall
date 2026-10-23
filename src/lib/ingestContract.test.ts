import { describe, expect, it } from 'vitest'
import { extractInstagramReelUrl } from './reelUrl'

describe('share ingest contract', () => {
  it('share receivers send a normalized reel URL in JSON { url }', () => {
    const shared = 'Check this https://www.instagram.com/reel/Zz9_abC/?igsh=1'
    const url = extractInstagramReelUrl(shared)
    expect(url).toBe('https://www.instagram.com/reel/Zz9_abC/')
    expect(JSON.stringify({ url })).toBe(
      JSON.stringify({ url: 'https://www.instagram.com/reel/Zz9_abC/' })
    )
  })
})
