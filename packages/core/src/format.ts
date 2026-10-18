/** Money and time formatting, shared by the adapters and the frontend. */
export function formatUsd(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

/**
 * A duration in seconds, in the unit a reader scans fastest: `45 s`, `12 h`,
 * `2 days`, `1.5 days`. Integer seconds in, no rounding that hides a value.
 */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null
  const unit = (amount: number, name: string) => {
    const shown = Number.isInteger(amount) ? String(amount) : amount.toFixed(1)
    return `${shown} ${name}${name === 'day' && shown !== '1' ? 's' : ''}`
  }
  if (seconds < 60) return unit(seconds, 's')
  if (seconds < 3600) return unit(seconds / 60, 'min')
  if (seconds < 86400) return unit(seconds / 3600, 'h')
  return unit(seconds / 86400, 'day')
}
