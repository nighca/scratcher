import { APIError, ScratchAPI } from './api.js'
import { timeout } from './base.js'
import { readPopularProjects, writePopularProjects } from './popular.js'

async function listPopularProjects(api: ScratchAPI, count: number, startOffset?: number) {
  const popular = await readPopularProjects()
  const step = 16
  const set = new Set(popular.projectIds)
  console.log(`[LOADED] ${popular.projectIds.length} projects, now at ${popular.projectIds.length}/${count}`)
  for (let offset = startOffset ?? popular.projectIds.length; ;) {
    offset -= offset % step // cache-friendly
    try {
      const list = await api.exploreProjects({
        offset,
        limit: step,
        mode: 'popular'
      })
      if (list.length === 0) {
        console.warn('No more projects to fetch, stopping')
        break
      }
      for (const p of list) {
        if (set.has(p.id)) continue
        set.add(p.id)
        popular.projectIds.push(p.id)
      }
      offset += step
      console.info(`[FETCHED] ${list.length} projects, now at ${popular.projectIds.length}/${count}`)
      await writePopularProjects(popular)
      if (popular.projectIds.length >= count) break
      await new Promise(resolve => setTimeout(resolve, 5000))
    } catch (e) {
      if (e instanceof APIError) {
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
      console.error('[ERR] Failed to fetch popular projects:', e)
      await timeout(60000)
      continue
    }
  }
}

(async function main() {
  const api = new ScratchAPI()
  await listPopularProjects(api, 10000, 3000)
  console.log('[DONE]')
})()
