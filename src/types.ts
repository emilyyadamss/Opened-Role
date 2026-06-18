export interface User {
  id: string
  name: string
  email: string
  headline: string
  location: string
  bio: string
  skills: string[]
  interests?: string[]
  school?: string
  resume?: Resume
  hue: number
}

/** An uploaded resume. The file lives in the `resumes` Storage bucket; we keep
 *  its object path here and mint a short-lived signed URL when someone opens it. */
export interface Resume {
  fileName: string
  path: string
  uploadedAt: number
}

export type WorkMode = 'remote' | 'hybrid' | 'in-person'

export interface Role {
  id: string
  title: string
  description: string
  skills: string[]
  slots: number
  filledBy: string[]
  workMode: WorkMode
}

export interface Project {
  id: string
  ownerId: string
  title: string
  tagline: string
  description: string
  category: string
  tags: string[]
  roles: Role[]
  createdAt: number
  hue: number
}

export type ApplicationStatus = 'pending' | 'accepted' | 'declined'

export interface Application {
  id: string
  projectId: string
  roleId: string
  userId: string
  message: string
  status: ApplicationStatus
  createdAt: number
}

export interface ToolListing {
  id: string
  ownerId: string
  name: string
  category: string
  description: string
  /** Dollars per day to borrow it; 0 means free to borrow. */
  ratePerDay: number
  createdAt: number
}

export interface AppData {
  currentUserId: string
  users: User[]
  projects: Project[]
  applications: Application[]
  tools: ToolListing[]
}
