import { APIError, ScratchAPI } from './api.js'
import { timeout } from './base.js'
import { readPopularProjects } from './popular.js'
import { downloadProject } from './project.js'

async function downloadProjectsById(api: ScratchAPI, projectIds: number[]) {
  for (const projectId of projectIds) {
    try {
      await downloadProject(api, projectId)
    } catch (e) {
      if (e instanceof APIError) {
        if (e.status === 404) {
          console.warn(`[ERR] Project ${projectId} not found`)
          continue
        }
        if (e.status === 429) {
          console.warn('[ERR] Rate limited, waiting...')
          await timeout(30000)
          continue
        }
        if (e.status === 503) {
          console.warn('[ERR] Service unavailable, waiting...')
          await timeout(30000)
          continue
        }
      }
      console.error(`[ERR] Failed to download project ${projectId}:`, e)
      await timeout(60000)
      continue
    }
  }
}

async function downloadPopularProjects(api: ScratchAPI) {
  const popular = await readPopularProjects()
  await downloadProjectsById(api, popular.projectIds)
}

(async function main() {
  const api = new ScratchAPI()
  await downloadPopularProjects(api)
  // const ids = Array.from({ length: 10 }, (_, i) => i + 1100000000)
  // await downloadProjectsById(api, ids)
  console.log('[DONE]')
})()
