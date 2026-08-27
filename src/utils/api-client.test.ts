import { afterEach, describe, expect, test, vi } from 'vitest'
import { ApiClient } from './api-client'

describe('ApiClient request deduplication', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('cleans up failed GET requests without leaking a rejected promise', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Not authenticated' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = new ApiClient()

    await expect(client.get('/auth/me')).rejects.toThrow('Not authenticated')
    await expect(client.get('/auth/me')).rejects.toThrow('Not authenticated')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
