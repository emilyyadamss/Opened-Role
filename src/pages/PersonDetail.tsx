import { useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { INTEREST_SUGGESTIONS, SKILL_SUGGESTIONS } from '../data/seed'
import type { Resume } from '../types'
import { resumeDownloadUrl, uploadResume } from '../lib/resume'
import { Avatar, EmptyState, Modal } from '../components/ui'
import { ProjectCard } from '../components/ProjectCard'

/** Resumes upload to Supabase Storage; the bucket comfortably holds larger files. */
const MAX_RESUME_BYTES = 10 * 1024 * 1024

export function PersonDetail() {
  const { id } = useParams()
  const { data, currentUser, updateProfile, notify } = useStore()
  const [editing, setEditing] = useState(false)

  const user = data.users.find((u) => u.id === id)
  if (!user) {
    return (
      <div className="container">
        <EmptyState title="Person not found">
          <p>
            <Link to="/people" style={{ textDecoration: 'underline' }}>Back to People</Link>
          </p>
        </EmptyState>
      </div>
    )
  }

  const isMe = user.id === currentUser.id
  const ownedProjects = data.projects.filter((p) => p.ownerId === user.id)
  const contributions = data.projects.filter(
    (p) => p.ownerId !== user.id && p.roles.some((r) => r.filledBy.includes(user.id)),
  )

  async function openResume(resume: Resume) {
    try {
      const url = await resumeDownloadUrl(resume)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      notify('Could not open that resume. Please try again.', 'info')
    }
  }

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <div className="card" style={{ padding: '32px 34px', display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Avatar user={user} size={84} />
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 30 }}>{user.name}</h1>
              <p style={{ color: 'var(--ink-soft)', marginTop: 4, fontWeight: 500 }}>
                {user.headline} · {user.location}
              </p>
            </div>
            {isMe && (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                Edit profile
              </button>
            )}
          </div>
          {user.school && (
            <p style={{ marginTop: 6, color: 'var(--ink-soft)', fontSize: 14 }}>
              {user.school}
            </p>
          )}
          <p style={{ marginTop: 14, color: 'var(--ink-soft)', maxWidth: 620 }}>{user.bio}</p>
          {user.skills.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="profile-section-label">Skills</div>
              <div className="card-roles">
                {user.skills.map((s) => (
                  <span key={s} className="tag tag-accent">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {user.interests && user.interests.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="profile-section-label">Interests</div>
              <div className="card-roles">
                {user.interests.map((s) => (
                  <span key={s} className="tag">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {user.resume && (
            <div style={{ marginTop: 18 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => openResume(user.resume!)}>
                Resume — {user.resume.fileName}
              </button>
            </div>
          )}
        </div>
      </div>

      {ownedProjects.length > 0 && (
        <section className="dash-section" style={{ marginTop: 38 }}>
          <h2 className="section-title">
            {isMe ? 'Your projects' : `Projects by ${user.name.split(' ')[0]}`}
          </h2>
          <div className="grid">
            {ownedProjects.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} />
            ))}
          </div>
        </section>
      )}

      {contributions.length > 0 && (
        <section className="dash-section" style={{ marginTop: 38 }}>
          <h2 className="section-title">Contributing to</h2>
          <div className="grid">
            {contributions.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} />
            ))}
          </div>
        </section>
      )}

      {ownedProjects.length === 0 && contributions.length === 0 && (
        <EmptyState title="Nothing here yet">
          <p>{isMe ? 'Post a project or apply to one to get started.' : 'No projects yet.'}</p>
        </EmptyState>
      )}

      {editing && <EditProfileModal onClose={() => setEditing(false)} />}
    </div>
  )

  function EditProfileModal({ onClose }: { onClose: () => void }) {
    const [name, setName] = useState(currentUser.name)
    const [headline, setHeadline] = useState(currentUser.headline)
    const [location, setLocation] = useState(currentUser.location)
    const [school, setSchool] = useState(currentUser.school ?? '')
    const [bio, setBio] = useState(currentUser.bio)
    const [skills, setSkills] = useState<string[]>(currentUser.skills)
    const [interests, setInterests] = useState<string[]>(currentUser.interests ?? [])
    const [customInterest, setCustomInterest] = useState('')
    const [resume, setResume] = useState<Resume | undefined>(currentUser.resume)
    const [resumeError, setResumeError] = useState('')
    const [uploading, setUploading] = useState(false)

    function addCustomInterest() {
      const value = customInterest.trim()
      if (!value) return
      setInterests((cur) =>
        cur.some((i) => i.toLowerCase() === value.toLowerCase()) ? cur : [...cur, value],
      )
      setCustomInterest('')
    }

    async function onResumeFile(e: ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      if (file.size > MAX_RESUME_BYTES) {
        setResumeError('That file is over 10 MB. Please upload a smaller file.')
        return
      }
      setResumeError('')
      setUploading(true)
      try {
        setResume(await uploadResume(currentUser.id, file))
      } catch {
        setResumeError('Upload failed. Please try again.')
      } finally {
        setUploading(false)
      }
    }

    return (
      <Modal wide title="Edit profile" subtitle="Your skills drive role matching across the site." onClose={onClose}>
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field">
            <label>Headline</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div className="field">
            <label>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>School</label>
          <input
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="e.g. University of Michigan — BSE Mechanical Engineering"
          />
        </div>
        <div className="field">
          <label>Bio</label>
          <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div className="field">
          <label>Skills</label>
          <div className="skill-picker">
            {[...new Set([...SKILL_SUGGESTIONS, ...skills])].map((s) => (
              <button
                key={s}
                type="button"
                className={`tag${skills.includes(s) ? ' selected' : ''}`}
                onClick={() =>
                  setSkills((cur) =>
                    cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
                  )
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Interests</label>
          <div className="skill-picker">
            {[...new Set([...INTEREST_SUGGESTIONS, ...interests])].map((s) => (
              <button
                key={s}
                type="button"
                className={`tag${interests.includes(s) ? ' selected' : ''}`}
                onClick={() =>
                  setInterests((cur) =>
                    cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
                  )
                }
              >
                {s}
              </button>
            ))}
          </div>
          <input
            value={customInterest}
            onChange={(e) => setCustomInterest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustomInterest()
              }
            }}
            onBlur={addCustomInterest}
            placeholder="Add your own — press Enter"
          />
        </div>
        <div className="field">
          <label>Resume</label>
          {resume ? (
            <div className="resume-row">
              <button type="button" className="link-btn" onClick={() => openResume(resume)}>
                {resume.fileName}
              </button>
              <button type="button" className="link-btn" onClick={() => setResume(undefined)}>
                Remove
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={onResumeFile}
              disabled={uploading}
            />
          )}
          {uploading && <p className="hint">Uploading…</p>}
          {resumeError && <p className="hint" style={{ color: 'var(--accent)' }}>{resumeError}</p>}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={() => {
              updateProfile({
                name: name.trim(),
                headline: headline.trim(),
                location: location.trim(),
                school: school.trim() || undefined,
                bio: bio.trim(),
                skills,
                interests,
                resume,
              })
              notify('Profile updated')
              onClose()
            }}
          >
            Save changes
          </button>
        </div>
      </Modal>
    )
  }
}
