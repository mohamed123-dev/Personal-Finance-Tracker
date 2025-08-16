import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'

export type Tx = {
  id: number
  date: string
  category: string
  type: 'income' | 'expense'
  amount: number
  notes?: string
}

export const TransactionList: React.FC = () => {
  const [items, setItems] = useState<Tx[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
  const res = await axios.get<Tx[]>('/api/transactions')
  const data = Array.isArray(res.data) ? res.data : []
  setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const handler = () => load()
    window.addEventListener('tx:refresh', handler as any)
    return () => window.removeEventListener('tx:refresh', handler as any)
  }, [])

  const del = async (id: number) => {
    await axios.delete(`/api/transactions/${id}`)
    load()
  }

  return (
    <div>
      {loading && <div style={{ color: 'var(--muted)' }}>Loading…</div>}
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Date</th>
            <th style={{ textAlign: 'left' }}>Category</th>
            <th style={{ textAlign: 'left' }}>Type</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
            <th style={{ textAlign: 'left' }}>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {items.map(tx => (
              <motion.tr key={tx.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <td>{tx.date}</td>
                <td>{tx.category}</td>
                <td>{tx.type}</td>
                <td style={{ textAlign: 'right' }} className={tx.type === 'expense' ? 'amount-expense' : 'amount-income'}>
                  {tx.type === 'expense' ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                </td>
                <td>{tx.notes}</td>
                <td><button className="btn secondary" onClick={() => del(tx.id)}>Delete</button></td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  )
}
