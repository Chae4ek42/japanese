import { useCallback, useRef } from 'react'
import { normalizeAppState } from './app-state'
import { saveAppState } from '../lib/storage'
import { useAppStateContext } from './core'

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function useBackupApp() {
  const { appState, setAppState, activeAccountId } = useAppStateContext()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const exportBackup = useCallback(() => {
    if (!appState) return
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    downloadJson(`jp-backup-${stamp}.json`, appState)
  }, [appState])

  const importBackup = useCallback(
    async (file: File) => {
      if (!activeAccountId) {
        window.alert('Сначала войдите в аккаунт.')
        return
      }
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        window.alert('Не удалось прочитать файл: это не JSON.')
        return
      }
      const next = normalizeAppState(parsed)
      if (!next) {
        window.alert('Файл не похож на сохранённые данные приложения.')
        return
      }
      const mineCount = next.vocab.myWords.length
      if (
        !window.confirm(
          `Импортировать данные в текущий аккаунт? «Мои слова»: ${mineCount}. Текущий прогресс будет заменён.`,
        )
      ) {
        return
      }
      // Apply locally first so UI updates even if the server write fails.
      setAppState(next)
      try {
        const result = await saveAppState(next, activeAccountId, { force: true })
        if (result === 'skipped') {
          window.alert('Данные открыты в приложении, но сессия неактивна — войдите снова, чтобы сохранить на сервер.')
          return
        }
        window.alert('Импорт выполнен.')
      } catch (error) {
        console.warn('[backup] import save failed', error)
        window.alert(
          'Данные подставлены в приложение, но сервер не принял сохранение. Не закрывайте вкладку и попробуйте Экспорт, затем Импорт ещё раз позже.',
        )
      }
    },
    [activeAccountId, setAppState],
  )

  const openImportPicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onImportFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) void importBackup(file)
    },
    [importBackup],
  )

  return {
    exportBackup,
    openImportPicker,
    fileInputRef,
    onImportFileChange,
    canExport: Boolean(appState && activeAccountId),
  }
}
