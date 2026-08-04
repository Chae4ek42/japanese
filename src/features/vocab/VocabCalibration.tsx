import { useEffect, useState } from 'react'
import { computeCalibration, forecastDueCount, readReviewEvents, type CalibrationReport } from '../../shared/lib/review'
import type { MemoryState } from '../../shared/lib/types'

export function VocabCalibration({
  memory,
  targetRetention,
}: {
  memory: Record<string, MemoryState>
  targetRetention: number
}) {
  const [report, setReport] = useState<CalibrationReport | null>(null)
  const [forecast, setForecast] = useState<number[]>([])

  useEffect(() => {
    let cancelled = false
    void readReviewEvents(5000).then((events) => {
      if (cancelled) return
      setReport(computeCalibration(events))
      setForecast(forecastDueCount(memory, targetRetention, 7))
    })
    return () => {
      cancelled = true
    }
  }, [memory, targetRetention])

  if (!report || report.reviewCount < 5) {
    return (
      <p className="control-hint" data-testid="vocab-calibration-empty">
        Калибровка появится после нескольких ответов в новой модели.
      </p>
    )
  }

  return (
    <div className="control-group" data-testid="vocab-calibration">
      <span className="group-label">Калибровка</span>
      <p className="control-hint">
        True retention: {Math.round(report.trueRetention * 100)}% · log-loss:{' '}
        {report.logLoss.toFixed(3)} · RMSE: {report.rmse.toFixed(3)} · n={report.reviewCount}
      </p>
      <ul className="control-hint" style={{ margin: 0, paddingLeft: '1.2rem' }}>
        {report.buckets.map((bucket) => (
          <li key={bucket.predicted}>
            предск. {Math.round(bucket.predicted * 100)}% → факт. {Math.round(bucket.actual * 100)}% (
            {bucket.count})
          </li>
        ))}
      </ul>
      {forecast.length ? (
        <p className="control-hint">Прогноз due на 7 дней: {forecast.join(', ')}</p>
      ) : null}
    </div>
  )
}
