/**
 * @file count-version.ts
 * @desc Count Scratch versions in projects
 */

import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { storagePath } from './base.js'
import { listProjectByFiles, readProjectFile } from './project.js'

type VersionCount = {
  count: number
  projects: number[]
}

type VersionCounts = {
  semver: Map<string, VersionCount>
  vm: Map<string, VersionCount>
  agent: Map<string, VersionCount>
  total: number
}

async function countProjectVersion(projectId: number, counts: VersionCounts) {
  const project = await readProjectFile(projectId)
  
  if (!project.meta) {
    console.warn(`Project ${projectId} has no meta information`)
    return
  }

  // Count semver
  if (project.meta.semver) {
    let semverCount = counts.semver.get(project.meta.semver)
    if (semverCount == null) {
      semverCount = { count: 0, projects: [] }
      counts.semver.set(project.meta.semver, semverCount)
    }
    semverCount.count++
    semverCount.projects.push(projectId)
  }

  // Count vm version
  if (project.meta.vm) {
    let vmCount = counts.vm.get(project.meta.vm)
    if (vmCount == null) {
      vmCount = { count: 0, projects: [] }
      counts.vm.set(project.meta.vm, vmCount)
    }
    vmCount.count++
    vmCount.projects.push(projectId)
  }

  // Count agent
  if (project.meta.agent) {
    let agentCount = counts.agent.get(project.meta.agent)
    if (agentCount == null) {
      agentCount = { count: 0, projects: [] }
      counts.agent.set(project.meta.agent, agentCount)
    }
    agentCount.count++
    agentCount.projects.push(projectId)
  }

  counts.total++
}

async function countVersionsByProjectIds(ids: number[]) {
  const counts: VersionCounts = {
    semver: new Map(),
    vm: new Map(),
    agent: new Map(),
    total: 0
  }
  
  for (const id of ids) {
    try {
      await countProjectVersion(id, counts)
    } catch (error) {
      console.error(`Error processing project ${id}:`, error)
    }
  }
  
  return counts
}

const versionCountsStoragePath = join(storagePath, 'version-counts.json')

async function countAllVersions() {
  const projectIds = await listProjectByFiles()
  const counts = await countVersionsByProjectIds(projectIds)

  // Convert Maps to sorted arrays for JSON serialization
  const semverCounts = Array.from(counts.semver.entries())
    .map(([version, data]) => ({
      version,
      count: data.count,
      percentage: (data.count / counts.total * 100).toFixed(2) + '%'
    }))
    .sort((a, b) => b.count - a.count)

  const vmCounts = Array.from(counts.vm.entries())
    .map(([version, data]) => ({
      version,
      count: data.count,
      percentage: (data.count / counts.total * 100).toFixed(2) + '%'
    }))
    .sort((a, b) => b.count - a.count)

  const agentCounts = Array.from(counts.agent.entries())
    .map(([version, data]) => ({
      version,
      count: data.count,
      percentage: (data.count / counts.total * 100).toFixed(2) + '%'
    }))
    .sort((a, b) => b.count - a.count)

  const result = {
    totalProjects: counts.total,
    semverVersions: semverCounts,
    vmVersions: vmCounts,
    agentVersions: agentCounts,
    countAt: new Date().toISOString()
  }

  await writeFile(versionCountsStoragePath, JSON.stringify(result, null, 2))
  console.log(`Version statistics saved to ${versionCountsStoragePath}`)
}

function byCount(a: { count: number }, b: { count: number }) {
  return b.count - a.count
}

(async function main() {
  console.log('Counting Scratch versions across projects...')
  await countAllVersions()
  console.log('[DONE] Version count complete')
})()