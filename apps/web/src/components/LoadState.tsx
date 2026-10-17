import type { ReactNode } from 'react'

/**
 * What stands in for content that has not arrived: a loading line, or a
 * failure with a retry. A failure always says that it is ours, so the empty
 * space is never read as "nothing there".
 */
export const LoadState = ({
  error,
  onRetry,
  failed,
  loading,
  children,
  help,
}: {
  error: string | null
  onRetry: () => void
  /** Heading of the failure. */
  failed: string
  /** Heading while loading; just the loading line without one. */
  loading?: string
  /** Why the space stays empty, under the failure heading. */
  children?: ReactNode
  /** More, under the technical details. */
  help?: ReactNode
}) =>
  error ? (
    <div className="empty-state" role="alert">
      <h3>{failed}</h3>
      {children ? <p>{children}</p> : null}
      <button className="button primary" type="button" onClick={onRetry}>
        Try again
      </button>
      <details>
        <summary>Technical details</summary>
        <p>{error}</p>
        {help}
      </details>
    </div>
  ) : (
    <div className="empty-state" role="status">
      {loading ? <h3>{loading}</h3> : null}
      <div className="loading-track" />
    </div>
  )
