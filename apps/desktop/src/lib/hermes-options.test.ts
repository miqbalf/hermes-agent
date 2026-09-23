import { describe, expect, it } from 'vitest'

import { isHermesOptionsLanguage, parseHermesOptions } from './hermes-options'

describe('parseHermesOptions', () => {
  it('parses a valid payload and keeps payload order when nothing is recommended', () => {
    const payload = parseHermesOptions(
      JSON.stringify({
        kind: 'swarm-direction',
        options: [
          { id: 'research', label: 'Research' },
          { id: 'chat', label: 'Just chat' }
        ]
      })
    )

    expect(payload).toEqual({
      kind: 'swarm-direction',
      options: [
        { id: 'research', label: 'Research' },
        { id: 'chat', label: 'Just chat' }
      ]
    })
  })

  it('orders recommended options first, stably, without reordering the rest', () => {
    const payload = parseHermesOptions(
      JSON.stringify({
        kind: 'swarm-direction',
        options: [
          { id: 'a', label: 'A' },
          { id: 'r1', label: 'R1', recommended: true },
          { id: 'b', label: 'B' },
          { id: 'r2', label: 'R2', recommended: true },
          { id: 'c', label: 'C' }
        ]
      })
    )

    expect(payload?.options.map(option => option.id)).toEqual(['r1', 'r2', 'a', 'b', 'c'])
  })

  it('leaves a leading recommended option in place', () => {
    const payload = parseHermesOptions(
      JSON.stringify({
        kind: 'k',
        options: [
          { id: 'r', label: 'R', recommended: true },
          { id: 'a', label: 'A' }
        ]
      })
    )

    expect(payload?.options.map(option => option.id)).toEqual(['r', 'a'])
  })

  it('returns null on malformed JSON so the caller falls back to a code block', () => {
    expect(parseHermesOptions('{not json')).toBeNull()
    expect(parseHermesOptions('')).toBeNull()
  })

  it('returns null when the payload is not an object', () => {
    expect(parseHermesOptions('[]')).toBeNull()
    expect(parseHermesOptions('"swarm-direction"')).toBeNull()
    expect(parseHermesOptions('null')).toBeNull()
  })

  it('returns null when kind is missing or not a non-empty string', () => {
    expect(parseHermesOptions(JSON.stringify({ options: [{ id: 'a', label: 'A' }] }))).toBeNull()
    expect(parseHermesOptions(JSON.stringify({ kind: 42, options: [{ id: 'a', label: 'A' }] }))).toBeNull()
    expect(parseHermesOptions(JSON.stringify({ kind: ' ', options: [{ id: 'a', label: 'A' }] }))).toBeNull()
  })

  it('returns null when options is missing, not an array, or empty', () => {
    expect(parseHermesOptions(JSON.stringify({ kind: 'k' }))).toBeNull()
    expect(parseHermesOptions(JSON.stringify({ kind: 'k', options: 'research' }))).toBeNull()
    expect(parseHermesOptions(JSON.stringify({ kind: 'k', options: [] }))).toBeNull()
  })

  it('returns null when an option lacks a string id or label', () => {
    expect(parseHermesOptions(JSON.stringify({ kind: 'k', options: [{ label: 'A' }] }))).toBeNull()
    expect(parseHermesOptions(JSON.stringify({ kind: 'k', options: [{ id: 'a' }] }))).toBeNull()
    expect(parseHermesOptions(JSON.stringify({ kind: 'k', options: [{ id: 1, label: 'A' }] }))).toBeNull()
    expect(parseHermesOptions(JSON.stringify({ kind: 'k', options: [null] }))).toBeNull()
  })

  it('ignores a non-boolean recommended flag instead of failing the block', () => {
    const payload = parseHermesOptions(
      JSON.stringify({
        kind: 'k',
        options: [
          { id: 'a', label: 'A', recommended: 'yes' },
          { id: 'b', label: 'B', recommended: true }
        ]
      })
    )

    expect(payload?.options.map(option => [option.id, option.recommended ?? false])).toEqual([
      ['b', true],
      ['a', false]
    ])
  })
})

describe('isHermesOptionsLanguage', () => {
  it('matches the hermes-options fence tag case-insensitively and rejects others', () => {
    expect(isHermesOptionsLanguage('hermes-options')).toBe(true)
    expect(isHermesOptionsLanguage('Hermes-Options')).toBe(true)
    expect(isHermesOptionsLanguage(' hermes-options ')).toBe(true)
    expect(isHermesOptionsLanguage('json')).toBe(false)
    expect(isHermesOptionsLanguage('')).toBe(false)
    expect(isHermesOptionsLanguage(undefined)).toBe(false)
    expect(isHermesOptionsLanguage(null)).toBe(false)
  })
})
