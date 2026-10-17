import { DAY, ageLabel, timeLabel } from '../../lib/view.ts'

/** How long since a feed's value last moved, or a dash while there is nothing to show. */
export const Fresh = ({
  changed,
  now,
  emptyTitle,
}: {
  changed: string | null
  now: number
  emptyTitle: string
}) => {
  const age = changed ? now - Date.parse(changed) : null
  return (
    <span
      className={`fresh${age != null && age <= DAY ? ' recent' : ''}${
        age != null && age > 30 * DAY ? ' stale' : ''
      }`}
      title={changed ? `Last change ${timeLabel(changed)}` : emptyTitle}
    >
      {ageLabel(changed, now) ?? '—'}
    </span>
  )
}
