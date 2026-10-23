import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock supabase before imports
vi.mock('./auth', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('./config', () => ({
  apiUrl: 'https://api.test.com',
}))

import { retryReelAnalysis, ingestReel } from './api'
import { supabase } from './auth'
import type { Session } from '@supabase/supabase-js'

const mockSession = {
  access_token: 'test-token',
  user: { id: 'user-123' },
} as unknown as Session

describe('mobile api', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  describe('retryReelAnalysis', () => {
    it('calls retry endpoint and returns success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await retryReelAnalysis(mockSession, 'reel-123')
      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/api/reels/reel-123/retry',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
    })

    it('handles backend error responses gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Analysis is already in progress' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await retryReelAnalysis(mockSession, 'reel-123')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Analysis is already in progress')
    })

    it('handles network failure gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network disconnected'))
      vi.stubGlobal('fetch', mockFetch)

      const result = await retryReelAnalysis(mockSession, 'reel-123')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Network disconnected')
    })
  })

  describe('ingestReel', () => {
    it('throws error for invalid non-Instagram URLs', async () => {
      await expect(ingestReel(mockSession, 'https://example.com/not-a-reel')).rejects.toThrow(
        'That share did not include a supported Instagram Reel link.'
      )
    })

    it('saves via backend when available', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, savedItem: { id: 'reel-abc' } }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await ingestReel(mockSession, 'https://www.instagram.com/reel/C1234567890/')
      expect(result.success).toBe(true)
      expect(result.savedItem?.id).toBe('reel-abc')
    })

    it('falls back to direct Supabase when backend fails', async () => {
      // Backend fetch fails with 500
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      // Supabase mock
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'supa-reel-1',
          source_url: 'https://www.instagram.com/reel/C1234567890/',
          processing_status: 'pending',
        },
        error: null,
      })
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
      const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
      const mockSelectFind = vi.fn().mockReturnValue({ eq: mockEq1 })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'reels') {
          return {
            select: (cols: string) => {
              if (cols.includes('processing_status')) return mockSelectFind()
              return mockSelect()
            },
            insert: mockInsert,
          } as any
        }
        return {} as any
      })

      const result = await ingestReel(mockSession, 'https://www.instagram.com/reel/C1234567890/')
      expect(result.success).toBe(true)
      expect(result.persisted).toBe('supabase')
    })
  })
})
