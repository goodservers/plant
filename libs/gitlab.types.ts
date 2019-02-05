export interface Variable {
  key: string
  value: string
  id?: number | string
  protected?: boolean
  environment_scope?: string
}

export interface Status {
  id: number
  sha: string
  ref: string
  status: string
  name: string
  target_url: string | null
  description: string | null
  created_at: Date
  started_at: Date | null
  finished_at: Date | null
  allow_failure: boolean
  coverage: any
  author: { id: number; name: string; username: string; state: string; avatar_url: string; web_url: string }
}

export interface CurrentUser {
  id: number
  name: string
  username: string
  state: string
  web_url: string // 'https://gitlab.com/username'
  email: string
  avatar_url: string
  created_at: Date
  bio: any
  location: any
  public_email: string
  skype: string
  linkedin: string
  twitter: string
  website_url: string
  organization: any
  last_sign_in_at: Date
  confirmed_at: Date
  last_activity_on: string
  theme_id: number
  color_scheme_id: number
  projects_limit: number
  current_sign_in_at: Date
  identities: any[]
  can_create_group: boolean
  can_create_project: boolean
  two_factor_enabled: boolean
  external: boolean
  private_profile: any
  shared_runners_minutes_limit: any
}

export interface SSHKey {
  id: number
  title: string
  key: string
  created_at: Date
}

export interface Group {
  id: number
  name: string
  path: string
  description: string
  visibility: string
  lfs_enabled: boolean
  avatar_url: string
  web_url: string
  request_access_enabled: boolean
  full_name: string
  full_path: string
  file_template_project_id: boolean
  parent_id: number | null
}

export interface Project {
  id: number
  description: string
  default_branch: string
  ssh_url_to_repo: string
  http_url_to_repo: string
  web_url: string
  readme_url: string
  tag_list: string[]
  name: string
  namespace: { id: number; name: string; path: string; kind: 'group'; full_path: string; parent_id?: number }
  name_with_namespace: string
  path: string
  path_with_namespace: string
  created_at: Date
  last_activity_at: Date
  forks_count: number
  avatar_url: string
  star_count: number
}
