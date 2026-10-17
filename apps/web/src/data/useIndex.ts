import { useEffect, useState } from 'react'
import {
  loadChangelog,
  loadIndex,
  loadMetrics,
  loadProtocol,
  type Change,
  type IndexBundle,
  type MetricsFile,
  type ProtocolDetail,
} from '@defi-dna/data'

export interface Async<T> {
  data: T | null
  error: string | null
  /** Ask again after a failure; the data client has forgotten the failed request. */
  retry: () => void
}

/** Load once per key; the data is a static snapshot, so there is nothing to refetch. */
function useLoad<T>(key: string, load: () => Promise<T>): Async<T> {
  const [state, setState] = useState<Pick<Async<T>, 'data' | 'error'>>({ data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    setState({ data: null, error: null })
    load().then(
      (data) => live && setState({ data, error: null }),
      (error: unknown) =>
        live &&
        setState({ data: null, error: error instanceof Error ? error.message : String(error) }),
    )
    return () => {
      live = false
    }
  }, [key, attempt])
  return { ...state, retry: () => setAttempt((count) => count + 1) }
}

export const useIndex = (): Async<IndexBundle> => useLoad('index', loadIndex)

export const useProtocol = (id: string): Async<ProtocolDetail> =>
  useLoad(id, () => loadProtocol(id))

export const useChangelog = (): Async<Change[]> => useLoad('changelog', loadChangelog)

export const useMetrics = (): Async<MetricsFile> => useLoad('metrics', loadMetrics)
