'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadImage } from '@/lib/upload'
import { createCharacterPair, updateCharacterPair } from '@/lib/actions/characters'
import { PAIR_FONTS, pairFontFamily } from '@/lib/fonts'
import type { CharacterPair, Character } from '@/types/database'

type CharState = {
  name: string; nameColor: string; nameFont: string
  catchphrase: string; catchphraseColor: string; catchphraseFont: string
  quote: string; quoteColor: string; quoteFont: string
  description: string
}

function emptyChar(existing?: Character): CharState {
  return {
    name: existing?.name ?? '',
    nameColor: existing?.name_color ?? '#5c574d',
    nameFont: existing?.name_font ?? 'default',
    catchphrase: existing?.catchphrase ?? '',
    catchphraseColor: existing?.catchphrase_color ?? '#5c574d',
    catchphraseFont: existing?.catchphrase_font ?? 'default',
    quote: existing?.quote ?? '',
    quoteColor: existing?.quote_color ?? '#5c574d',
    quoteFont: existing?.quote_font ?? 'default',
    description: existing?.description ?? '',
  }
}

export function CharacterPairForm({ initialData }: { initialData?: { pair: CharacterPair; characters: [Character, Character] } }) {
  const router = useRouter()
  const isEdit = !!initialData

  const [title, setTitle] = useState(initialData?.pair.title ?? '')
  const [titleFont, setTitleFont] = useState(initialData?.pair.title_font ?? 'default')
  const [titleColor, setTitleColor] = useState(initialData?.pair.title_color ?? '#5c574d')
  const [titleSize, setTitleSize] = useState(initialData?.pair.title_size ?? 32)
  const [iconColor, setIconColor] = useState(initialData?.pair.icon_color ?? '#5c574d')

  const [pairImageUrl, setPairImageUrl] = useState<string | null>(initialData?.pair.pair_image_url ?? null)
  const [pairImageFile, setPairImageFile] = useState<File | null>(null)
  const [pairImagePreview, setPairImagePreview] = useState(initialData?.pair.pair_image_url ?? '')
  const [uploadingPairImage, setUploadingPairImage] = useState(false)

  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(initialData?.pair.background_url ?? null)
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null)
  const [backgroundPreview, setBackgroundPreview] = useState(initialData?.pair.background_url ?? '')
  const [uploadingBg, setUploadingBg] = useState(false)
  const [backgroundBlur, setBackgroundBlur] = useState(initialData?.pair.background_blur ?? 1)

  const [char1, setChar1] = useState<CharState>(() => emptyChar(initialData?.characters[0]))
  const [char2, setChar2] = useState<CharState>(() => emptyChar(initialData?.characters[1]))

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handlePairImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPairImageFile(file)
    setPairImagePreview(URL.createObjectURL(file))
  }

  function handleBackgroundChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBackgroundFile(file)
    setBackgroundPreview(URL.createObjectURL(file))
  }

  function updateChar(setChar: React.Dispatch<React.SetStateAction<CharState>>, patch: Partial<CharState>) {
    setChar(prev => ({ ...prev, ...patch }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!title.trim()) { setError('Title is required.'); return }
    if (!char1.name.trim() || !char2.name.trim()) { setError('Both characters need a name.'); return }

    setSubmitting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('You must be signed in.'); setSubmitting(false); return }

    let finalPairImageUrl = pairImageUrl
    if (pairImageFile) {
      setUploadingPairImage(true)
      const { url, error: pairImgErr } = await uploadImage(pairImageFile, user.id, 'gallery-images')
      setUploadingPairImage(false)
      if (pairImgErr) { setError(pairImgErr); setSubmitting(false); return }
      finalPairImageUrl = url
    }

    let finalBackgroundUrl = backgroundUrl
    if (backgroundFile) {
      setUploadingBg(true)
      const { url, error: bgErr } = await uploadImage(backgroundFile, user.id, 'gallery-images')
      setUploadingBg(false)
      if (bgErr) { setError(bgErr); setSubmitting(false); return }
      finalBackgroundUrl = url
    }

    const input: Parameters<typeof createCharacterPair>[0] = {
      title,
      pairImageUrl: finalPairImageUrl,
      backgroundUrl: finalBackgroundUrl,
      backgroundBlur,
      titleFont,
      titleColor,
      titleSize,
      iconColor,
      characters: [
        {
          name: char1.name, nameColor: char1.nameColor, nameFont: char1.nameFont,
          catchphrase: char1.catchphrase, catchphraseColor: char1.catchphraseColor, catchphraseFont: char1.catchphraseFont,
          quote: char1.quote, quoteColor: char1.quoteColor, quoteFont: char1.quoteFont,
          description: char1.description,
        },
        {
          name: char2.name, nameColor: char2.nameColor, nameFont: char2.nameFont,
          catchphrase: char2.catchphrase, catchphraseColor: char2.catchphraseColor, catchphraseFont: char2.catchphraseFont,
          quote: char2.quote, quoteColor: char2.quoteColor, quoteFont: char2.quoteFont,
          description: char2.description,
        },
      ],
    }

    const result = isEdit
      ? await updateCharacterPair(initialData!.pair.id, input)
      : await createCharacterPair(input)

    if (result?.error || !result?.pairId) { setError(result?.error ?? 'Could not save the pair.'); setSubmitting(false); return }
    router.push(`/profile/${result.pairId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
      <StyledTextRow
        label="Title"
        value={title}
        placeholder="Pair title"
        required
        font={titleFont}
        color={titleColor}
        size={titleSize}
        onValueChange={setTitle}
        onFontChange={setTitleFont}
        onColorChange={setTitleColor}
        onSizeChange={setTitleSize}
      />

      <div>
        <label className="label">Icon color picker</label>
        <ColorSwatch value={iconColor} onChange={setIconColor} />
      </div>

      <div>
        <label className="label">Pair image (optional)</label>
        <div className="flex items-center gap-4">
          <div className="w-32 aspect-video rounded border-2 border-dashed border-scroll-300 overflow-hidden flex items-center justify-center bg-scroll-100 shrink-0">
            {pairImagePreview
              ? <img src={pairImagePreview} alt="" className="w-full h-full object-cover" />
              : <span className="text-2xl text-scroll-400">◯</span>
            }
          </div>
          <label className="btn-ghost text-xs cursor-pointer">
            {uploadingPairImage ? 'Uploading…' : 'Choose image'}
            <input type="file" accept="image/*" onChange={handlePairImageChange} className="sr-only" disabled={uploadingPairImage} />
          </label>
        </div>
      </div>

      <div>
        <label className="label">Background (optional)</label>
        <div className="flex items-center gap-4">
          <div className="w-32 aspect-video rounded border-2 border-dashed border-scroll-300 overflow-hidden flex items-center justify-center bg-scroll-100 shrink-0">
            {backgroundPreview
              ? <img src={backgroundPreview} alt="" className="w-full h-full object-cover" />
              : <span className="text-2xl text-scroll-400">◯</span>
            }
          </div>
          <label className="btn-ghost text-xs cursor-pointer">
            {uploadingBg ? 'Uploading…' : 'Choose image'}
            <input type="file" accept="image/*" onChange={handleBackgroundChange} className="sr-only" disabled={uploadingBg} />
          </label>
        </div>
        <div className="mt-3">
          <label className="label flex items-center justify-between" htmlFor="background-blur">
            <span>Blur strength</span>
            <span className="text-ink-500 normal-case tracking-normal">{backgroundBlur}%</span>
          </label>
          <input
            id="background-blur"
            type="range"
            min={1}
            max={100}
            step={1}
            value={backgroundBlur}
            onChange={e => setBackgroundBlur(Number(e.target.value))}
            className="w-full block"
            style={{ accentColor: '#5c574d' }}
          />
        </div>
      </div>

      <CharacterFieldset label="Character 1" state={char1} onPatch={patch => updateChar(setChar1, patch)} />
      <CharacterFieldset label="Character 2" state={char2} onPatch={patch => updateChar(setChar2, patch)} />

      {error && (
        <p className="field-error bg-ember/10 border border-ember/20 rounded px-4 py-2.5 text-sm">{error}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Register Pair'}
        </button>
        <button type="button" onClick={() => router.push(isEdit ? `/profile/${initialData!.pair.id}` : '/profile')} className="btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  )
}

function FontSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      className="input"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ fontFamily: pairFontFamily(value) }}
    >
      {Object.entries(PAIR_FONTS).map(([key, { label, family }]) => (
        <option key={key} value={key} style={{ fontFamily: family }}>{label}</option>
      ))}
    </select>
  )
}

// Hex input leads (typing a hex code is the default way to set a color);
// the native swatch is a compact secondary picker next to it.
function ColorSwatch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value)

  useEffect(() => { setText(value) }, [value])

  function handleTextChange(raw: string) {
    setText(raw)
    const hex = raw.startsWith('#') ? raw : `#${raw}`
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) onChange(hex)
  }

  return (
    <div className="flex gap-1.5 shrink-0">
      <input
        type="text"
        value={text}
        onChange={e => handleTextChange(e.target.value)}
        onBlur={() => setText(value)}
        placeholder="#000000"
        className="input h-[42px] w-24 font-mono text-xs px-2"
      />
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-[42px] w-10 rounded border border-scroll-300 cursor-pointer shrink-0"
      />
    </div>
  )
}

