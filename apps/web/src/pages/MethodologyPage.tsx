import { Link } from 'react-router-dom'
import type { IndexBundle } from '@defi-dna/data'
import { feeds } from '../lib/registry.ts'
import { coverageLabel } from '../lib/view.ts'
import { IconArrow, IconChevron } from '../components/Icons.tsx'
import { ExternalLink } from '../components/UI.tsx'

const REPO = 'https://github.com/cp0x-org/defi-dna'

const QUESTIONS: [string, string][] = [
  [
    'Does defi-dna tell me whether a protocol is safe?',
    'No. It collects what other people published and shows it side by side. There is no score, ranking or recommendation of ours anywhere on the site, and a good value from one feed removes none of the smart-contract, governance, market or operational risk.',
  ],
  [
    'Why does the dashboard show only a dot?',
    'Because the feeds do not measure the same thing. DeFiScan grades a protocol’s decentralization, Philidor grades the individual vaults inside a protocol, Risklayer publishes a beta figure on bands it does not document — and a feed does not always say which slice of a protocol it looked at. A shared column of values would invite a comparison none of them supports, so the dashboard reports only whether data exists.',
  ],
  [
    'Where are the actual values then?',
    'On the protocol page. Each feed gets a card with its value exactly as published, its own words, the date it published, a link to the page we read, and the raw record we stored — so you can see everything, not only what we chose to display.',
  ],
  [
    'What do the three states mean?',
    '“Data available” means the feed publishes something we could collect. “No data” means it publishes nothing we could map to this protocol. “Collection error” means our pipeline failed — kept separate on purpose, because presenting our failure as the feed not covering something would put words in their mouth.',
  ],
  [
    'What happens when a feed is unreachable?',
    'The previous run’s value is kept, so one bad response never empties a cell that is genuinely covered. Every card shows both dates: when the feed published, and when we last read it.',
  ],
  [
    'Why are some dates amber?',
    'Amber marks a feed-published date more than 90 days old. It is a prompt to check the source, not an expiry. A freshly fetched cell can still carry an old assessment — the fetch date and the assessment date are different facts, and both are on the card.',
  ],
  [
    'Is the data live?',
    'The site reads a generated snapshot, committed to the repository on every refresh. That is what makes a value auditable later, even after a feed edits its own page.',
  ],
]

