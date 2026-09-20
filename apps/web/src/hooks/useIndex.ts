import { useEffect, useState } from 'react'
import {
  loadChangelog,
  loadIndex,
  loadProtocol,
  type Change,
  type IndexBundle,
  type ProtocolRecord,
} from '@defi-dna/data'

export interface Async<T> {
  data: T | null
  error: string | null
}

/** Load once per key; the data is a static snapshot, so there is nothing to refetch. */
function useLoad<T>(key: string, load: () => Promise<T>): Async<T> {
  const [state, setState] = useState<Async<T>>({ data: null, error: null })
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
  }, [key])
  return state
}

export const useIndex = (): Async<IndexBundle> => useLoad('index', loadIndex)

export const useProtocol = (id: string): Async<ProtocolRecord> =>
  useLoad(id, () => loadProtocol(id))

export const useChangelog = (): Async<Change[]> => useLoad('changelog', loadChangelog)
