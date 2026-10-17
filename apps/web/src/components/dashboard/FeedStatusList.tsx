import type { Feed } from '@defi-dna/data'
import { TONE_LABELS, type Tone } from '../../lib/status.ts'
import { StatusDot } from '../Coverage.tsx'

/** One row per feed: its name and the reading its own scale gives. */
export const FeedStatusList = ({
  feeds,
  tones,
}: {
  feeds: Feed[]
  tones: Record<string, Tone>
}) => (
  <ul className="pop-list">
    {feeds.map((feed) => {
      const tone = tones[feed.id] ?? 'none'
      return (
        <li key={feed.id} className={`st-${tone}`}>
          <StatusDot tone={tone} />
          <span>{feed.name}</span>
          <em>{TONE_LABELS[tone]}</em>
        </li>
      )
    })}
  </ul>
)
