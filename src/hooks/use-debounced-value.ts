import { useEffect, useState } from 'react'

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` ms
 * of no changes. Useful for search inputs to avoid spamming URL updates or
 * heavy re-renders on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 150): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])

  return debounced
}
