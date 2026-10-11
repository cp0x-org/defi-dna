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
import { protocols } from '../lib/registry.ts'

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

export const useProtocol = (id: string): Async<ProtocolDetail> =>
  useLoad(id, () => loadProtocol(id))

export const useChangelog = (): Async<Change[]> => useLoad('changelog', loadChangelog)

export const useMetrics = (): Async<MetricsFile> => useLoad('metrics', loadMetrics)

/**
 * Every protocol's record, for the dashboard's colours. A record that fails to
 * load leaves its row on the index's facts: neutral where data exists, grey where not.
 */
export const useRecords = (): Map<string, ProtocolDetail> | null => {
  const [records, setRecords] = useState<Map<string, ProtocolDetail> | null>(null)
  useEffect(() => {
    let live = true
    Promise.allSettled(protocols.map((protocol) => loadProtocol(protocol.id))).then((results) => {
      if (!live) return
      const loaded = new Map<string, ProtocolDetail>()
      results.forEach((result, k) => {
        const id = protocols[k]?.id
        if (id && result.status === 'fulfilled') loaded.set(id, result.value)
      })
      setRecords(loaded)
    })
    return () => {
      live = false
    }
  }, [])
  return records
}
