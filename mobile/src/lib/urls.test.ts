import { describe, expect, it } from 'vitest'
import { extractInstagramReelUrl } from './urls'

describe('extractInstagramReelUrl', () => {
  it('normalizes Instagram share text', () => {
    expect(
      extractInstagramReelUrl('Look https://www.instagram.com/reel/AbC123xyz/?igsh=zz')
    ).toBe('https://www.instagram.com/reel/AbC123xyz/')
  })

  it('rejects non-Instagram text', () => {
    expect(extractInstagramReelUrl('https://tiktok.com/@x/video/1')).toBeNull()
  })

  it('accepts share and short links', () => {
    expect(extractInstagramReelUrl('https://www.instagram.com/share/reel/AbC123xyz/')).toBe(
      'https://www.instagram.com/reel/AbC123xyz/'
    )
    expect(extractInstagramReelUrl('https://www.instagram.com/share/r/AbC123xyz/')).toBe(
      'https://www.instagram.com/reel/AbC123xyz/'
    )
    expect(extractInstagramReelUrl('Check this out: https://www.instagram.com/share/AbC123xyz?igsh=123')).toBe(
      'https://www.instagram.com/reel/AbC123xyz/'
    )
  })
})
