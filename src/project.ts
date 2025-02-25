import { join } from 'node:path'
import { Readable } from 'node:stream'
import { createWriteStream } from 'node:fs'
import { finished } from 'node:stream/promises'
import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { storagePath } from './base.js'
import { ScratchAPI } from './api.js'

export interface File {
  name: string
  assetId: string
  dataFormat: string
  md5ext?: string
}

export type Costume = File & {
  rotationCenterX: number
  rotationCenterY: number
  bitmapResolution: number
}

export type Sound = File & {
  rate: number
  sampleCount: number
}

export type Block = {
  opcode?: string
  next: string | null
  parent: string | null
  inputs: Record<string, unknown>
  fields: Record<string, unknown>
  shadow: boolean
  topLevel: boolean
}

export type Target = {
  isStage: boolean
  name: string
  variables: unknown
  lists: unknown
  broadcasts: unknown
  blocks: Record<string, Block>
  comments: unknown
  currentCostume: number
  costumes: Costume[]
  sounds: Sound[]
}

export type Monitor = unknown

export type Extension = unknown

export type Meta = {
  semver: string
  vm: string
  agent: string
}

export interface ProjectData {
  targets: Target[]
  monitors: Monitor[]
  extensions: Extension[]
  meta: Meta
}

const projectsStoragePath = join(storagePath, 'projects')

async function ensureProjectsStoragePath() {
  try {
    await stat(projectsStoragePath)
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      await mkdir(projectsStoragePath, { recursive: true })
    } else {
      throw e
    }
  }
}

async function saveProjectFile(projectId: number, readable: Readable) {
  await ensureProjectsStoragePath()
  const filePath = join(projectsStoragePath, `${projectId}.sb3`)
  const writable = createWriteStream(filePath)
  await finished(readable.pipe(writable))
}

async function existsProjectFile(projectId: number) {
  await ensureProjectsStoragePath()
  const filePath = join(projectsStoragePath, `${projectId}.sb3`)
  try {
    const fstat = await stat(filePath)
    return fstat.isFile()
  } catch (e) {
    if (e && e.code === 'ENOENT') return false
    throw e
  }
}

export async function readProjectFile(projectId: number) {
  await ensureProjectsStoragePath()
  const filePath = join(projectsStoragePath, `${projectId}.sb3`)
  const content = await readFile(filePath, 'utf-8')
  return JSON.parse(content) as ProjectData
}

export async function listProjectByFiles() {
  await ensureProjectsStoragePath()
  const files = await readdir(projectsStoragePath)
  return files
    .filter(file => file.endsWith('.sb3'))
    .map(file => parseInt(file.replace('.sb3', ''), 10))
    .filter(id => !Number.isNaN(id))
}

export async function downloadProject(api: ScratchAPI, projectId: number) {
  if (await existsProjectFile(projectId)) {
    console.log(`Project ${projectId} already downloaded`)
    return
  }
  const meta = await api.getProjectMeta(projectId)
  const fileResp = await api.getProjectFile(projectId, meta.project_token)
  await saveProjectFile(projectId, fileResp)
}
