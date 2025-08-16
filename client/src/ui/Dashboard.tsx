import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Bar } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement)

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<{ income: Record<string, number>, expense: Record<string, number> }>({ income: {}, expense: {} })

  const load = async () => {
    try {
      const res = await axios.get('/api/summary', { params: { period: 'month' } })
      // Normalize response
      setData(res.data || { income: {}, expense: {} })
    } catch (e) {
      setData({ income: {}, expense: {} })
    }
  }

  useEffect(() => { load() }, [])

  const labels = useMemo(() => {
    const keys = Array.from(new Set([...Object.keys(data.income), ...Object.keys(data.expense)]))
    return keys.sort()
  }, [data])

  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Income',
        data: labels.map(l => data.income[l] || 0),
        backgroundColor: 'rgba(22, 163, 74, 0.6)',
        borderColor: '#16a34a',
        borderWidth: 1,
        borderRadius: 8,
        stack: 'total',
      },
      {
        label: 'Expense',
        data: labels.map(l => data.expense[l] || 0),
        backgroundColor: 'rgba(220, 38, 38, 0.6)',
        borderColor: '#dc2626',
        borderWidth: 1,
        borderRadius: 8,
        stack: 'total',
      },
    ]
  }), [labels, data])

  const options = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#e5ecff' } },
      title: { display: false },
      tooltip: { mode: 'index', intersect: false },
    },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.15)' } },
      y: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } },
    },
    animation: { duration: 900, easing: 'easeOutQuart' },
  }), [])

  return (
    <div>
      <Bar data={chartData} options={options} />
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>Monthly Income vs Expense (Stacked)</div>
    </div>
  )
}
