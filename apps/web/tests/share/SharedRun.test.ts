// apps/web/tests/share/SharedRun.test.ts
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

// ─────────────────────────────────────────────────────────────
// jsdom shims needed for Mantine
// ─────────────────────────────────────────────────────────────
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

// ─────────────────────────────────────────────────────────────
// Lazy import after shim is installed
// ─────────────────────────────────────────────────────────────
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { SharedRun } from '../../src/pages/SharedRun'

function wrap(node: React.ReactNode) {
  return render(
    React.createElement(
      MantineProvider,
      {},
      React.createElement(Notifications, {}),
      node
    )
  )
}

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const SHARE_OK = {
  slug: 'abc12345',
  payload: {
    bundleId: 'bundle-1',
    bundle: null,
    scenarioId: 'scenario-99',
    runResult: {
      status: 'ok',
      httpStatus: 200,
      elapsedMs: 99,
      response: { message: 'all good' },
      captured: {},
    },
  },
  createdAt: '2026-05-15T00:00:00.000Z',
  expiresAt: '2026-06-14T00:00:00.000Z',
}

const SHARE_ERR_RESULT = {
  ...SHARE_OK,
  payload: {
    ...SHARE_OK.payload,
    runResult: {
      status: 'err',
      httpStatus: 404,
      elapsedMs: 40,
      response: null,
      error: 'Not found',
    },
  },
}

// ─────────────────────────────────────────────────────────────
// Mock fetch
// ─────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(payload: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Not Found',
    json: () => Promise.resolve(payload),
  }))
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('SharedRun', () => {
  it('renders loading state initially without crashing', () => {
    mockFetch(SHARE_OK)
    const { container } = wrap(React.createElement(SharedRun, { slug: 'abc12345' }))
    expect(container).toBeTruthy()
  })

  it('renders run result heading after successful fetch', async () => {
    mockFetch(SHARE_OK)
    wrap(React.createElement(SharedRun, { slug: 'abc12345' }))

    await waitFor(() => {
      expect(screen.getByText('Shared Run Result')).toBeTruthy()
    })
  })

  it('renders success badge for ok result', async () => {
    mockFetch(SHARE_OK)
    wrap(React.createElement(SharedRun, { slug: 'abc12345' }))

    await waitFor(() => {
      expect(screen.getByText('Success')).toBeTruthy()
    })

    expect(screen.getByText('HTTP 200')).toBeTruthy()
    expect(screen.getByText('99 ms')).toBeTruthy()
  })

  it('renders error badge for error result', async () => {
    mockFetch(SHARE_ERR_RESULT)
    wrap(React.createElement(SharedRun, { slug: 'abc12345' }))

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeTruthy()
    })

    expect(screen.getByText('Not found')).toBeTruthy()
  })

  it('renders not-found state when share is missing', async () => {
    mockFetch({ error: 'Share not found' }, 404)
    wrap(React.createElement(SharedRun, { slug: 'NOTEXIST' }))

    await waitFor(() => {
      expect(screen.getAllByText('Share not found').length).toBeGreaterThan(0)
    })
  })

  it('shows Fork button when bundle is attached', async () => {
    const shareWithBundle = {
      ...SHARE_OK,
      payload: {
        ...SHARE_OK.payload,
        bundle: { id: 'bundle-1', name: 'My Bundle', versions: [] },
      },
    }
    mockFetch(shareWithBundle)
    wrap(React.createElement(SharedRun, { slug: 'abc12345' }))

    await waitFor(() => {
      expect(screen.getByText('Fork into my workspace')).toBeTruthy()
    })
  })

  it('shows redaction disclaimer', async () => {
    mockFetch(SHARE_OK)
    wrap(React.createElement(SharedRun, { slug: 'abc12345' }))

    await waitFor(() => {
      expect(screen.getByText(/Secrets and auth tokens have been redacted/i)).toBeTruthy()
    })
  })
})
