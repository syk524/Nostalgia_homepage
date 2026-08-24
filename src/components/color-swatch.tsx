'use client'
import { useEffect, useId, useState } from 'react'

// Shared by character-pair-form.tsx and the TRPG session forms — a native
// color input styled as a round swatch, plus a synced hex text field next
// to it: the round swatch alone gives no readable value at a glance and no
// way to type a precise hex code, both reported directly.
export function ColorSwatch({ value, onChange, label }: { value: string; onChange: (value: string) => void; label?: string }) {
  const id = useId()
  // Local text buffer, not derived straight from `value` — lets someone
  // type a partial hex ("#2f") without each keystroke being clobbered by
  // the parent re-rendering with the last still-valid value.
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])

  function commit(next: string) {
    setText(next)
    if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next)
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <input
        type="color"
        value={value}
        onChange={e => { onChange(e.target.value); setText(e.target.value) }}
        aria-label={label ?? '색상'}
        id={id}
        className="h-10 w-10 rounded-full border border-scroll-300 cursor-pointer shrink-0"
      />
      <input
        type="text"
        value={text}
        onChange={e => commit(e.target.value)}
        onBlur={() => setText(value)}
        aria-label={`${label ?? '색상'} 16진값`}
        className="input w-[84px] px-2 py-1.5 text-xs font-mono uppercase"
        maxLength={7}
        placeholder="#000000"
      />
    </div>
  )
}
