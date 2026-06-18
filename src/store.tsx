import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppData, Application, ApplicationStatus, Project, Role, ToolListing, User } from './types'
import { supabase } from './lib/supabase'
import { DEMO_PASSWORD } from './lib/constants'

export { DEMO_PASSWORD }

export type SignInResult = { ok: true; message?: string } | { ok: false; error: string }

export interface SignUpParams {
  email: string
  password: string
  name: string
}

export interface Toast {
  id: string
  kind: 'success' | 'info'
  message: string
}

export type Status = 'loading' | 'ready' | 'signedout'

interface Store {
  data: AppData
  currentUser: User
  authedUserId: string | null
  status: Status
  toasts: Toast[]
  signIn: (email: string, password: string) => Promise<SignInResult>
  signUp: (params: SignUpParams) => Promise<SignInResult>
  signOut: () => Promise<void>
  dismissToast: (id: string) => void
  notify: (message: string, kind?: Toast['kind']) => void
  addProject: (p: Omit<Project, 'id' | 'ownerId' | 'createdAt' | 'hue'>) => Project
  addTool: (t: Omit<ToolListing, 'id' | 'ownerId' | 'createdAt'>) => void
  removeTool: (toolId: string) => void
  apply: (projectId: string, roleId: string, message: string) => void
  withdraw: (applicationId: string) => void
  decideApplication: (applicationId: string, status: ApplicationStatus) => void
  updateProfile: (
    patch: Partial<
      Pick<User, 'name' | 'headline' | 'location' | 'bio' | 'skills' | 'interests' | 'school' | 'resume'>
    >,
  ) => void
}

const StoreContext = createContext<Store | null>(null)

const EMPTY_DATA: AppData = {
  currentUserId: '',
  users: [],
  projects: [],
  applications: [],
  tools: [],
}

let idCounter = 0
export function uid(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

// --- Row → app-model mapping -------------------------------------------------

type Row = Record<string, any>

function rowToUser(r: Row): User {
  return {
    id: r.id,
    name: r.name ?? '',
    email: r.email ?? '',
    headline: r.headline ?? '',
    location: r.location ?? '',
    bio: r.bio ?? '',
    skills: r.skills ?? [],
    interests: r.interests ?? undefined,
    school: r.school ?? undefined,
    resume: r.resume ?? undefined,
    hue: r.hue ?? 210,
  }
}

function rowToRole(r: Row): Role {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    skills: r.skills ?? [],
    slots: r.slots ?? 1,
    filledBy: r.filled_by ?? [],
    workMode: r.work_mode ?? 'remote',
  }
}

function rowToTool(r: Row): ToolListing {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    category: r.category,
    description: r.description ?? '',
    ratePerDay: Number(r.rate_per_day ?? 0),
    createdAt: Date.parse(r.created_at),
  }
}

function rowToApplication(r: Row): Application {
  return {
    id: r.id,
    projectId: r.project_id,
    roleId: r.role_id,
    userId: r.user_id,
    message: r.message ?? '',
    status: r.status,
    createdAt: Date.parse(r.created_at),
  }
}

function assembleProjects(projectRows: Row[], roleRows: Row[]): Project[] {
  const rolesByProject = new Map<string, Row[]>()
  for (const r of roleRows) {
    const list = rolesByProject.get(r.project_id) ?? []
    list.push(r)
    rolesByProject.set(r.project_id, list)
  }
  return projectRows.map((p) => ({
    id: p.id,
    ownerId: p.owner_id,
    title: p.title,
    tagline: p.tagline,
    description: p.description,
    category: p.category,
    tags: p.tags ?? [],
    roles: (rolesByProject.get(p.id) ?? [])
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map(rowToRole),
    createdAt: Date.parse(p.created_at),
    hue: p.hue ?? 210,
  }))
}

