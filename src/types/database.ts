export type Role = 'viewer' | 'editor' | 'admin'

export type Profile = {
  id: string
  username: string
  display_name: string | null
  user_icon_url: string | null
  bio: string | null
  role: Role
  created_at: string
  updated_at: string
}

export type PostImage = {
  id: string
  post_id: string
  image_url: string
  position: number
  created_at: string
}

export type Post = {
  id: string
  author_id: string
  title: string
  body: string
  is_edited: boolean
  created_at: string
  updated_at: string
  author?: Profile
  images?: PostImage[]
}

export type TrackSource = 'youtube' | 'upload'

export type PlaylistTrack = {
  id: string
  added_by: string | null
  source: TrackSource
  title: string
  artist: string
  source_ref: string
  duration_seconds: number | null
  position: number
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at' | 'role'> & { role?: Role }
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      posts: {
        Row: Post
        Insert: Omit<Post, 'id' | 'is_edited' | 'created_at' | 'updated_at' | 'author' | 'images'>
        Update: Partial<Pick<Post, 'title' | 'body' | 'is_edited'>>
        Relationships: []
      }
      post_images: {
        Row: PostImage
        Insert: Omit<PostImage, 'id' | 'created_at'>
        Update: Partial<Pick<PostImage, 'image_url' | 'position'>>
        Relationships: []
      }
      playlist_tracks: {
        Row: PlaylistTrack
        Insert: Omit<PlaylistTrack, 'id' | 'created_at'>
        Update: Partial<Pick<PlaylistTrack, 'title' | 'artist' | 'duration_seconds' | 'position'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
