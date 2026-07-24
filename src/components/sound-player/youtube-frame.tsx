export const YT_TARGET_ID = 'yt-player-target'

export function YoutubeFrame() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute w-px h-px overflow-hidden opacity-0"
      style={{ clip: 'rect(0,0,0,0)' }}
    >
      <div id={YT_TARGET_ID} />
    </div>
  )
}