async function fetchAll(): Promise<Omit<AppData, 'currentUserId'>> {
  const [profiles, projects, roles, applications, tools] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('projects').select('*'),
    supabase.from('roles').select('*'),
    supabase.from('applications').select('*'),
    supabase.from('tools').select('*'),
  ])
  const firstError =
    profiles.error || projects.error || roles.error || applications.error || tools.error
  if (firstError) throw firstError

  return {
    users: (profiles.data ?? []).map(rowToUser),
    projects: assembleProjects(projects.data ?? [], roles.data ?? []),
    applications: (applications.data ?? []).map(rowToApplication),
    tools: (tools.data ?? []).map(rowToTool),
  }
}

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return 'That email and password don’t match an account.'
  }
  return message
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA)
  const [authedUserId, setAuthedUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<number[]>([])

  // Refs so mutation callbacks can stay identity-stable (empty dep arrays).
  const dataRef = useRef(data)
  dataRef.current = data
  const currentUserIdRef = useRef(data.currentUserId)
  currentUserIdRef.current = data.currentUserId

  const dismissToast = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, kind: Toast['kind'] = 'success') => {
      const id = uid('toast')
      setToasts((ts) => [...ts, { id, kind, message }])
      timersRef.current.push(window.setTimeout(() => dismissToast(id), 4200))
    },
    [dismissToast],
  )

  // Re-pull everything from the server (used after a failed write, and by realtime).
  const resync = useCallback(() => {
    fetchAll()
      .then((fresh) => setData((d) => ({ ...d, ...fresh })))
      .catch(() => {
        /* transient — realtime or the next action will retry */
      })
  }, [])

  // Run a write; on failure, surface a message and resync to the truth.
  const commit = useCallback(
    (promise: PromiseLike<{ error: unknown }>, failMessage: string) => {
      Promise.resolve(promise).then(({ error }) => {
        if (error) {
          notify(failMessage, 'info')
          resync()
        }
      })
    },
    [notify, resync],
  )

  // --- Auth + initial load ---------------------------------------------------

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAuthedUserId(session.user.id)
        // Defer: doing Supabase calls synchronously inside this callback can deadlock.
        setTimeout(() => {
          fetchAll()
            .then((fresh) => {
              setData({ currentUserId: session.user.id, ...fresh })
              setStatus('ready')
            })
            .catch(() => {
              setData({ ...EMPTY_DATA, currentUserId: session.user.id })
              setStatus('ready')
              notify('Could not load your data. Check your connection and refresh.', 'info')
            })
        }, 0)
      } else {
        setAuthedUserId(null)
        setData(EMPTY_DATA)
        setStatus('signedout')
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [notify])

  // --- Realtime: keep every open browser in sync -----------------------------

  useEffect(() => {
    if (!authedUserId) return
    let debounce: number | undefined
    const channel = supabase
      .channel('opened-role-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        window.clearTimeout(debounce)
        debounce = window.setTimeout(resync, 400)
      })
      .subscribe()
    return () => {
      window.clearTimeout(debounce)
      supabase.removeChannel(channel)
    }
  }, [authedUserId, resync])

  useEffect(() => {
    const timers = timersRef.current
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])

  // --- Mutations (optimistic local update + background write) ----------------

  const addProject = useCallback(
    (p: Omit<Project, 'id' | 'ownerId' | 'createdAt' | 'hue'>) => {
      const id = uid('p')
      const ownerId = currentUserIdRef.current
      const project: Project = {
        ...p,
        id,
        ownerId,
        createdAt: Date.now(),
        hue: Math.floor(Math.random() * 360),
      }
      setData((d) => ({ ...d, projects: [project, ...d.projects] }))

      Promise.resolve(
        supabase.from('projects').insert({
          id,
          owner_id: ownerId,
          title: project.title,
          tagline: project.tagline,
          description: project.description,
          category: project.category,
          tags: project.tags,
          hue: project.hue,
        }),
      ).then(({ error }) => {
        if (error) {
          notify('Could not save your project.', 'info')
          resync()
          return
        }
        const roleRows = project.roles.map((r, i) => ({
          id: r.id,
          project_id: id,
          title: r.title,
          description: r.description,
          skills: r.skills,
          slots: r.slots,
          filled_by: r.filledBy,
          work_mode: r.workMode,
          position: i,
        }))
        commit(supabase.from('roles').insert(roleRows), 'Could not save the project’s roles.')
      })

      return project
    },
    [notify, resync, commit],
  )

  const addTool = useCallback(
    (t: Omit<ToolListing, 'id' | 'ownerId' | 'createdAt'>) => {
      const id = uid('t')
      const ownerId = currentUserIdRef.current
      const tool: ToolListing = { ...t, id, ownerId, createdAt: Date.now() }
      setData((d) => ({ ...d, tools: [tool, ...d.tools] }))
      commit(
        supabase.from('tools').insert({
          id,
          owner_id: ownerId,
          name: tool.name,
          category: tool.category,
          description: tool.description,
          rate_per_day: tool.ratePerDay,
        }),
        'Could not list your tool.',
      )
    },
    [commit],
  )

  const removeTool = useCallback(
    (toolId: string) => {
      setData((d) => ({ ...d, tools: d.tools.filter((t) => t.id !== toolId) }))
      commit(supabase.from('tools').delete().eq('id', toolId), 'Could not remove the listing.')
    },
    [commit],
  )

  const apply = useCallback(
    (projectId: string, roleId: string, message: string) => {
      const id = uid('a')
      const userId = currentUserIdRef.current
      const application: Application = {
        id,
        projectId,
        roleId,
        userId,
        message,
        status: 'pending',
        createdAt: Date.now(),
      }
      setData((d) => ({ ...d, applications: [application, ...d.applications] }))
      commit(
        supabase
          .from('applications')
          .insert({ id, project_id: projectId, role_id: roleId, user_id: userId, message, status: 'pending' }),
        'Could not send your application.',
      )
    },
    [commit],
  )

  const withdraw = useCallback(
    (applicationId: string) => {
      setData((d) => ({
        ...d,
        applications: d.applications.filter((a) => a.id !== applicationId),
      }))
      commit(
        supabase.from('applications').delete().eq('id', applicationId),
        'Could not withdraw the application.',
      )
    },
    [commit],
  )

  const decideApplication = useCallback(
    (applicationId: string, status: ApplicationStatus) => {
      const d0 = dataRef.current
      const app = d0.applications.find((a) => a.id === applicationId)
      if (!app) return

      // Decide up front whether accepting this fills a slot, so the background
      // write below doesn't depend on when React runs the state updater.
      const role = d0.projects
        .find((p) => p.id === app.projectId)
        ?.roles.find((r) => r.id === app.roleId)
      const nextFilledBy =
        status === 'accepted' && role && !role.filledBy.includes(app.userId)
          ? [...role.filledBy, app.userId]
          : null

      // Optimistic: set status and, if accepted, fill the role slot.
      setData((d) => {
        const applications = d.applications.map((a) =>
          a.id === applicationId ? { ...a, status } : a,
        )
        const projects = nextFilledBy
          ? d.projects.map((p) =>
              p.id === app.projectId
                ? {
                    ...p,
                    roles: p.roles.map((r) =>
                      r.id === app.roleId ? { ...r, filledBy: nextFilledBy } : r,
                    ),
                  }
                : p,
            )
          : d.projects
        return { ...d, applications, projects }
      })

      Promise.resolve(supabase.from('applications').update({ status }).eq('id', applicationId)).then(
        ({ error }) => {
          if (error) {
            notify('Could not update the application.', 'info')
            resync()
            return
          }
          if (status === 'accepted' && nextFilledBy) {
            commit(
              supabase.from('roles').update({ filled_by: nextFilledBy }).eq('id', app.roleId),
              'Could not fill the role.',
            )
          }
        },
      )
    },
    [notify, resync, commit],
  )

  const updateProfile = useCallback(
    (
      patch: Partial<
        Pick<User, 'name' | 'headline' | 'location' | 'bio' | 'skills' | 'interests' | 'school' | 'resume'>
      >,
    ) => {
      const id = currentUserIdRef.current
      setData((d) => ({
        ...d,
        users: d.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      }))

      const row: Row = {}
      if ('name' in patch) row.name = patch.name
      if ('headline' in patch) row.headline = patch.headline
      if ('location' in patch) row.location = patch.location
      if ('bio' in patch) row.bio = patch.bio
      if ('skills' in patch) row.skills = patch.skills
      if ('interests' in patch) row.interests = patch.interests ?? []
      if ('school' in patch) row.school = patch.school ?? null
      if ('resume' in patch) row.resume = patch.resume ?? null
      commit(supabase.from('profiles').update(row).eq('id', id), 'Could not save your profile.')
    },
    [commit],
  )

  // --- Auth actions ----------------------------------------------------------

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return { ok: false, error: friendlyAuthError(error.message) }
    return { ok: true }
  }, [])

  const signUp = useCallback(async ({ email, password, name }: SignUpParams): Promise<SignInResult> => {
    const { data: res, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    })
    if (error) return { ok: false, error: error.message }
    if (!res.session) {
      // Email confirmation is on — no session until they click the link.
      return { ok: true, message: 'Check your email to confirm your account, then sign in.' }
    }
    return { ok: true }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const currentUser = useMemo<User>(
    () =>
      data.users.find((u) => u.id === data.currentUserId) ?? {
        id: data.currentUserId,
        name: '',
        email: '',
        headline: '',
        location: '',
        bio: '',
        skills: [],
        hue: 210,
      },
    [data.users, data.currentUserId],
  )

  const store: Store = useMemo(
    () => ({
      data,
      currentUser,
      authedUserId,
      status,
      toasts,
      signIn,
      signUp,
      signOut,
      dismissToast,
      notify,
      addProject,
      addTool,
      removeTool,
      apply,
      withdraw,
      decideApplication,
      updateProfile,
    }),
    [
      data,
      currentUser,
      authedUserId,
      status,
      toasts,
      signIn,
      signUp,
      signOut,
      dismissToast,
      notify,
      addProject,
      addTool,
      removeTool,
      apply,
      withdraw,
      decideApplication,
      updateProfile,
    ],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export function timeAgo(ts: number): string {
  const seconds = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}
