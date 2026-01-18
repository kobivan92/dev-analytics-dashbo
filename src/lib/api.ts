import type { Repository } from './types'

interface SCMConfig {
  baseUrl: string
  token?: string
  username?: string
  password?: string
  reposPath: string
}

function getEnv(name: string): string | undefined {
  // Vite exposes env vars prefixed with VITE_
  // @ts-ignore
  return typeof import.meta !== 'undefined' ? (import.meta as any).env?.[name] : undefined
}

export function getSCMConfig(): SCMConfig {
  const baseUrl = getEnv('VITE_SCM_BASE_URL') || ''
  const token = getEnv('VITE_SCM_TOKEN')
  const username = getEnv('VITE_SCM_USERNAME')
  const password = getEnv('VITE_SCM_PASSWORD')
  const reposPath = getEnv('VITE_SCM_REPOS_PATH') || '/scm/api/v2/repositories'
  return { baseUrl, token, username, password, reposPath }
}

function buildAuthHeaders(cfg: SCMConfig): HeadersInit {
  const headers: HeadersInit = { 'Accept': 'application/json' }
  if (cfg.token) {
    headers['Authorization'] = `Bearer ${cfg.token}`
  } else if (cfg.username && cfg.password) {
    const encoded = btoa(`${cfg.username}:${cfg.password}`)
    headers['Authorization'] = `Basic ${encoded}`
  }
  return headers
}

function normalizeRepo(input: any): Repository & { _raw?: any } {
  const name: string = input?.name || input?.slug || 'unknown-repo'
  const id: string = String(input?.id ?? name)
  const description: string = input?.description || ''
  const primaryLanguage: string = input?.language || input?.primary_language || 'Unknown'
  const lastActivity: string = input?.updated_at || input?.pushed_at || new Date().toISOString()

  // Fallbacks for fields we might not have from the API yet
  const totalCommits: number = Number(input?.commits_count ?? 0)
  const contributors: number = Number(input?.contributors_count ?? input?.watchers_count ?? 0)
  const healthScore: number = Number(input?.health_score ?? 70)
  const topContributors: { developerId: string; commits: number }[] = Array.isArray(input?.top_contributors)
    ? input.top_contributors.map((c: any) => ({ developerId: String(c.id ?? c.name ?? 'unknown'), commits: Number(c.commits ?? 0) }))
    : []

  return {
    id,
    name,
    description,
    primaryLanguage,
    totalCommits,
    contributors,
    lastActivity,
    healthScore,
    topContributors,
    _raw: input,
  }
}

export async function fetchRepositories(): Promise<Repository[]> {
  const cfg = getSCMConfig()
  const dev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV
  const path = cfg.reposPath.replace(/\/+$/, '') + '/'
  const url = dev
    ? path
    : (cfg.baseUrl || '').replace(/\/$/, '') + path

  if (!dev && !cfg.baseUrl) throw new Error('SCM base URL not configured (VITE_SCM_BASE_URL)')

  const res = await fetch(url, { headers: dev ? {} : buildAuthHeaders(cfg) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to fetch repos: ${res.status} ${res.statusText} ${text}`)
  }

  const data = await res.json()
  // try common shapes
  const embedded = (data && (data._embedded?.repositories || data._embedded?.repos)) as any[] | undefined
  const list: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.repos)
    ? data.repos
    : Array.isArray(embedded)
    ? embedded
    : []
  return list.map(normalizeRepo)
}

async function fetchJson(url: string, headers?: HeadersInit) {
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText} ${text}`)
  }
  return res.json()
}

function buildChangesetsUrl(raw: any, baseUrl: string, pathPrefix: string, dev: boolean): string | null {
  const href = raw?._links?.changesets?.href || raw?._links?.commits?.href || raw?._links?.history?.href || null
  if (href) {
    if (dev) return href
    if (/^https?:\/\//.test(href)) return href
    return baseUrl.replace(/\/$/, '') + href
  }
  const ns = raw?.namespace || raw?.namespaceAndName?.namespace
  const name = raw?.name || raw?.namespaceAndName?.name
  if (ns && name) {
    const rel = `${pathPrefix.replace(/\/+$/, '')}/${encodeURIComponent(ns)}/${encodeURIComponent(name)}/changesets`
    return dev ? rel : baseUrl.replace(/\/$/, '') + rel
  }
  return null
}

export async function enrichRepositories(repos: (Repository & { _raw?: any })[]): Promise<Repository[]> {
  const cfg = getSCMConfig()
  const dev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV
  const prefix = (cfg.reposPath || '/scm/api/v2/repositories')
  const headers = dev ? {} : buildAuthHeaders(cfg)

  const enriched = await Promise.all(repos.map(async (r) => {
    try {
      const url = buildChangesetsUrl(r._raw, cfg.baseUrl || '', prefix, !!dev)
      if (!url) return r
      const data = await fetchJson(url + '?limit=200', headers)
      const changesets: any[] = (data?._embedded?.changesets) || (Array.isArray(data) ? data : [])
      if (!Array.isArray(changesets) || changesets.length === 0) return r
      const counts = new Map<string, { name: string; commits: number }>()
      for (const cs of changesets) {
        const authorName = cs?.author?.displayName || cs?.author?.name || cs?.author || 'Unknown'
        const key = String(authorName).toLowerCase()
        const cur = counts.get(key) || { name: authorName, commits: 0 }
        cur.commits += 1
        counts.set(key, cur)
      }
      const sorted = Array.from(counts.values()).sort((a, b) => b.commits - a.commits)
      const top = sorted.slice(0, 5).map(c => ({ developerId: c.name, commits: c.commits }))
      return { ...r, totalCommits: changesets.length, contributors: counts.size, topContributors: top }
    } catch (e) {
      console.warn('Failed to enrich repo', r.name, e)
      return r
    }
  }))
  return enriched
}
