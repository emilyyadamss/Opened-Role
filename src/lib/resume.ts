import { supabase } from './supabase'
import type { Resume } from '../types'

const BUCKET = 'resumes'

/**
 * Upload a resume file to the user's own folder in the `resumes` bucket and
 * return the Resume record to store on the profile. The leading folder is the
 * user id — Storage RLS only lets you write into your own folder.
 */
export async function uploadResume(userId: string, file: File): Promise<Resume> {
  const dot = file.name.lastIndexOf('.')
  const ext = dot >= 0 ? file.name.slice(dot) : ''
  const path = `${userId}/${Date.now()}${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  })
  if (error) throw error
  return { fileName: file.name, path, uploadedAt: Date.now() }
}

/** Mint a short-lived signed URL that downloads the file under its original name. */
export async function resumeDownloadUrl(resume: Resume): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(resume.path, 60, { download: resume.fileName })
  if (error || !data) throw error ?? new Error('Could not create a download link.')
  return data.signedUrl
}
