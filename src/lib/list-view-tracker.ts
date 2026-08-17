// Lets the post modal's close button always return to the actual gallery
// list view the user last saw — not "one step back" in history, which
// depending on how the user got here (edit → cancel, edit → save, prev/next
// browsing) can land on a stale form page or a different post instead.
// sessionStorage, not a URL param, since it needs to survive hard
// navigations too.
const LAST_LIST_URL_KEY = 'nostalgia:lastGalleryListUrl'

export function rememberListView(url: string) {
  sessionStorage.setItem(LAST_LIST_URL_KEY, url)
}

export function getLastListView(): string {
  return sessionStorage.getItem(LAST_LIST_URL_KEY) ?? '/gallery'
}
