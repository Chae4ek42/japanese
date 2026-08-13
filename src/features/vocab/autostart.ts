/** Session flag: open train page and start practice immediately (e.g. from Theory). */
export const AUTOSTART_TRAIN_KEY = 'jp:autostart-train'

export function markAutostartTrain() {
  try {
    sessionStorage.setItem(AUTOSTART_TRAIN_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function consumeAutostartTrain(): boolean {
  try {
    if (sessionStorage.getItem(AUTOSTART_TRAIN_KEY) !== '1') return false
    sessionStorage.removeItem(AUTOSTART_TRAIN_KEY)
    return true
  } catch {
    return false
  }
}
