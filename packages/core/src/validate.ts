import { readFileSync } from 'node:fs'
import path from 'node:path'
import Ajv, { type ValidateFunction } from 'ajv'
import { paths } from './registry.ts'

/**
 * The JSON Schema in schemas/ is the contract contributors read; this makes it
 * bite. The runner validates what an adapter returns before storing it, and
 * invalid output counts as a failed read: the previous value is kept and the
 * run reports the problem. TypeScript catches most shape errors at compile
 * time; the schema adds what types cannot say — `ok` needs a `url`, strings
 * are not empty, `extra` holds only known shapes.
 */
const record = JSON.parse(
  readFileSync(path.join(paths.root, 'schemas', 'protocol-record.schema.json'), 'utf8'),
) as { $id: string }

const ajv = new Ajv({ allErrors: true })
ajv.addSchema(record)

const feedData = ajv.compile({ $ref: `${record.$id}#/definitions/feedData` })
const metricData = ajv.compile({ $ref: `${record.$id}#/definitions/metricData` })

const problem = (check: ValidateFunction, data: unknown): string | null =>
  check(data) ? null : ajv.errorsText(check.errors, { dataVar: 'output', separator: '; ' })

/** The first problems with a stored feed cell, or null when it is valid. */
export const validateFeedData = (data: unknown): string | null => problem(feedData, data)

/** The first problems with a stored metric, or null when it is valid. */
export const validateMetricData = (data: unknown): string | null => problem(metricData, data)
