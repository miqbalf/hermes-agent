import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { $activeSessionId, $selectedStoredSessionId } from '@/store/session'

import { MarkdownTextContent } from './markdown-text'

const OPTIONS_PAYLOAD = {
  kind: 'swarm-direction',
  options: [
    { id: 'research', label: 'Research' },
    { id: 'deepresearch', label: 'Deep research', recommended: true },
    { id: 'chat', label: 'Just chat' }
  ]
}

function fenced(language: string, body: string): string {
  return `Pick a direction:\n\n\`\`\`${language}\n${body}\n\`\`\`\n`
}

// End-to-end for the option-chip path: a ```hermes-options fence must come out
// of preprocessMarkdown -> Streamdown -> SyntaxHighlighter as clickable chips
// (recommended first), a malformed payload keeps the plain code-card path, and
// clicking a chip submits the option id through the composer-submit bus.
describe('MarkdownTextContent hermes-options', () => {
  beforeEach(() => {
    $activeSessionId.set('session-options')
    $selectedStoredSessionId.set(null)
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    $activeSessionId.set(null)
    $selectedStoredSessionId.set(null)
    window.localStorage.clear()
  })

  it('renders option chips with the recommended option first', async () => {
    const { container } = render(
      <MarkdownTextContent isRunning={false} text={fenced('hermes-options', JSON.stringify(OPTIONS_PAYLOAD))} />
    )

    const group = await screen.findByRole('group', { name: 'swarm-direction' })

    expect(group.dataset.slot).toBe('aui_hermes-options')
    // Recommended-first reorder: the payload lists 'deepresearch' second.
    expect(Array.from(group.querySelectorAll('button')).map(button => button.textContent)).toEqual([
      'Deep research',
      'Research',
      'Just chat'
    ])

    // The recommended chip is the primary variant; the rest are secondary.
    const variants = Array.from(group.querySelectorAll('button')).map(button =>
      button.className.includes('bg-primary') ? 'primary' : 'secondary'
    )

    expect(variants).toEqual(['primary', 'secondary', 'secondary'])
    expect(container.querySelector('[data-slot="code-card"]')).toBeNull()
  })

  it('renders each hermes-options block in a message as its own chip row', async () => {
    const second = { kind: 'confirm', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] }
    const text = `${fenced('hermes-options', JSON.stringify(OPTIONS_PAYLOAD))}\nAnd if not:\n\n${fenced('hermes-options', JSON.stringify(second))}`

    render(<MarkdownTextContent isRunning={false} text={text} />)

    const groups = await screen.findAllByRole('group')

    expect(groups).toHaveLength(2)
    expect(groups[0]?.getAttribute('aria-label')).toBe('swarm-direction')
    expect(groups[1]?.getAttribute('aria-label')).toBe('confirm')
  })

  it('falls back to a plain code block when the payload is malformed', async () => {
    const { container } = render(<MarkdownTextContent isRunning={false} text={fenced('hermes-options', '{nope')} />)

    // The malformed payload must not vanish — it renders as a normal code card.
    await screen.findByText('Pick a direction:')
    expect(container.querySelector('[data-slot="code-card"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="aui_hermes-options"]')).toBeNull()
  })

  it('submits the option id through the composer-submit bus and disables the row', async () => {
    render(<MarkdownTextContent isRunning={false} text={fenced('hermes-options', JSON.stringify(OPTIONS_PAYLOAD))} />)

    const group = await screen.findByRole('group', { name: 'swarm-direction' })
    const submitted: unknown[] = []
    const listener = (event: Event) => submitted.push((event as CustomEvent).detail)

    window.addEventListener('hermes:composer-submit', listener)

    try {
      fireEvent.click(Array.from(group.querySelectorAll('button'))[1] as HTMLElement)

      await new Promise(resolve => window.setTimeout(resolve, 0))

      expect(submitted).toEqual([{ target: 'main', text: 'research' }])
      // The question is answered: the whole row is stale and non-clickable.
      expect(Array.from(group.querySelectorAll('button')).every(button => button.hasAttribute('disabled'))).toBe(true)
    } finally {
      window.removeEventListener('hermes:composer-submit', listener)
    }
  })
})
