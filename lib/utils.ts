import { addMinutes, format, parse } from 'date-fns'

export const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export const DAY_INDEX_TO_JS: Record<number, number> = { 0: 6, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 }

export function minutesFromTime(value: string) {
  const [h, m] = value.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export function timeFromMinutes(total: number) {
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function prettyTime(value: string) {
  const d = parse(value.slice(0, 5), 'HH:mm', new Date())
  return format(d, 'h:mm a')
}

export function endTime(start: string, duration: number) {
  const d = parse(start.slice(0, 5), 'HH:mm', new Date())
  return format(addMinutes(d, duration), 'HH:mm')
}

export function currency(n: number) {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(n)
}
