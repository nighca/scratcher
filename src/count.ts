/**
 * @file count.ts
 * @desc Count blocks in projects
 */

import { join } from 'node:path'
import { storagePath } from './base.js'
import { listProjectByFiles, readProjectFile } from './project.js'
import { writeFile } from 'node:fs/promises'

/** Map from block opcode to count */
type OpcodeCounts = Map<string, number>

async function countProject(projectId: number, counts: OpcodeCounts) {
  const project = await readProjectFile(projectId)
  for (const target of project.targets) {
    for (const block of Object.values(target.blocks)) {
      if (block.opcode == null) continue
      counts.set(block.opcode, (counts.get(block.opcode) ?? 0) + 1)
    }
  }
}

async function countByProjectIds(ids: number[]) {
  const counted = new Map<string, number>()
  for (const id of ids) {
    await countProject(id, counted)
  }
  return counted
}

const countAllStoragePath = join(storagePath, 'counts.json')

async function countAll() {
  const projectIds = await listProjectByFiles()
  const counts = await countByProjectIds(projectIds)
  const opcodeAndCounts = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  const totalCount = opcodeAndCounts.reduce((sum, [_, count]) => sum + count, 0)
  const countsByOpcodeType = new Map<string, number>()
  for (const [opcode, count] of opcodeAndCounts) {
    const type = opcode.split('_')[0]
    countsByOpcodeType.set(type, (countsByOpcodeType.get(type) ?? 0) + count)
  }
  const opcodeTypeAndCounts = Array.from(countsByOpcodeType.entries()).sort((a, b) => b[1] - a[1])
  const result = {
    projectNum: projectIds.length,
    totalBlockNum: totalCount,
    byOpcode: opcodeAndCounts.map(([opcode, count]) => ({ opcode, count, percent: count / totalCount })),
    byOpcodeType: opcodeTypeAndCounts.map(([type, count]) => ({ type, count, percent: count / totalCount }))
  }
  await writeFile(countAllStoragePath, JSON.stringify(result, null, 2))
}

(async function main() {
  await countAll()
  console.log('[DONE]')
})()

