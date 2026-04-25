import { useState, useMemo } from 'react'

type SortDir = 'asc' | 'desc' | null

export function useSort<T>(data: T[], defaultKey?: keyof T, defaultDir: SortDir = 'desc') {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultKey ?? null)
  const [sortDir, setSortDir] = useState<SortDir>(defaultKey ? defaultDir : null)

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data  // original order
    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1   // nulls always last
      if (bVal == null) return -1  // nulls always last
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      const cmp = aStr.localeCompare(bStr)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  const handleSort = (key: keyof T) => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('desc')
    } else if (sortDir === 'desc') {
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortKey(null)
      setSortDir(null)
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return { sorted, sortKey, sortDir, handleSort }
}
