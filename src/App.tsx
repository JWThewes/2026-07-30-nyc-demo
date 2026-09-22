import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Archive,
  Box,
  Download,
  Droplets,
  Edit3,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  MATERIALS,
  STATUSES,
  consumeFilament,
  correctRemaining,
  createSpool,
  validateDraft,
  type Spool,
  type SpoolDraft,
  type SpoolStatus,
} from './domain'
import { exportInventory, loadInventory, parseInventory, saveInventory } from './storage'

const EMPTY_DRAFT: SpoolDraft = {
  name: '',
  brand: '',
  material: 'PLA',
  color: '#e85d3f',
  initialWeight: 1000,
  remainingWeight: 1000,
  status: 'active',
  notes: '',
}

type DialogState =
  | { type: 'form'; spool?: Spool }
  | { type: 'consume'; spool: Spool }
  | { type: 'correct'; spool: Spool }
  | null

function readInitialInventory(): { spools: Spool[]; error: string } {
  try {
    return { spools: loadInventory(), error: '' }
  } catch (error) {
    return { spools: [], error: error instanceof Error ? error.message : 'Inventory could not be loaded.' }
  }
}

export function App() {
  const initial = useMemo(readInitialInventory, [])
  const [spools, setSpools] = useState(initial.spools)
  const [error, setError] = useState(initial.error)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SpoolStatus | 'all'>('all')
  const [dialog, setDialog] = useState<DialogState>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const shouldSkipInitialSave = useRef(Boolean(initial.error))

  useEffect(() => {
    if (shouldSkipInitialSave.current) {
      shouldSkipInitialSave.current = false
      return
    }
    try {
      saveInventory(spools)
    } catch (storageError) {
      setError(storageError instanceof Error ? storageError.message : 'Inventory could not be saved.')
    }
  }, [spools])

  const filteredSpools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return spools.filter((spool) => {
      const matchesFilter = filter === 'all' || spool.status === filter
      const searchable = `${spool.name} ${spool.brand} ${spool.material} ${spool.notes}`.toLowerCase()
      return matchesFilter && searchable.includes(normalizedQuery)
    })
  }, [filter, query, spools])

  const totals = useMemo(
    () => ({
      active: spools.filter((spool) => spool.status === 'active').length,
      remaining: spools.reduce((sum, spool) => sum + spool.remainingWeight, 0),
      used: spools.reduce((sum, spool) => sum + spool.initialWeight - spool.remainingWeight, 0),
    }),
    [spools],
  )

  function commit(next: Spool[]) {
    setError('')
    setSpools(next)
  }

  function saveSpool(draft: SpoolDraft, existing?: Spool) {
    if (existing) {
      const errors = validateDraft(draft)
      if (errors.length) throw new Error(errors.join(' '))
      commit(
        spools.map((spool) =>
          spool.id === existing.id
            ? { ...spool, ...draft, updatedAt: new Date().toISOString() }
            : spool,
        ),
      )
    } else {
      commit([createSpool(draft), ...spools])
    }
    setDialog(null)
  }

  function removeSpool(spool: Spool) {
    if (window.confirm(`Delete ${spool.name}? This cannot be undone.`)) {
      commit(spools.filter((candidate) => candidate.id !== spool.id))
    }
  }

  function updateSpool(updated: Spool) {
    commit(spools.map((spool) => (spool.id === updated.id ? updated : spool)))
    setDialog(null)
  }

  function downloadBackup() {
    const url = URL.createObjectURL(new Blob([exportInventory(spools)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `filament-ledger-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importBackup(file?: File) {
    if (!file) return
    try {
      const imported = parseInventory(await file.text())
      if (window.confirm(`Replace current inventory with ${imported.length} imported spool(s)?`)) {
        commit(imported)
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Backup could not be imported.')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Droplets size={20} /></span>
          <div><strong>Filament Ledger</strong><span>Local inventory</span></div>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={downloadBackup} data-testid="inventory-export-button">
            <Download size={17} /> <span>Export backup</span>
          </button>
          <button className="button secondary" onClick={() => importRef.current?.click()} data-testid="inventory-import-button">
            <Upload size={17} /> <span>Import</span>
          </button>
          <input
            ref={importRef}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importBackup(event.target.files?.[0])}
            data-testid="inventory-import-input"
          />
          <button className="button primary" onClick={() => setDialog({ type: 'form' })} data-testid="inventory-add-button">
            <Plus size={18} /> Add spool
          </button>
        </div>
      </header>

      <main>
        <section className="page-heading">
          <div>
            <p className="eyebrow">Workshop inventory</p>
            <h1>Your filament</h1>
            <p>Know what is ready before the next print starts.</p>
          </div>
        </section>

        {error && (
          <div className="alert" role="alert" data-testid="inventory-error">
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError('')} data-testid="inventory-error-dismiss">
              <X size={18} />
            </button>
          </div>
        )}

        <section className="metrics" aria-label="Inventory summary">
          <Metric icon={<Box />} label="Active spools" value={String(totals.active)} />
          <Metric icon={<Archive />} label="Remaining" value={`${formatWeight(totals.remaining)}`} />
          <Metric icon={<Droplets />} label="Used to date" value={`${formatWeight(totals.used)}`} />
        </section>

        <section className="inventory-toolbar">
          <label className="search">
            <Search size={18} />
            <span className="visually-hidden">Search inventory</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, brand, material..."
              data-testid="inventory-search-input"
            />
          </label>
          <div className="segments" aria-label="Filter by status">
            {(['all', ...STATUSES] as const).map((status) => (
              <button
                className={filter === status ? 'active' : ''}
                onClick={() => setFilter(status)}
                key={status}
                data-testid={`inventory-filter-${status}`}
              >
                {status[0].toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {filteredSpools.length ? (
          <section className="spool-grid" data-testid="inventory-grid">
            {filteredSpools.map((spool) => (
              <SpoolCard
                key={spool.id}
                spool={spool}
                onEdit={() => setDialog({ type: 'form', spool })}
                onConsume={() => setDialog({ type: 'consume', spool })}
                onCorrect={() => setDialog({ type: 'correct', spool })}
                onDelete={() => removeSpool(spool)}
              />
            ))}
          </section>
        ) : (
          <section className="empty-state" data-testid="inventory-empty-state">
            <span><Box size={26} /></span>
            <h2>{spools.length ? 'No matching spools' : 'Add your first spool'}</h2>
            <p>{spools.length ? 'Try another search or status filter.' : 'Start with the filament already loaded in your printer.'}</p>
            {!spools.length && (
              <button className="button primary" onClick={() => setDialog({ type: 'form' })} data-testid="empty-add-button">
                <Plus size={18} /> Add spool
              </button>
            )}
          </section>
        )}
      </main>

      {dialog?.type === 'form' && (
        <SpoolForm spool={dialog.spool} onSave={saveSpool} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'consume' && (
        <WeightDialog
          title="Record print usage"
          label="Filament used (g)"
          submitLabel="Record usage"
          max={dialog.spool.remainingWeight}
          includeNote
          onSubmit={(grams, note) => updateSpool(consumeFilament(dialog.spool, grams, note))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'correct' && (
        <WeightDialog
          title="Correct remaining weight"
          label="Current remaining weight (g)"
          submitLabel="Save correction"
          initial={dialog.spool.remainingWeight}
          max={dialog.spool.initialWeight}
          onSubmit={(grams) => updateSpool(correctRemaining(dialog.spool, grams))}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="metric"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>
}

function SpoolCard({ spool, onEdit, onConsume, onCorrect, onDelete }: {
  spool: Spool; onEdit: () => void; onConsume: () => void; onCorrect: () => void; onDelete: () => void
}) {
  const percentage = Math.round((spool.remainingWeight / spool.initialWeight) * 100)
  return (
    <article className="spool-card" data-testid="spool-card">
      <div className="card-top">
        <span className={`status status-${spool.status}`}>{spool.status}</span>
        <div className="icon-actions">
          <button aria-label={`Edit ${spool.name}`} onClick={onEdit} data-testid="spool-edit-button"><Edit3 size={17} /></button>
          <button aria-label={`Delete ${spool.name}`} onClick={onDelete} data-testid="spool-delete-button"><Trash2 size={17} /></button>
        </div>
      </div>
      <div className="spool-identity">
        <span className="color-swatch" style={{ backgroundColor: spool.color }} />
        <div><h2>{spool.name}</h2><p>{spool.brand} · {spool.material}</p></div>
      </div>
      <div className="weight-row"><strong>{formatWeight(spool.remainingWeight)}</strong><span>of {formatWeight(spool.initialWeight)}</span></div>
      <div className="progress"><span style={{ width: `${percentage}%` }} /></div>
      <div className="percentage"><span>{percentage}% remaining</span><span>{spool.usage.length} usage entries</span></div>
      {spool.notes && <p className="notes">{spool.notes}</p>}
      <div className="card-actions">
        <button className="button primary" disabled={!spool.remainingWeight} onClick={onConsume} data-testid="spool-consume-button">
          <Droplets size={17} /> Record usage
        </button>
        <button className="button secondary" onClick={onCorrect} data-testid="spool-correct-button">Correct</button>
      </div>
    </article>
  )
}

function SpoolForm({ spool, onSave, onClose }: {
  spool?: Spool; onSave: (draft: SpoolDraft, spool?: Spool) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState<SpoolDraft>(spool ? {
    name: spool.name, brand: spool.brand, material: spool.material, color: spool.color,
    initialWeight: spool.initialWeight, remainingWeight: spool.remainingWeight,
    status: spool.status, notes: spool.notes,
  } : EMPTY_DRAFT)
  const [formError, setFormError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    try { onSave(draft, spool) } catch (error) { setFormError(error instanceof Error ? error.message : 'Spool could not be saved.') }
  }
  const set = <K extends keyof SpoolDraft>(key: K, value: SpoolDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  return (
    <Dialog title={spool ? 'Edit spool' : 'Add a spool'} onClose={onClose}>
      <form onSubmit={submit} data-testid="spool-form">
        {formError && <div className="form-error" role="alert">{formError}</div>}
        <div className="form-grid">
          <Field label="Spool name"><input required value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Galaxy Black" data-testid="spool-name-input" /></Field>
          <Field label="Brand"><input required value={draft.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Polymaker" data-testid="spool-brand-input" /></Field>
          <Field label="Material"><select value={draft.material} onChange={(e) => set('material', e.target.value as SpoolDraft['material'])} data-testid="spool-material-select">{MATERIALS.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Color"><input type="color" value={draft.color} onChange={(e) => set('color', e.target.value)} data-testid="spool-color-input" /></Field>
          <Field label="Initial weight (g)"><input type="number" min="1" required value={draft.initialWeight} onChange={(e) => set('initialWeight', Number(e.target.value))} data-testid="spool-initial-weight-input" /></Field>
          <Field label="Remaining weight (g)"><input type="number" min="0" max={draft.initialWeight} required value={draft.remainingWeight} onChange={(e) => set('remainingWeight', Number(e.target.value))} data-testid="spool-remaining-weight-input" /></Field>
          <Field label="Status"><select value={draft.status} onChange={(e) => set('status', e.target.value as SpoolStatus)} data-testid="spool-status-select">{STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Notes" wide><textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Storage location, print settings..." data-testid="spool-notes-input" /></Field>
        </div>
        <DialogActions onClose={onClose} submitLabel={spool ? 'Save changes' : 'Add spool'} />
      </form>
    </Dialog>
  )
}

function WeightDialog({ title, label, submitLabel, max, initial = 0, includeNote = false, onSubmit, onClose }: {
  title: string; label: string; submitLabel: string; max: number; initial?: number; includeNote?: boolean
  onSubmit: (grams: number, note: string) => void; onClose: () => void
}) {
  const [grams, setGrams] = useState(initial)
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    try { onSubmit(grams, note) } catch (error) { setFormError(error instanceof Error ? error.message : 'Weight could not be updated.') }
  }
  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={submit} data-testid="weight-form">
        {formError && <div className="form-error" role="alert">{formError}</div>}
        <Field label={label}><input autoFocus type="number" min={includeNote ? 0.1 : 0} max={max} step="0.1" required value={grams} onChange={(e) => setGrams(Number(e.target.value))} data-testid="weight-grams-input" /></Field>
        {includeNote && <Field label="Print or note"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Benchy, bracket..." data-testid="weight-note-input" /></Field>}
        <DialogActions onClose={onClose} submitLabel={submitLabel} />
      </form>
    </Dialog>
  )
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" data-testid="inventory-dialog">
      <div className="dialog-header"><h2 id="dialog-title">{title}</h2><button aria-label="Close dialog" onClick={onClose} data-testid="dialog-close-button"><X size={20} /></button></div>
      {children}
    </section>
  </div>
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? 'field wide' : 'field'}><span>{label}</span>{children}</label>
}

function DialogActions({ onClose, submitLabel }: { onClose: () => void; submitLabel: string }) {
  return <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose} data-testid="dialog-cancel-button">Cancel</button><button className="button primary" type="submit" data-testid="dialog-submit-button">{submitLabel}</button></div>
}

function formatWeight(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(2)} kg` : `${Math.round(grams)} g`
}
