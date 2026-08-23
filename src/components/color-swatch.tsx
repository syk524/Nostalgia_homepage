// Shared by character-pair-form.tsx and the TRPG session forms — a plain
// native color input, styled as a round swatch rather than the browser's
// own rectangular one.
export function ColorSwatch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="color"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-10 w-10 rounded-full border border-scroll-300 cursor-pointer shrink-0"
    />
  )
}
