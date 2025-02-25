import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { storagePath } from './base.js'

const popularStoragePath = join(storagePath, 'popular.json')

type Popular = {
  projectIds: number[]
}

export async function readPopularProjects(): Promise<Popular> {
  try {
    const content = await readFile(popularStoragePath, 'utf-8')
    return JSON.parse(content) as Popular
  } catch (e) {
    if (e && e.code === 'ENOENT') return { projectIds: [] }
    throw e
  }
}

export async function writePopularProjects(popular: Popular) {
  await writeFile(popularStoragePath, JSON.stringify(popular, null, 2))
}
