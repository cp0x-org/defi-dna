import type { Detail, Feed } from '@defi-dna/data'
import { TONE_LABELS, detailToneOf } from '../../shared/lib/status.ts'
import { StatusDot } from '../../shared/ui/Coverage.tsx'

/**
 * A feed that grades the parts of its assessment on its own scale (DeFiPunk’d’s
 * slices) is read as colours, not colour words: one chip per part, coloured by
 * the feed's `detailStatus` rule, its full state in the title. Nothing for a
 * feed without such a rule, so the headline text stays.
 */
export const SliceChips = ({ feed, details }: { feed: Feed; details?: Detail[] }) =>
  feed.detailStatus && details && details.length > 0 ? (
    <span className="slices" aria-label={`${feed.name}’s grades`}>
      {details.map((detail) => {
        const tone = detailToneOf(feed, detail.value)
        return (
          <span
            key={detail.name}
            className={`pill ${tone ? `st-${tone}` : 'plain'}`}
            title={`${detail.value}${tone ? ` — ${TONE_LABELS[tone]} on ${feed.name}’s own scale` : ''}`}
          >
            <StatusDot tone={tone ?? 'none'} />
            {detail.name}
          </span>
        )
      })}
    </span>
  ) : null