export const MethodologyPage = ({ index }: { index: IndexBundle }) => (
  <>
    <section className="page-intro">
      <span className="eyebrow">THE READING GUIDE</span>
      <h1>
        More context.
        <br />
        <span>Better questions.</span>
      </h1>
      <p>
        This site aggregates published risk assessments. It does not produce them. Every value on a
        protocol page was written by the feed named above it, and links back to where they published
        it.
      </p>
    </section>

    <div className="guide-steps">
      <article>
        <span className="step-number">01</span>
        <h2>Find the protocol</h2>
        <p>
          Rows are protocols on Ethereum mainnet. TVL gives size context; the number of feeds tells
          you how much has been collected, not how safe anything is.
        </p>
        <Link to="/" className="text-link">
          Open the matrix <IconArrow />
        </Link>
      </article>
      <article>
        <span className="step-number">02</span>
        <h2>Open it and read</h2>
        <p>
          Each card is one feed’s own value and words. Where two feeds disagree, both stay on the
          page: reconciling them would mean picking a winner.
        </p>
        <Link to="/sources" className="text-link">
          Meet the {feeds.length} feeds <IconArrow />
        </Link>
      </article>
      <article>
        <span className="step-number">03</span>
        <h2>Follow the source</h2>
        <p>
          Check the scope, check the date, then open the feed’s own page. A value nobody can check
          is not evidence, so every card carries the link we read.
        </p>
        <a href="#faq" className="text-link">
          Understand the labels <IconArrow />
        </a>
      </article>
    </div>

    <section className="principles-strip">
      <div>
        <span className="eyebrow">THE RULE THAT SHAPES EVERYTHING</span>
        <h2>
          No composite scoring.
          <br />
          Ever.
        </h2>
      </div>
      <p>
        We compute no rating, index, ranking or weighted average across feeds, and we never decide
        which feed is right when two disagree. Measured quantities (TVL, incident counts) and facts
        about our own coverage are not the same thing: they are published by their sources or
        describe this project. Relaxing this rule requires written agreement from the Ethereum
        Foundation and an amendment to the charter in the repository.
      </p>
    </section>

    <section style={{ marginTop: 44 }}>
      <div className="section-heading">
        <div>
          <h2>How a cell is produced</h2>
          <p>Three steps, and nothing of ours in between.</p>
        </div>
      </div>
      <div className="guide-steps">
        <article>
          <h2>Mapped</h2>
          <p>
            An adapter maps our protocol id to the feed’s own id. If the feed has no such entry, the
            adapter returns nothing and the cell stays grey — a gap, not a failure.
          </p>
        </article>
        <article>
          <h2>Quoted</h2>
          <p>
            The value is stored as a string, exactly as published: <code>Stage 1</code>,{' '}
            <code>4.8/10 · medium</code>, <code>82 vaults rated</code>. Never restated in our
            vocabulary, never converted into another feed’s units.
          </p>
        </article>
        <article>
          <h2>Sourced</h2>
          <p>
            Every value carries the feed’s own date, the date we read it and the link we read it
            from, plus the raw record behind the card.
          </p>
        </article>
      </div>
    </section>

    <section style={{ marginTop: 40 }}>
      <div className="section-heading">
        <div>
          <h2>The three states</h2>
          <p>The difference between them matters.</p>
        </div>
      </div>
      <div className="feed-chip-row">
        <span className="coverage-badge status-ok">{coverageLabel('ok')}</span>
        <span className="muted small">
          the feed publishes something about this protocol and we collected it
        </span>
      </div>
      <div className="feed-chip-row">
        <span className="coverage-badge status-none">{coverageLabel('none')}</span>
        <span className="muted small">
          the feed publishes nothing we could map to this protocol
        </span>
      </div>
      <div className="feed-chip-row">
        <span className="coverage-badge status-error">{coverageLabel('error')}</span>
        <span className="muted small">
          our pipeline failed — never presented as the feed not covering it
        </span>
      </div>
    </section>

    <section style={{ marginTop: 44 }}>
      <div className="section-heading">
        <div>
          <h2>Feed registry</h2>
          <p>What each column is, and how much of the list it covers.</p>
        </div>
      </div>
      <div className="table-card">
        <div className="matrix-scroll">
          <table className="registry-table">
            <thead>
              <tr>
                <th scope="col">Feed</th>
                <th scope="col">Assesses</th>
                <th scope="col">What it publishes</th>
                <th scope="col">Coverage here</th>
              </tr>
            </thead>
            <tbody>
              {feeds.map((feed) => (
                <tr key={feed.id}>
                  <td>
                    <ExternalLink href={feed.homepage}>{feed.name}</ExternalLink>
                  </td>
                  <td className="muted">{feed.topic}</td>
                  <td>{feed.focus}</td>
                  <td className="mono">
                    {index.rows.filter((row) => row.feeds[feed.id]).length} / {index.rows.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section id="faq" className="faq-section" tabIndex={-1}>
      <div className="section-heading">
        <div>
          <h2>A few useful answers</h2>
          <p>The details, when you need them.</p>
        </div>
      </div>
      <div className="faq-list">
        {QUESTIONS.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <IconChevron />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>

    <section id="contribute" className="contribute-panel" tabIndex={-1}>
      <div>
        <span className="eyebrow">OPEN DATA, SHARED RESPONSIBILITY</span>
        <h2>Corrections are pull requests.</h2>
        <p>
          Everything on this page comes from plain JSON in a public AGPL-3.0 repository, and every
          refresh is committed — so the history of a value survives a feed editing its own page.
        </p>
      </div>
      <ExternalLink className="button secondary" href={REPO}>
        Contribute on GitHub
      </ExternalLink>
      <details className="contribute-details">
        <summary>
          For data contributors
          <IconChevron />
        </summary>
        <p>
          Protocols live in <code>registry/protocols.json</code>. A feed describes itself in{' '}
          <code>adapters/feeds/&lt;feed&gt;/feed.json</code> and maps our protocol ids to its own in{' '}
          <code>mapping.json</code> — one id per line, nothing else. A protocol a feed does not
          cover is simply absent from that mapping.
        </p>
      </details>
    </section>
  </>
)