function StyledTextRow({
  label, value, placeholder, required, font, color, size, onValueChange, onFontChange, onColorChange, onSizeChange,
}: {
  label: string
  value: string
  placeholder?: string
  required?: boolean
  font: string
  color: string
  size?: number
  onValueChange: (value: string) => void
  onFontChange: (value: string) => void
  onColorChange: (value: string) => void
  onSizeChange?: (value: number) => void
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-3">
        <input
          className="input flex-1 min-w-[140px]"
          value={value}
          onChange={e => onValueChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={{ fontFamily: pairFontFamily(font) }}
        />
        <div className="w-36">
          <FontSelect value={font} onChange={onFontChange} />
        </div>
        {size !== undefined && onSizeChange && (
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min={12}
              max={96}
              value={size}
              onChange={e => onSizeChange(Number(e.target.value))}
              className="input w-16 text-center"
            />
            <span className="text-xs text-ink-500">px</span>
          </div>
        )}
        <ColorSwatch value={color} onChange={onColorChange} />
      </div>
    </div>
  )
}

function CharacterFieldset({
  label, state, onPatch,
}: {
  label: string
  state: CharState
  onPatch: (patch: Partial<CharState>) => void
}) {
  return (
    <div className="space-y-4 pt-4 border-t border-scroll-300">
      <p className="label">{label}</p>

      <StyledTextRow
        label="Catchphrase"
        value={state.catchphrase}
        placeholder="A short tagline"
        font={state.catchphraseFont}
        color={state.catchphraseColor}
        onValueChange={v => onPatch({ catchphrase: v })}
        onFontChange={v => onPatch({ catchphraseFont: v })}
        onColorChange={v => onPatch({ catchphraseColor: v })}
      />

      <StyledTextRow
        label="Name"
        value={state.name}
        placeholder="Character name"
        required
        font={state.nameFont}
        color={state.nameColor}
        onValueChange={v => onPatch({ name: v })}
        onFontChange={v => onPatch({ nameFont: v })}
        onColorChange={v => onPatch({ nameColor: v })}
      />

      <StyledTextRow
        label="Quote"
        value={state.quote}
        placeholder="A signature line"
        font={state.quoteFont}
        color={state.quoteColor}
        onValueChange={v => onPatch({ quote: v })}
        onFontChange={v => onPatch({ quoteFont: v })}
        onColorChange={v => onPatch({ quoteColor: v })}
      />

      <div>
        <label className="label">Description</label>
        <textarea className="textarea" rows={4} value={state.description} onChange={e => onPatch({ description: e.target.value })} placeholder="Notes for now — details later" />
      </div>
    </div>
  )
}
