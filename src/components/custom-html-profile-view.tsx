// Supabase Storage always serves .html objects as `Content-Type: text/plain`
// with a locked-down CSP, no matter what content-type is set on upload —
// "For security, HTML files are returned as plain text" per Supabase's own
// docs, not something a bucket setting can override. Loading the uploaded
// file via a plain `src` therefore showed raw source instead of rendering
// it. srcDoc sidesteps this entirely: the browser parses the string as HTML
// directly, with no network content-type negotiation involved — the caller
// fetches the raw text server-side (see the [slug]/page.tsx routes) and
// passes it straight through here.
//
// Sandboxing is unaffected by this switch: sandbox="allow-scripts" WITHOUT
// allow-same-origin gives an srcDoc'd frame the same opaque/unique origin
// as a cross-origin `src` would — scripts can run, but still can't reach
// this page's DOM/cookies or make authenticated requests back to Supabase.
// No allow-top-navigation/allow-popups either, so a hostile upload can't
// hijack the parent tab. Fixed full-viewport with its own scrolling —
// auto-resizing to content would need the embedded page's own cooperation
// via postMessage, which arbitrary uploaded HTML can't be relied on to
// provide.
export function CustomHtmlProfileView({ htmlContent, title }: { htmlContent: string | null; title: string }) {
  if (!htmlContent) {
    return (
      <div className="fixed inset-0 flex items-center justify-center text-ink-400 text-sm">
        Couldn’t load this page.
      </div>
    )
  }

  return (
    <iframe
      srcDoc={htmlContent}
      title={title}
      sandbox="allow-scripts"
      className="fixed inset-0 w-full h-full border-0 z-0"
    />
  )
}
