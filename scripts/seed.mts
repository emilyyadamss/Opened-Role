/**
 * Seeds a fresh Supabase project with the demo users (as real, sign-in-able
 * accounts) and their projects, roles, tools, and applications.
 *
 * Usage:
 *   1. Fill in .env.local (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 *   2. npm run seed
 *
 * Safe to re-run: users are matched by email, rows are upserted by id.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { makeSeedData } from '../src/data/seed'
import { DEMO_PASSWORD } from '../src/lib/constants'

// --- Minimal .env.local loader (so `npm run seed` just works) ----------------
try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  // no .env.local — rely on real environment variables
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set them in .env.local).')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

function die(label: string, error: unknown): never {
  console.error(`✗ ${label}:`, error)
  process.exit(1)
}

async function main() {
  const seed = makeSeedData()

  // 1. Create (or find) an auth account per demo user, mapping seed id -> uuid.
  const { data: existing, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) die('list users', listErr)
  const byEmail = new Map(existing.users.map((u) => [u.email?.toLowerCase(), u.id]))

  const idMap = new Map<string, string>() // 'u-emily' -> uuid
  for (const u of seed.users) {
    let authId = byEmail.get(u.email.toLowerCase())
    if (!authId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name: u.name },
      })
      if (error || !data.user) die(`create user ${u.email}`, error)
      authId = data.user.id
    }
    idMap.set(u.id, authId)
  }
  const mapId = (seedId: string) => idMap.get(seedId) ?? seedId

  // 2. Upsert full profile rows (the trigger created bare ones).
  const profiles = seed.users.map((u) => ({
    id: mapId(u.id),
    email: u.email,
    name: u.name,
    headline: u.headline,
    location: u.location,
    bio: u.bio,
    skills: u.skills,
    interests: u.interests ?? [],
    school: u.school ?? null,
    resume: u.resume ?? null,
    hue: u.hue,
  }))
  let r = await admin.from('profiles').upsert(profiles)
  if (r.error) die('upsert profiles', r.error)

  // 3. Projects + roles.
  const projects = seed.projects.map((p) => ({
    id: p.id,
    owner_id: mapId(p.ownerId),
    title: p.title,
    tagline: p.tagline,
    description: p.description,
    category: p.category,
    tags: p.tags,
    hue: p.hue,
    created_at: new Date(p.createdAt).toISOString(),
  }))
  r = await admin.from('projects').upsert(projects)
  if (r.error) die('upsert projects', r.error)

  const roles = seed.projects.flatMap((p) =>
    p.roles.map((role, i) => ({
      id: role.id,
      project_id: p.id,
      title: role.title,
      description: role.description,
      skills: role.skills,
      slots: role.slots,
      filled_by: role.filledBy.map(mapId),
      work_mode: role.workMode,
      position: i,
    })),
  )
  r = await admin.from('roles').upsert(roles)
  if (r.error) die('upsert roles', r.error)

  // 4. Tools.
  const tools = seed.tools.map((t) => ({
    id: t.id,
    owner_id: mapId(t.ownerId),
    name: t.name,
    category: t.category,
    description: t.description,
    rate_per_day: t.ratePerDay,
    created_at: new Date(t.createdAt).toISOString(),
  }))
  r = await admin.from('tools').upsert(tools)
  if (r.error) die('upsert tools', r.error)

  // 5. Applications.
  const applications = seed.applications.map((a) => ({
    id: a.id,
    project_id: a.projectId,
    role_id: a.roleId,
    user_id: mapId(a.userId),
    message: a.message,
    status: a.status,
    created_at: new Date(a.createdAt).toISOString(),
  }))
  r = await admin.from('applications').upsert(applications)
  if (r.error) die('upsert applications', r.error)

  console.log(
    `✓ Seeded ${profiles.length} users, ${projects.length} projects, ` +
      `${roles.length} roles, ${tools.length} tools, ${applications.length} applications.`,
  )
  console.log(`  Demo sign-in: ${seed.users[0].email} / ${DEMO_PASSWORD}`)
}

main()
