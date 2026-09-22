import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('adds a practical spool record', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByTestId('inventory-add-button'))
    await user.type(screen.getByTestId('spool-name-input'), 'Galaxy Black')
    await user.type(screen.getByTestId('spool-brand-input'), 'Polymaker')
    await user.click(screen.getByTestId('dialog-submit-button'))
    expect(screen.getByText('Galaxy Black')).toBeInTheDocument()
    expect(screen.getByText(/Polymaker/)).toBeInTheDocument()
  })

  it('records print consumption', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByTestId('empty-add-button'))
    await user.type(screen.getByTestId('spool-name-input'), 'White PLA')
    await user.type(screen.getByTestId('spool-brand-input'), 'Generic')
    await user.click(screen.getByTestId('dialog-submit-button'))
    await user.click(screen.getByTestId('spool-consume-button'))
    await user.clear(screen.getByTestId('weight-grams-input'))
    await user.type(screen.getByTestId('weight-grams-input'), '125')
    await user.type(screen.getByTestId('weight-note-input'), 'Enclosure')
    await user.click(screen.getByTestId('dialog-submit-button'))
    expect(screen.getAllByText('875 g')).toHaveLength(2)
    expect(screen.getByText('1 usage entries')).toBeInTheDocument()
  })

  it('deletes a spool after confirmation', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByTestId('empty-add-button'))
    await user.type(screen.getByTestId('spool-name-input'), 'Temporary')
    await user.type(screen.getByTestId('spool-brand-input'), 'Maker')
    await user.click(screen.getByTestId('dialog-submit-button'))
    await user.click(screen.getByTestId('spool-delete-button'))
    expect(screen.queryByText('Temporary')).not.toBeInTheDocument()
  })

  it('reports malformed stored data without overwriting it', () => {
    localStorage.setItem('filament-ledger.inventory', '{bad')
    render(<App />)
    expect(screen.getByTestId('inventory-error')).toHaveTextContent('could not be read')
    expect(localStorage.getItem('filament-ledger.inventory')).toBe('{bad')
  })
})
