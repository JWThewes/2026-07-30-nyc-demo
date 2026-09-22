import { MATERIALS, STATUSES, type Spool } from './domain'

const STORAGE_KEY = 'filament-ledger.inventory'
const SCHEMA_VERSION = 1

interface StoredInventory {
  version: number
  spools: Spool[]
}

function isSpool(value: unknown): value is Spool {
  if (!value || typeof value !== 'object') return false
  const spool = value as Record<string, unknown>
  return (
    typeof spool.id === 'string' &&
    typeof spool.name === 'string' &&
    typeof spool.brand === 'string' &&
    typeof spool.color === 'string' &&
    typeof spool.initialWeight === 'number' &&
    typeof spool.remainingWeight === 'number' &&
    typeof spool.notes === 'string' &&
    typeof spool.createdAt === 'string' &&
    typeof spool.updatedAt === 'string' &&
    Array.isArray(spool.usage) &&
    MATERIALS.includes(spool.material as never) &&
    STATUSES.includes(spool.status as never)
  )
}

export function parseInventory(raw: string): Spool[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('The inventory file is not valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('The inventory file is invalid.')
  const inventory = parsed as Partial<StoredInventory>
  if (inventory.version !== SCHEMA_VERSION || !Array.isArray(inventory.spools)) {
    throw new Error('The inventory file uses an unsupported format.')
  }
  if (!inventory.spools.every(isSpool)) throw new Error('The inventory contains an invalid spool.')
  return inventory.spools
}

export function loadInventory(storage: Storage = localStorage): Spool[] {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    return raw ? parseInventory(raw) : []
  } catch (error) {
    throw new Error('Inventory could not be read from browser storage.', { cause: error })
  }
}

export function saveInventory(spools: Spool[], storage: Storage = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, spools }))
  } catch (error) {
    throw new Error('Inventory could not be saved. Export a backup and check browser storage.', {
      cause: error,
    })
  }
}

export function exportInventory(spools: Spool[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), spools }, null, 2)
}
