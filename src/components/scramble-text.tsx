'use client'
import { useEffect, useRef, useState } from 'react'

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const SCRAMBLE_STEPS = 4  // random flickers a position goes through before locking in
const STEP_STAGGER = 2    // extra frames of delay per character index — the left-to-right decode sweep
const FRAME_MS = 40

function randomChar() {
  return CHARSET[Math.floor(Math.random() * CHARSET.length)]
}

// A from-scratch reimplementation of the general "decode on hover" text
// effect (character positions flicker through random glyphs, then lock in
// left-to-right) — not the use-scramble package itself, to avoid pulling in
// a new dependency for one small hover flourish.
export function ScrambleText({ text }: { text: string }) {
  const [display, setDisplay] = useState(text)
  const frameRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setDisplay(text)
  }, [text])

  function play() {
    if (frameRef.current) return
    let frame = 0
    frameRef.current = setInterval(() => {
      frame++
      let done = true
      const next = text.split('').map((ch, i) => {
        if (ch === ' ') return ch
        const lockFrame = i * STEP_STAGGER + SCRAMBLE_STEPS
        if (frame >= lockFrame) return ch
        done = false
        return randomChar()
      })
      setDisplay(next.join(''))
      if (done) {
        if (frameRef.current) clearInterval(frameRef.current)
        frameRef.current = null
        setDisplay(text)
      }
    }, FRAME_MS)
  }

  useEffect(() => () => {
    if (frameRef.current) clearInterval(frameRef.current)
  }, [])

  return <span onMouseEnter={play}>{display}</span>
}
