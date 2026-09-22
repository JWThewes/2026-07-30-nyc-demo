import { describe, expect, it } from 'vitest'
import { createSpool } from './domain'
import { exportInventory, loadInventory, parseInventory, saveInventory } from './storage'

const spool = createSpool({
  name: 'Red PLA', brand: 'Maker', material: 'PLA', color: '#ff0000',
  initialWeight: 1000, remainingWeight: 900, status: 'active', notes: '',
})

describe('inventory storage', () => {
  it('round-trips inventory through storage', () => {
    saveInventory([spool])
    expect(loadInventory()).toEqual([spool])
  })

  it('exports a backup accepted by the importer', () => {
    expect(parseInventory(exportInventory([spool]))).toEqual([spool])
  })

  it('rejects malformed JSON', () => {
    expect(() => parseInventory('{bad')).toThrow('not valid JSON')
  })

  it('rejects an invalid spool schema', () => {
    expect(() => parseInventory(JSON.stringify({ version: 1, spools: [{ name: 'incomplete' }] }))).toThrow('invalid spool')
  })

  it('surfaces storage write failures', () => {
    const brokenStorage = { setItem: () => { throw new DOMException('full') } } as unknown as Storage
    expect(() => saveInventory([spool], brokenStorage)).toThrow('could not be saved')
  })
})
