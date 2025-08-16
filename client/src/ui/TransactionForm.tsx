import React from 'react'
import { useForm } from 'react-hook-form'
import axios from 'axios'

export type TxForm = {
  date: string
  category: string
  type: 'income' | 'expense'
  amount: number
  notes?: string
}

export const TransactionForm: React.FC = () => {
  const { register, handleSubmit, reset } = useForm<TxForm>({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      type: 'expense',
    },
  })

  const onSubmit = async (data: TxForm) => {
    await axios.post('/api/transactions', { ...data, amount: Number(data.amount) })
    reset({ date: new Date().toISOString().slice(0, 10), type: 'expense', category: '', amount: 0, notes: '' })
    setTimeout(() => window.dispatchEvent(new CustomEvent('tx:refresh')), 0)
  }

  const input = { padding: 8, border: '1px solid #ddd', borderRadius: 6 }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gap: 8 }}>
      <label>
        <div>Date</div>
        <input type="date" {...register('date', { required: true })} style={input} />
      </label>
      <label>
        <div>Category</div>
        <input type="text" placeholder="e.g., Groceries" {...register('category', { required: true })} style={input} />
      </label>
      <label>
        <div>Type</div>
        <select {...register('type', { required: true })} style={input as any}>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </label>
      <label>
        <div>Amount</div>
        <input type="number" step="0.01" {...register('amount', { required: true, valueAsNumber: true })} style={input} />
      </label>
      <label>
        <div>Notes</div>
        <input type="text" placeholder="optional" {...register('notes')} style={input} />
      </label>
      <button type="submit" style={{ ...input, cursor: 'pointer', background: '#2563eb', color: 'white' }}>Add</button>
    </form>
  )
}
