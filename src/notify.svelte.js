// A single transient toast message, shared across the app.
export const notice = $state({ message: '' })

let timer

export function flash(message) {
  notice.message = message
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (notice.message === message) notice.message = ''
  }, 3500)
}
