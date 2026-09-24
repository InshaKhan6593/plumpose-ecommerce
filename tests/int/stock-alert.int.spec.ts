import { describe, expect, it } from 'vitest'

import { buildStockAlert, stockAlertSettings, stockEventFor } from '@/email/stockAlert'

const M = 'Al Shaheen Nights, size M'
const event = (before: number, after: number, madeToOrder = true, threshold = 2) =>
  stockEventFor({ after, before, label: M, madeToOrder, threshold })

describe('stock alerts — what counts as news', () => {
  it('fires once, on the sale that takes a size to the low figure', () => {
    expect(event(4, 2)).toMatchObject({ kind: 'low', stock: 2 })
    expect(event(2, 1), 'already low: no second email').toBeNull()
    expect(event(6, 4), 'not yet low').toBeNull()
  })

  it('reports the last ready piece sold', () => {
    expect(event(1, 0)).toMatchObject({ kind: 'soldOut', stock: 0 })
    expect(event(3, 0)).toMatchObject({ kind: 'soldOut' })
  })

  it('reports a sale beyond stock — the most serious event wins', () => {
    expect(event(1, -2)).toEqual({ beyond: 2, kind: 'beyond', label: M, madeToOrder: true, stock: 0 })
    expect(event(0, -1, false)).toMatchObject({ beyond: 1, kind: 'beyond', madeToOrder: false })
  })

  it('follows her threshold, including zero', () => {
    expect(event(6, 5, true, 5)).toMatchObject({ kind: 'low' })
    expect(event(2, 1, true, 0), 'a threshold of 0 never reports low').toBeNull()
  })
})

describe('stock alerts — her settings', () => {
  it('defaults to on, every event, the order-alert address, low at 2', () => {
    const s = stockAlertSettings({ contactEmail: 'info@plumpose.com', orderAlertEmail: 'orders@plumpose.com' })
    expect(s).toMatchObject({ enabled: true, recipient: 'orders@plumpose.com', threshold: 2 })
    expect([...s.kinds].sort()).toEqual(['beyond', 'low', 'soldOut'])
  })

  it('uses her own address and choices when she sets them', () => {
    const s = stockAlertSettings({
      alertLowStock: false,
      contactEmail: 'info@plumpose.com',
      lowStockThreshold: 4,
      stockAlertEmail: 'atelier@plumpose.com',
    })
    expect(s).toMatchObject({ recipient: 'atelier@plumpose.com', threshold: 4 })
    expect(s.kinds.has('low')).toBe(false)
    expect(s.kinds.has('soldOut')).toBe(true)
  })

  it('can be switched off entirely', () => {
    expect(stockAlertSettings({ stockAlertsEnabled: false }).enabled).toBe(false)
  })
})

describe('stock alerts — the email', () => {
  it('leads with an oversell, and says to contact the customer', () => {
    const email = buildStockAlert({
      adminUrl: 'http://localhost:3000/admin/collections/variants',
      events: [event(0, -1, false)!, event(4, 2)!],
      orderId: 141,
    })
    expect(email.subject).toBe(`Oversold: ${M}`)
    expect(email.html).toContain('OVERSOLD by 1. Contact the customer.')
    expect(email.html).toContain('order no. 141')
    expect(email.text).toContain('Site settings → Stock alerts')
  })

  it('reads as a quiet note when a size is merely running low', () => {
    const email = buildStockAlert({ adminUrl: 'x', events: [event(4, 2)!], orderId: 7 })
    expect(email.subject).toBe(`Running low: ${M}`)
    expect(email.html).toContain('2 left.')
  })
})
