export const MATERIALS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'Nylon', 'Other'] as const
export const STATUSES = ['active', 'sealed', 'empty'] as const

export type Material = (typeof MATERIALS)[number]
export type SpoolStatus = (typeof STATUSES)[number]

export interface UsageEntry {
  id: string
  grams: number
  note: string
  createdAt: string
}

export interface Spool {
  id: string
  name: string
  brand: string
  material: Material
  color: string
  initialWeight: number
  remainingWeight: number
  status: SpoolStatus
  notes: string
  createdAt: string
  updatedAt: string
  usage: UsageEntry[]
}

export type SpoolDraft = Omit<Spool, 'id' | 'createdAt' | 'updatedAt' | 'usage'>

export function validateDraft(draft: SpoolDraft): string[] {
  const errors: string[] = []
  if (!draft.name.trim()) errors.push('Spool name is required.')
  if (!draft.brand.trim()) errors.push('Brand is required.')
  if (!MATERIALS.includes(draft.material)) errors.push('Choose a valid material.')
  if (!/^#[0-9a-f]{6}$/i.test(draft.color)) errors.push('Choose a valid color.')
  if (!Number.isFinite(draft.initialWeight) || draft.initialWeight <= 0) {
    errors.push('Initial weight must be greater than zero.')
  }
  if (
    !Number.isFinite(draft.remainingWeight) ||
    draft.remainingWeight < 0 ||
    draft.remainingWeight > draft.initialWeight
  ) {
    errors.push('Remaining weight must be between zero and the initial weight.')
  }
  if (!STATUSES.includes(draft.status)) errors.push('Choose a valid status.')
  return errors
}

export function createSpool(draft: SpoolDraft, now = new Date()): Spool {
  const errors = validateDraft(draft)
  if (errors.length) throw new Error(errors.join(' '))
  const timestamp = now.toISOString()
  return {
    ...draft,
    name: draft.name.trim(),
    brand: draft.brand.trim(),
    notes: draft.notes.trim(),
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    usage: [],
  }
}

export function consumeFilament(
  spool: Spool,
  grams: number,
  note: string,
  now = new Date(),
): Spool {
  if (!Number.isFinite(grams) || grams <= 0) throw new Error('Usage must be greater than zero.')
  if (grams > spool.remainingWeight) throw new Error('Usage cannot exceed the remaining weight.')
  const timestamp = now.toISOString()
  const remainingWeight = spool.remainingWeight - grams
  return {
    ...spool,
    remainingWeight,
    status: remainingWeight === 0 ? 'empty' : spool.status,
    updatedAt: timestamp,
    usage: [
      {
        id: crypto.randomUUID(),
        grams,
        note: note.trim(),
        createdAt: timestamp,
      },
      ...spool.usage,
    ],
  }
}

export function correctRemaining(spool: Spool, grams: number, now = new Date()): Spool {
  if (!Number.isFinite(grams) || grams < 0 || grams > spool.initialWeight) {
    throw new Error('Remaining weight must be between zero and the initial weight.')
  }
  return {
    ...spool,
    remainingWeight: grams,
    status: grams === 0 ? 'empty' : spool.status === 'empty' ? 'active' : spool.status,
    updatedAt: now.toISOString(),
  }
}
