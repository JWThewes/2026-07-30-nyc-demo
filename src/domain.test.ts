import { describe, expect, it, vi } from 'vitest'
import { consumeFilament, correctRemaining, createSpool, type SpoolDraft } from './domain'

const draft: SpoolDraft = {
  name: ' Galaxy Black ',
  brand: ' Polymaker ',
  material: 'PLA',
  color: '#111111',
  initialWeight: 1000,
  remainingWeight: 800,
  status: 'active',
  notes: ' Shelf A ',
}

describe('filament domain', () => {
  it('creates a normalized spool', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'spool-1' })
    const spool = createSpool(draft, new Date('2026-01-01T00:00:00Z'))
    expect(spool).toMatchObject({ id: 'spool-1', name: 'Galaxy Black', brand: 'Polymaker', notes: 'Shelf A' })
  })

  it('rejects a remaining weight above the initial weight', () => {
    expect(() => createSpool({ ...draft, remainingWeight: 1001 })).toThrow('Remaining weight')
  })

  it('records usage and subtracts it from the remainder', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'usage-1' })
    const spool = createSpool(draft)
    const updated = consumeFilament(spool, 50, 'Bracket')
    expect(updated.remainingWeight).toBe(750)
    expect(updated.usage[0]).toMatchObject({ grams: 50, note: 'Bracket' })
  })

  it('rejects usage above the remaining weight', () => {
    expect(() => consumeFilament(createSpool(draft), 801, '')).toThrow('cannot exceed')
  })

  it('marks an exhausted spool empty and revives it after correction', () => {
    const empty = consumeFilament(createSpool({ ...draft, remainingWeight: 20 }), 20, '')
    expect(empty.status).toBe('empty')
    expect(correctRemaining(empty, 10).status).toBe('active')
  })
})
