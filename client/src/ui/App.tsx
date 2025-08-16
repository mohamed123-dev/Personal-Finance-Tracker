import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { TransactionForm } from './TransactionForm'
import { TransactionList } from './TransactionList'
import { Dashboard } from './Dashboard'
import { Auth } from './Auth'
import { getAuth, setAuth, clearAuth, subscribe } from './store'
import { motion, AnimatePresence } from 'framer-motion'

export const App: React.FC = () => {
  const [, setTick] = useState(0)
  useEffect(() => subscribe(() => setTick(t => t + 1)), [])
  const auth = getAuth()
  // Ensure Authorization header is set before children make requests
  if (auth.token) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${auth.token}`
  } else {
    delete axios.defaults.headers.common["Authorization"]
  }
  useEffect(() => {
    const id = axios.interceptors.request.use(config => {
      const current = getAuth()
      if (current.token) {
        config.headers = config.headers || {}
        ;(config.headers as any)["Authorization"] = `Bearer ${current.token}`
      }
      return config
    })
    return () => axios.interceptors.request.eject(id)
  }, [])

  if (!auth.token) {
    return <Auth onAuthed={(token, user) => { setAuth(token, user); window.location.reload() }} />
  }

  return (
    <div className="container" style={{ fontFamily: 'system-ui, Arial' }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'linear-gradient(90deg, rgba(79,70,229,.15), transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 18px var(--primary)' }} />
          <h1 style={{ margin: 0, letterSpacing: .2 }}>Personal Finance Tracker</h1>
        </div>
        <div>
          <span style={{ marginRight: 12, color: 'var(--muted)' }}>{auth.user?.email}</span>
          <button className="btn secondary" onClick={() => { clearAuth(); window.location.reload() }}>Logout</button>
        </div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <AnimatePresence>
          <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <h2 style={{ marginTop: 0 }}>Add Transaction</h2>
            <TransactionForm />
          </motion.div>
          <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <h2 style={{ marginTop: 0 }}>Dashboard</h2>
            <Dashboard />
          </motion.div>
        </AnimatePresence>
      </div>

      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Transactions</h2>
        <TransactionList />
      </motion.div>
    </div>
  )
}
