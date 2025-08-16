import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { motion } from 'framer-motion'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement)

export const Charts: React.FC = () => {
  const [summary, setSummary] = useState<{ income: Record<string, number>, expense: Record<string, number> }>({ income: {}, expense: {} })
  useEffect(() => { axios.get('/api/summary', { params: { period: 'month' } }).then(r => setSummary(r.data)) }, [])

  const labels = useMemo(() => Array.from(new Set([...Object.keys(summary.income), ...Object.keys(summary.expense)])).sort(), [summary])
  const totalIncome = labels.reduce((s, l) => s + (summary.income[l] || 0), 0)
  const totalExpense = labels.reduce((s, l) => s + (summary.expense[l] || 0), 0)

  const chartData = {
    labels,
    datasets: [
      { label: 'Income', data: labels.map(l => summary.income[l] || 0), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.2)' },
      { label: 'Expense', data: labels.map(l => summary.expense[l] || 0), borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,.2)' },
    ]
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: '#475569' }}>Total Income</div>
          <div style={{ fontSize: 28, color: '#16a34a' }}>${totalIncome.toFixed(2)}</div>
        </div>
        <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: '#475569' }}>Total Expense</div>
          <div style={{ fontSize: 28, color: '#dc2626' }}>${totalExpense.toFixed(2)}</div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <Line data={chartData} options={{ responsive: true, plugins: { legend: { position: 'bottom' as const } } }} />
      </div>
    </motion.div>
  )
}
