import { describe, it, expect } from 'vitest'
import {
  groupBlocks,
  UNCATEGORIZED_LABEL,
  type BlockGroupNode,
  type BlockTreeNode,
} from '../../src/blocks/grouping.js'
import type { BlockDefData } from '../../src/runtime/bundle.js'

function makeBlock(
  kind: string,
  label: string,
  opts: { tags?: string[]; url?: string; method?: 'GET' | 'POST' | 'PUT' | 'DELETE' } = {}
): BlockDefData {
  return {
    kind,
    label,
    auth: 'none',
    inputs: [],
    outputs: [],
    request: {
      method: opts.method ?? 'GET',
      urlTemplate: opts.url ?? `https://api.example.com/${kind}`,
    },
    ...(opts.tags ? { tags: opts.tags } : {}),
  }
}

function groups(nodes: BlockTreeNode[]): BlockGroupNode[] {
  return nodes.filter((n): n is BlockGroupNode => n.type === 'group')
}

describe('groupBlocks - flat mode', () => {
  it('returns leaves in original order, no nesting', () => {
    const blocks = [makeBlock('a', 'A'), makeBlock('b', 'B'), makeBlock('c', 'C')]
    const tree = groupBlocks(blocks, 'flat')
    expect(tree).toHaveLength(3)
    expect(tree.every((n) => n.type === 'leaf')).toBe(true)
  })

  it('returns empty array for no blocks', () => {
    expect(groupBlocks([], 'flat')).toEqual([])
  })
})

describe('groupBlocks - tag mode', () => {
  it('groups blocks by single tag', () => {
    const blocks = [
      makeBlock('a', 'A', { tags: ['admin'] }),
      makeBlock('b', 'B', { tags: ['admin'] }),
      makeBlock('c', 'C', { tags: ['users'] }),
    ]
    const tree = groupBlocks(blocks, 'tag')
    const g = groups(tree)
    expect(g.map((n) => n.label)).toEqual(['admin', 'users'])
    expect(g[0].blockCount).toBe(2)
    expect(g[1].blockCount).toBe(1)
  })

  it('multi-tagged blocks appear once per tag', () => {
    const blocks = [makeBlock('a', 'A', { tags: ['admin', 'users'] })]
    const tree = groupBlocks(blocks, 'tag')
    const g = groups(tree)
    expect(g).toHaveLength(2)
    expect(g[0].blockCount).toBe(1)
    expect(g[1].blockCount).toBe(1)
  })

  it('blocks without tags land under (uncategorized)', () => {
    const blocks = [
      makeBlock('a', 'A', { tags: ['users'] }),
      makeBlock('b', 'B'),
    ]
    const tree = groupBlocks(blocks, 'tag')
    const g = groups(tree)
    expect(g.map((n) => n.label)).toEqual(['users', UNCATEGORIZED_LABEL])
  })

  it('uncategorized sorts last regardless of alphabetical order', () => {
    const blocks = [
      makeBlock('a', 'A'),
      makeBlock('b', 'B', { tags: ['zebra'] }),
      makeBlock('c', 'C', { tags: ['apple'] }),
    ]
    const tree = groupBlocks(blocks, 'tag')
    const labels = groups(tree).map((n) => n.label)
    expect(labels).toEqual(['apple', 'zebra', UNCATEGORIZED_LABEL])
  })

  it('sorts groups case-insensitively', () => {
    const blocks = [
      makeBlock('a', 'A', { tags: ['Beta'] }),
      makeBlock('b', 'B', { tags: ['alpha'] }),
    ]
    const labels = groups(groupBlocks(blocks, 'tag')).map((n) => n.label)
    expect(labels).toEqual(['alpha', 'Beta'])
  })

  it('leaf nodes inside a group are sorted by label', () => {
    const blocks = [
      makeBlock('z', 'Zoo', { tags: ['admin'] }),
      makeBlock('a', 'Apple', { tags: ['admin'] }),
    ]
    const tree = groupBlocks(blocks, 'tag')
    const adminGroup = groups(tree)[0]
    const leafLabels = adminGroup.children
      .filter((n) => n.type === 'leaf')
      .map((n) => (n.type === 'leaf' ? n.block.label : ''))
    expect(leafLabels).toEqual(['Apple', 'Zoo'])
  })

  it('returns empty array for no blocks', () => {
    expect(groupBlocks([], 'tag')).toEqual([])
  })
})

describe('groupBlocks - path mode', () => {
  it('groups by first 2 path segments, nested', () => {
    const blocks = [
      makeBlock('a', 'A', { url: 'https://api.example.com/admin/users' }),
      makeBlock('b', 'B', { url: 'https://api.example.com/admin/users/{id}' }),
      makeBlock('c', 'C', { url: 'https://api.example.com/admin/sessions' }),
      makeBlock('d', 'D', { url: 'https://api.example.com/webhook/paymongo' }),
    ]
    const tree = groupBlocks(blocks, 'path')
    const top = groups(tree)
    expect(top.map((n) => n.label)).toEqual(['admin', 'webhook'])
    expect(top[0].blockCount).toBe(3)
    expect(top[1].blockCount).toBe(1)

    const adminChildren = groups(top[0].children)
    expect(adminChildren.map((n) => n.label)).toEqual(['sessions', 'users'])
    expect(adminChildren[1].blockCount).toBe(2) // /admin/users + /admin/users/{id}
  })

  it('strips template variables from path segments', () => {
    const blocks = [
      makeBlock('a', 'A', { url: 'https://api.example.com/users/{id}/posts/{postId}' }),
    ]
    const tree = groupBlocks(blocks, 'path')
    const top = groups(tree)
    expect(top[0].label).toBe('users')
    // {id} is stripped, so the second segment is 'posts'
    expect(groups(top[0].children)[0].label).toBe('posts')
  })

  it('strips colon-style template segments', () => {
    const blocks = [
      makeBlock('a', 'A', { url: 'https://api.example.com/users/:id/posts' }),
    ]
    const tree = groupBlocks(blocks, 'path')
    const top = groups(tree)
    expect(top[0].label).toBe('users')
    expect(groups(top[0].children)[0].label).toBe('posts')
  })

  it('handles {{baseUrl}} template prefix', () => {
    const blocks = [
      makeBlock('a', 'A', { url: '{{baseUrl}}/admin/users' }),
    ]
    const top = groups(groupBlocks(blocks, 'path'))
    expect(top[0].label).toBe('admin')
  })

  it('blocks with no parseable path land under (uncategorized)', () => {
    const blocks = [
      makeBlock('a', 'A', { url: 'https://api.example.com/' }),
      makeBlock('b', 'B', { url: 'https://api.example.com/users' }),
    ]
    const labels = groups(groupBlocks(blocks, 'path')).map((n) => n.label)
    expect(labels).toEqual(['users', UNCATEGORIZED_LABEL])
  })
})

describe('groupBlocks - blockCount', () => {
  it('counts leaves recursively through nested groups', () => {
    const blocks = [
      makeBlock('a', 'A', { url: 'https://api.example.com/admin/users/list' }),
      makeBlock('b', 'B', { url: 'https://api.example.com/admin/users/create' }),
      makeBlock('c', 'C', { url: 'https://api.example.com/admin/audit' }),
    ]
    const tree = groupBlocks(blocks, 'path')
    const admin = groups(tree)[0]
    expect(admin.blockCount).toBe(3)
  })
})
