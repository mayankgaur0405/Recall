import { describe, expect, it } from 'vitest'
import { extractInstagramReelUrl, isInstagramReelUrl } from './reelUrl'

describe('extractInstagramReelUrl', () => {
  it('extracts a standard reel URL', () => {
    expect(extractInstagramReelUrl('https://www.instagram.com/reel/AbC123xyz/')).toBe(
      'https://www.instagram.com/reel/AbC123xyz/'
    )
  })

  it('strips tracking query params', () => {
    expect(
      extractInstagramReelUrl('https://www.instagram.com/reel/AbC123xyz/?igsh=abc&utm_source=ig')
    ).toBe('https://www.instagram.com/reel/AbC123xyz/')
  })

  it('extracts a URL buried in shared text', () => {
    expect(
      extractInstagramReelUrl('Check this out https://instagram.com/reel/AbC123xyz/?igsh=1 wow')
    ).toBe('https://www.instagram.com/reel/AbC123xyz/')
  })

  it('accepts /reels/ and /p/ paths', () => {
    expect(extractInstagramReelUrl('https://www.instagram.com/reels/AbC123xyz/')).toBe(
      'https://www.instagram.com/reel/AbC123xyz/'
    )
    expect(extractInstagramReelUrl('https://www.instagram.com/p/AbC123xyz/')).toBe(
      'https://www.instagram.com/reel/AbC123xyz/'
    )
  })

  it('accepts Instagram share links', () => {
    expect(extractInstagramReelUrl('https://www.instagram.com/share/reel/AbC123xyz/')).toBe(
      'https://www.instagram.com/reel/AbC123xyz/'
    )
  })

  it('accepts instagr.am short links', () => {
    expect(extractInstagramReelUrl('https://instagr.am/reel/AbC123xyz/')).toBe(
      'https://www.instagram.com/reel/AbC123xyz/'
    )
  })

  it('returns null for unsupported URLs', () => {
    expect(extractInstagramReelUrl('https://youtube.com/watch?v=1')).toBeNull()
    expect(extractInstagramReelUrl('not a url')).toBeNull()
    expect(extractInstagramReelUrl('')).toBeNull()
    expect(extractInstagramReelUrl(null)).toBeNull()
  })

  it('isInstagramReelUrl matches extract', () => {
    expect(isInstagramReelUrl('https://www.instagram.com/reel/AbC123xyz/')).toBe(true)
    expect(isInstagramReelUrl('hello')).toBe(false)
  })
})
