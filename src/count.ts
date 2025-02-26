/**
 * @file count.ts
 * @desc Count blocks in projects
 */

import { join } from 'node:path'
import { storagePath } from './base.js'
import { listProjectByFiles, readProjectFile } from './project.js'
import { writeFile } from 'node:fs/promises'

type CountsForOpcode = {
  project: number
  block: number
}

type CountsForOpcodeType = {
  project: number
  block: number
  byOpcode: Map<string, CountsForOpcode>
}

type Counts = {
  project: number
  block: number
  byOpcodeType: Map<string, CountsForOpcodeType>
}

async function countProject(projectId: number, counts: Counts) {
  const project = await readProjectFile(projectId)
  const opcodeTypeSet = new Set<string>()
  const opcodeSet = new Set<string>()

  for (const target of project.targets) {
    for (const block of Object.values(target.blocks)) {
      if (block.opcode == null) continue

      counts.block++

      const opcode = block.opcode
      const type = block.opcode.split('_')[0]

      let typeCounts = counts.byOpcodeType.get(type)
      if (typeCounts == null) {
        typeCounts = { project: 0, block: 0, byOpcode: new Map() }
        counts.byOpcodeType.set(type, typeCounts)
      }
      typeCounts.block++
      opcodeTypeSet.add(type)

      let opcodeCounts = typeCounts.byOpcode.get(opcode)
      if (opcodeCounts == null) {
        opcodeCounts = { project: 0, block: 0 }
        typeCounts.byOpcode.set(opcode, opcodeCounts)
      }
      opcodeCounts.block++
      opcodeSet.add(block.opcode)
    }
  }

  counts.project++
  for (const type of opcodeTypeSet) {
    counts.byOpcodeType.get(type)!.project++
  }
  for (const opcode of opcodeSet) {
    counts.byOpcodeType.get(opcode.split('_')[0])!.byOpcode.get(opcode)!.project++
  }
}

async function countByProjectIds(ids: number[]) {
  const counts: Counts = {
    project: 0,
    block: 0,
    byOpcodeType: new Map()
  }
  for (const id of ids) {
    await countProject(id, counts)
  }
  return counts
}

const countAllStoragePath = join(storagePath, 'counts.json')

async function countAll() {

  const projectIds = await listProjectByFiles()
  const counts = await countByProjectIds(projectIds)

  const blockCounts = Array.from(counts.byOpcodeType.entries()).map(([type, counts]) => ({
    type,
    count: counts.block,
    children: Array.from(counts.byOpcode.entries()).map(([opcode, counts]) => ({
      opcode: opcode.slice(type.length + 1),
      count: counts.block
    })).sort(byCount)
  })).sort(byCount)

  const projectCounts = Array.from(counts.byOpcodeType.entries()).map(([type, counts]) => ({
    type,
    count: counts.project,
    children: Array.from(counts.byOpcode.entries()).map(([opcode, counts]) => ({
      opcode: opcode.slice(type.length + 1),
      count: counts.project
    })).sort(byCount)
  })).sort(byCount)

  const result = {
    projectNum: counts.project,
    blockNum: counts.block,
    blockCounts,
    projectCounts
  }
  await writeFile(countAllStoragePath, JSON.stringify(result, null, 2))
}

function byCount(a: { count: number }, b: { count: number }) {
  return b.count - a.count
}

(async function main() {
  await countAll()
  console.log('[DONE]')
})()
