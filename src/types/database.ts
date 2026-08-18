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

export type DescriptionSection = {
  id: string
  profile_character_id: string
  position: number
  title: string | null
  title_color: string
  title_font: string
  description: string
  text_color: string
  created_at: string
  updated_at: string
}

// A character's full presentation within one profile — identity (name,
// avatar) and caption content both live here now: nothing is shared
// across a pair's profiles, since two "eras" of the same pair carry
// entirely independent input.
export type ProfileCharacter = {
  id: string
  profile_id: string
  slot: 1 | 2
  name: string
  name_color: string
  name_font: string
  profile_image_url: string | null
  catchphrase: string | null
  catchphrase_color: string
  catchphrase_font: string
  quote: string | null
  quote_color: string
  quote_font: string
  keyword_1: string | null
  keyword_2: string | null
  keyword_3: string | null
  keyword_font: string
  keyword_color: string
  description_color: string
  caption_shadow_color: string
  caption_shadow_strength: number
  caption_offset_y: number
  created_at: string
  updated_at: string
  description_sections?: DescriptionSection[]
}

export type TimelineEntry = {
  id: string
  profile_id: string
  position: number
  subtitle: string | null
  subtitle_color: string
  title: string | null
  title_color: string
  description: string | null
  char1_thought: string | null
  char2_thought: string | null
  created_at: string
  updated_at: string
}

export type PageType = 'template' | 'custom_html'

// One variant of a pair (e.g. a different era's photoshoot) — a fully
// self-contained page: its own title/link/icon color, its own two
// characters, its own timeline. Exactly one profile per pair has
// is_primary true; its image is the pair's grid thumbnail and it's the
// only page_type a primary profile may be.
export type PairProfile = {
  id: string
  pair_id: string
  profile_slug: string
  title: string
  profile_title: string
  title_font: string
  title_color: string
  title_size: number
  icon_color: string
  link_text: string | null
  link_url: string | null
  link_font: string
  link_color: string
  has_music: boolean
  is_primary: boolean
  page_type: PageType
  custom_html_url: string | null
  pair_image_url: string | null
  background_url: string | null
  background_blur: number
  timeline_subtitle_font: string
  timeline_title_font: string
  timeline_text_color: string
  timeline_dot_color: string
  timeline_line_color: string
  timeline_shadow: boolean
  position: number
  created_at: string
  updated_at: string
  profile_characters?: ProfileCharacter[]
  timeline_entries?: TimelineEntry[]
}

// A bare grouping shell — just enough to hang a slug (the primary
// profile's URL) and a set of profiles off of. No content of its own.
export type CharacterPair = {
  id: string
  slug: string
  created_by: string
  created_at: string
  updated_at: string
  pair_profiles?: PairProfile[]
}

// One image in the shared, editor/admin-managed sticker library. Any
// editor/admin can drag a copy of it onto their own home page background.
export type StickerGalleryImage = {
  id: string
  image_url: string
  storage_path: string
  created_by: string
  created_at: string
}

// Where one editor/admin has placed one gallery sticker on their own
// background — per-account, not shared, so two editors' arrangements
// never collide.
export type UserBackgroundSticker = {
  id: string
  user_id: string
  gallery_id: string
  pos_x: number
  pos_y: number
  scale: number
  rotation: number
  z: number
  created_at: string
  updated_at: string
  gallery?: StickerGalleryImage
}

export type EventVisibility = 'public' | 'members' | 'private'

export type CalendarEvent = {
  id: string
  event_date: string
  title: string
  dot_color: string
  visibility: EventVisibility
  created_by: string
  created_at: string
  updated_at: string
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
        Row: Omit<CharacterPair, 'pair_profiles'>
        Insert: Omit<CharacterPair, 'id' | 'created_at' | 'updated_at' | 'pair_profiles'>
        Update: Partial<Pick<CharacterPair, 'slug'>>
        Relationships: []
      }
      pair_profiles: {
        Row: Omit<PairProfile, 'profile_characters' | 'timeline_entries'>
        Insert: Omit<PairProfile, 'id' | 'created_at' | 'updated_at' | 'profile_characters' | 'timeline_entries'>
        Update: Partial<Pick<PairProfile, 'profile_slug' | 'title' | 'profile_title' | 'title_font' | 'title_color' | 'title_size' | 'icon_color' | 'link_text' | 'link_url' | 'link_font' | 'link_color' | 'has_music' | 'is_primary' | 'page_type' | 'custom_html_url' | 'pair_image_url' | 'background_url' | 'background_blur' | 'timeline_subtitle_font' | 'timeline_title_font' | 'timeline_text_color' | 'timeline_dot_color' | 'timeline_line_color' | 'timeline_shadow' | 'position'>>
        Relationships: []
      }
      profile_characters: {
        Row: Omit<ProfileCharacter, 'description_sections'>
        Insert: Omit<ProfileCharacter, 'id' | 'created_at' | 'updated_at' | 'description_sections'>
        Update: Partial<Pick<ProfileCharacter, 'name' | 'name_color' | 'name_font' | 'profile_image_url' | 'catchphrase' | 'catchphrase_color' | 'catchphrase_font' | 'quote' | 'quote_color' | 'quote_font' | 'keyword_1' | 'keyword_2' | 'keyword_3' | 'keyword_font' | 'keyword_color' | 'description_color' | 'caption_shadow_color' | 'caption_shadow_strength' | 'caption_offset_y'>>
        Relationships: []
      }
      description_sections: {
        Row: DescriptionSection
        Insert: Omit<DescriptionSection, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Pick<DescriptionSection, 'position' | 'title' | 'title_color' | 'title_font' | 'description' | 'text_color'>>
        Relationships: []
      }
      timeline_entries: {
        Row: TimelineEntry
        Insert: Omit<TimelineEntry, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Pick<TimelineEntry, 'position' | 'subtitle' | 'subtitle_color' | 'title' | 'title_color' | 'description' | 'char1_thought' | 'char2_thought'>>
        Relationships: []
      }
      sticker_gallery: {
        Row: StickerGalleryImage
        Insert: Omit<StickerGalleryImage, 'id' | 'created_at'>
        Update: never
        Relationships: []
      }
      user_background_stickers: {
        Row: Omit<UserBackgroundSticker, 'gallery'>
        Insert: Omit<UserBackgroundSticker, 'id' | 'created_at' | 'updated_at' | 'gallery'>
        Update: Partial<Pick<UserBackgroundSticker, 'pos_x' | 'pos_y' | 'scale' | 'rotation' | 'z'>>
        Relationships: []
      }
      calendar_events: {
        Row: CalendarEvent
        Insert: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
