import { request } from 'https'
import { IncomingMessage } from 'http'
import { json } from 'stream/consumers'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { timeout } from './base.js'

const apiBaseUrl = 'https://api.scratch.mit.edu'
const projectsBaseUrl = 'https://projects.scratch.mit.edu'

export type Author = {
  id: number
  username: string
  scratchteam: boolean
  history: {
    /** @example "1900-01-01T00:00:00.000Z" */
    joined: string
  }
  profile: {
    id: number
    images: unknown
  }
}

export type RemixTarget = unknown

export type ProjectMeta = {
  id: number
  title: string
  description: string
  instructions: string
  /** @example "visible" */
  visibility: string
  public: boolean
  comments_allowed: boolean
  is_published: boolean
  author: Author
  image: string
  /**
   * @example
   * ```json
   * {
   *   "282x218": "https://cdn2.scratch.mit.edu/get_image/project/1005635034_282x218.png?v=1739361892",
   *   "216x163": "https://cdn2.scratch.mit.edu/get_image/project/1005635034_216x163.png?v=1739361892"
   * }
   * ```
   */
  images: Record<string, string>
  history: {
    /** @example "2024-04-22T11:44:22.000Z" */
    created: string
    /** @example "2025-02-12T12:04:52.000Z" */
    modified: string
    /** @example "2024-04-22T23:14:08.000Z" */
    shared: string
  }
  stats: {
    views: number
    loves: number
    favorites: number
    remixes: number
  }
  remix: {
    parent: RemixTarget | null
    root: RemixTarget | null
  }
}

export type ProjectMetaWithToken = ProjectMeta & {
  project_token: string
}

export type Options = {
  method: string
  headers?: Record<string, string>
  body?: string
  sessionId?: string
}

export type ExploreOptions = {
  offset: number
  limit: number
  language?: 'en'
  mode: 'trending' | 'popular' | 'recent'
  q?: string
}

export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export class ScratchAPI {

  private lastRequestTime = 0
  private agent: HttpsProxyAgent<string> | undefined

  constructor(
    /** Proxy URL to use for requests, e.g., `http://127.0.0.1:8001` */
    proxyUrl: string = process.env.https_proxy || process.env.http_proxy || '',
    /** Min interval between requests in milliseconds */
    private minInterval = 5000,
  ) {
    if (proxyUrl !== '') this.agent = new HttpsProxyAgent(proxyUrl)
  }

  private async request(url: string, options: Options) {
    const wait = this.lastRequestTime + this.minInterval - Date.now()
    if (wait > 0) await timeout(wait)
    this.lastRequestTime = Date.now()

    const { method, headers, body, sessionId } = options
    console.debug(`[REQ] ${method} ${url}`)
    const requestOptions = {
      method,
      headers: {
        'Cookie': 'scratchcsrftoken=a; scratchlanguage=en;',
        'X-CSRFToken': 'a',
        'referer': 'https://scratch.mit.edu', // Required by Scratch servers,
        ...headers
      },
      agent: this.agent
    }

    if (body != null) requestOptions.headers['Content-Length'] = Buffer.byteLength(body)
    if (sessionId != null) requestOptions.headers['Cookie'] += ` scratchsessionsid=${sessionId};`

    return new Promise<IncomingMessage>((resolve, reject) => {
      const req = request(url, requestOptions, (res) => {
        if (res.statusCode == null) throw new Error('Response status code is missing')
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res)
        } else {
          reject(new APIError(res.statusCode, `Request failed with status ${res.statusCode}`))
        }
      })
      req.on('error', reject)
      if (body != null) req.write(body)
      req.end()
    })
  }

  private async requestJSON(url: string, options: Options): Promise<unknown> {
    const stream = await this.request(url, options)
    return json(stream)
  }

  private parseCookie(cookie: string) {
    const cookies = {}
    const each = cookie.split(';')
    let i = each.length
    while (i--) {
      if (each[i].indexOf('=') === -1) {
        continue
      }
      const pair = each[i].split('=')
      cookies[pair[0].trim()] = pair[1].trim()
    }
    return cookies
  }

  async getProjectMeta(projectId: number) {
    return this.requestJSON(`${apiBaseUrl}/projects/${projectId}`, { method: 'GET' }) as Promise<ProjectMetaWithToken>
  }

  async exploreProjects(options: ExploreOptions) {
    const { limit, offset, language = 'en', mode, q = '*' } = options;
    return this.requestJSON(`${apiBaseUrl}/explore/projects?limit=${limit}&offset=${offset}&language=${language}&mode=${mode}&q=${encodeURIComponent(q)}`, { method: 'GET' }) as Promise<ProjectMeta[]>
  }

  async getProjectFile(projectId: number, token: string) {
    token = encodeURIComponent(token)
    return this.request(`${projectsBaseUrl}/${projectId}?token=${token}`, { method: 'GET' })
  }
}

