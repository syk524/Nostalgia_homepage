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
  focal_x: number
  focal_y: number
  created_at: string
}

export type Category = {
  id: string
  name: string
  sort_order: number
  created_at: string
}

export type Post = {
  id: string
  author_id: string
  category_id: string
  title: string
  body: string
  is_edited: boolean
  position: number
  created_at: string
  updated_at: string
  author?: Profile
  images?: PostImage[]
  category?: Category
}

export type Character = {
  id: string
  pair_id: string
  slot: 1 | 2
  name: string
  name_color: string
  name_font: string
  catchphrase: string | null
  catchphrase_color: string
  catchphrase_font: string
  quote: string | null
  quote_color: string
  quote_font: string
  description: string | null
  created_at: string
  updated_at: string
}

export type CharacterPair = {
  id: string
  title: string
  pair_image_url: string | null
  background_url: string | null
  background_blur: number
  title_font: string
  title_color: string
  created_by: string
  created_at: string
  updated_at: string
  characters?: Character[]
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
        Insert: Omit<Post, 'id' | 'is_edited' | 'position' | 'created_at' | 'updated_at' | 'author' | 'images' | 'category'>
        Update: Partial<Pick<Post, 'title' | 'body' | 'is_edited' | 'category_id' | 'position'>>
        Relationships: []
      }
      post_images: {
        Row: PostImage
        Insert: Omit<PostImage, 'id' | 'created_at'>
        Update: Partial<Pick<PostImage, 'image_url' | 'position' | 'focal_x' | 'focal_y'>>
        Relationships: []
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at' | 'sort_order'>
        Update: Partial<Pick<Category, 'name'>>
        Relationships: []
      }
      playlist_tracks: {
        Row: PlaylistTrack
        Insert: Omit<PlaylistTrack, 'id' | 'created_at'>
        Update: Partial<Pick<PlaylistTrack, 'title' | 'artist' | 'duration_seconds' | 'position'>>
        Relationships: []
      }
      character_pairs: {
        Row: Omit<CharacterPair, 'characters'>
        Insert: Omit<CharacterPair, 'id' | 'created_at' | 'updated_at' | 'characters'>
        Update: Partial<Pick<CharacterPair, 'title' | 'pair_image_url' | 'background_url' | 'background_blur' | 'title_font' | 'title_color'>>
        Relationships: []
      }
      characters: {
        Row: Character
        Insert: Omit<Character, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Pick<Character, 'name' | 'name_color' | 'name_font' | 'catchphrase' | 'catchphrase_color' | 'catchphrase_font' | 'quote' | 'quote_color' | 'quote_font' | 'description'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
