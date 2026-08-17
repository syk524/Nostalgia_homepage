'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type CharacterInput = { name: string; nameColor: string; nameFont: string; catchphrase: string; catchphraseColor: string; catchphraseFont: string; quote: string; quoteColor: string; quoteFont: string; description: string }
type CharacterPairInput = { title: string; pairImageUrl: string | null; backgroundUrl: string | null; backgroundBlur: number; titleFont: string; titleColor: string; titleSize: number; iconColor: string; characters: [CharacterInput, CharacterInput] }

export async function createCharacterPair(input: CharacterPairInput) {
  const { title, pairImageUrl, backgroundUrl, backgroundBlur, titleFont, titleColor, titleSize, iconColor, characters } = input
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!title.trim()) return { error: 'Title is required.' }
  if (!characters[0].name.trim() || !characters[1].name.trim()) return { error: 'Both characters need a name.' }

  const { data: pair, error } = await supabase
    .from('character_pairs')
    .insert({ title: title.trim(), pair_image_url: pairImageUrl, background_url: backgroundUrl, background_blur: backgroundBlur, title_font: titleFont, title_color: titleColor, title_size: titleSize, icon_color: iconColor, created_by: user.id })
    .select('id')
    .single()

  if (error || !pair) return { error: error?.message ?? 'Could not create the pair.' }

  const rows = characters.map((c, i) => ({
    pair_id: pair.id, slot: (i + 1) as 1 | 2, name: c.name.trim(), name_color: c.nameColor, name_font: c.nameFont,
    catchphrase: c.catchphrase.trim() || null, catchphrase_color: c.catchphraseColor, catchphrase_font: c.catchphraseFont,
    quote: c.quote.trim() || null, quote_color: c.quoteColor, quote_font: c.quoteFont, description: c.description.trim() || null,
  }))
  const { error: charErr } = await supabase.from('characters').insert(rows)
  if (charErr) return { error: charErr.message }

  revalidatePath('/profile')
  return { success: true, pairId: pair.id }
}

export async function updateCharacterPair(pairId: string, input: CharacterPairInput) {
  const { title, pairImageUrl, backgroundUrl, backgroundBlur, titleFont, titleColor, titleSize, iconColor, characters } = input
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!title.trim()) return { error: 'Title is required.' }
  if (!characters[0].name.trim() || !characters[1].name.trim()) return { error: 'Both characters need a name.' }

  const { data: updated, error } = await supabase
    .from('character_pairs')
    .update({ title: title.trim(), pair_image_url: pairImageUrl, background_url: backgroundUrl, background_blur: backgroundBlur, title_font: titleFont, title_color: titleColor, title_size: titleSize, icon_color: iconColor })
    .eq('id', pairId)
    .select('id')

  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'You don’t have permission to edit this pair.' }

  const rows = characters.map((c, i) => ({
    pair_id: pairId, slot: (i + 1) as 1 | 2, name: c.name.trim(), name_color: c.nameColor, name_font: c.nameFont,
    catchphrase: c.catchphrase.trim() || null, catchphrase_color: c.catchphraseColor, catchphrase_font: c.catchphraseFont,
    quote: c.quote.trim() || null, quote_color: c.quoteColor, quote_font: c.quoteFont, description: c.description.trim() || null,
  }))
  const { error: charErr } = await supabase.from('characters').upsert(rows, { onConflict: 'pair_id,slot' })
  if (charErr) return { error: charErr.message }

  revalidatePath('/profile')
  revalidatePath(`/profile/${pairId}`)
  return { success: true, pairId }
}
