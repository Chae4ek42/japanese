# Адаптивный подбор слов для ревью

Отчёт по фактической реализации в коде (не «классический SRS»).  
Дата анализа: 2026-08-04. Основные файлы: `src/shared/lib/trainer.ts`, `src/shared/lib/trainerCore.ts`, `src/features/vocab/VocabTrainer.tsx`, `src/features/vocab/pool.ts`.

---

## 1. Что это за алгоритм (и чем он не является)

В проекте **нет** классического spaced repetition:

- нет ease factor / SM-2;
- нет интервалов в днях (`interval`);
- нет очереди due (`due`);
- нет отдельного «review deck» с датами.

Вместо этого — **непрерывный mastery-скор** на карточку + **взвешенный случайный выбор** следующей карты в рамках зафиксированного пула сессии, с очередью ошибок, кулдаунами после успеха и жёстким first-pass покрытием пула.

Тот же ядро (`pickNextCardId` / `getAdaptiveWeight` / `updateCardStats`) используют:

| Тренажёр | Режим выбора | Гиперпараметры |
|----------|--------------|----------------|
| Словарь (vocab) | `adaptive` или `even` | всегда `DEFAULT_HYPERPARAMS` (не настраиваются в UI) |
| Кана | `adaptive` / `even` / `problem` | пользовательские `preferences.hyperparams` |
| Числа | adaptive | копия дефолтов (`NUMBER_HYPERPARAMS`) |
| Контекст | **другой** алгоритм (i+1 по предложениям) | не связан с mastery |

Дальше отчёт фокусируется на **словах (vocab)**, с пометками, где поведение общее.

---

## 2. Жизненный цикл сессии

```
Настройки (source, JLPT, лимит новых, drill…)
        │
        ▼
buildVocabPool → activePool
        │
        ▼
setupExcludedIds  →  startPool = activePool \ excluded
        │
        ▼
startPractice()
  • beginPractice({ poolIds, mode })
  • обнуление session weights / nav history
  • advanceToNextCard()
        │
        ▼
┌─────────────────────────────────────────────┐
│  цикл: showCard → ответ/скип → pick next    │
│  liveSession может сохраняться в AppState   │
└─────────────────────────────────────────────┘
        │
        ▼
stopPractice → liveSession = null → setup
```

### Точки входа

| Этап | Где |
|------|-----|
| Старт | `VocabTrainer.startPractice()` |
| Сборка пула | `buildVocabPool` / `limitVocabCards` (`pool.ts`) |
| Первый / следующий выбор | `pickNextVocabCardId` → `pickNextCardId` или `pickWeightedVocabCardId` |
| Показ карточки | `showCard` → `prepareShownCard` (+ опционально stats `seen`) |
| После успеха | `finalizeCorrect` → `afterSuccessfulCard` + `updateCardStats` |
| После ошибки | `registerWrongAttempt` → `enqueueMistake` + stats `wrong` |

---

## 3. Построение пула (до адаптивного выбора)

Адаптив работает **только внутри уже собранного** `poolIds`. Качество «ревью» сильно зависит от того, что попало в пул.

### Источники (`buildVocabPool`)

- `mine` — мои слова (− выученные, если `mineIncludeLearned === false`);
- `group` / `kanji` / `list` / JLPT-level;
- скрытые (`hiddenWordIds`) выкидываются;
- опциональный фильтр JLPT слова (`wordJlptLevels`);
- сортировка `compareVocabStudyOrder` (кроме kanji/list, где порядок сохраняется — там в т.ч. popularity для кандзи).

### Лимит «новых»

`newWordLimit` (sanitize примерно −1…50; **−1 = без лимита**):

- при старте `activePool` строится с `applyNewWordLimit: true`;
- `sourcePool` — без лимита (для кнопки «+ слово» mid-session);
- `limitVocabCards` просто **срезает префикс** отсортированного списка.

Это **не** mix ratio new/review в runtime. «Новизна» дальше давится весами (`unseenBoost`, first-pass).

### Исключения до старта

`setupExcludedIds` — только UI/локальный стейт до старта. В `poolIds` сессии уже не попадают. После старта не восстанавливаются из live session (и не нужны: пул заморожен).

### Mid-session

- **Вес 0%** в сайдбаре: карта остаётся в `poolIds`, но multiplier = 0.
- **Скрыть / выучить**: может выкинуть из живого пула (`dropCardFromSession` / reconcile).
- **+ слово**: `pickNextSourceCard` дописывает id из uncapped source.

---

## 4. Модель состояния

### 4.1. Персистентная статистика слова — `StatsRecord`

Хранится в `AppState.vocab.stats[cardId]` → `localStorage` (`jp-app-state-v1`).

| Поле | Смысл |
|------|--------|
| `exposures` | Сколько раз показали (`seen`) |
| `clears` | Успешные ответы без учёта пути `hint` как отдельного outcome |
| `errors` | Ошибки |
| `hints` | Исходы, записанные как `hint` (ответ после подсказки) |
| `streak` / `bestStreak` | Серия; **сбрасывается** на wrong и hint |
| `mastery` | Главный скор ∈ примерно \[0.02, 1\] |
| `avgLatencyMs` / `fastestLatencyMs` | EMA / минимум латентности |
| `lastSeenAt` / `lastClearAt` / `lastErrorAt` / `lastHintAt` | epoch ms |
| `eventAccuracy` | `round(clears / (clears+errors+hints) * 100)` |

Стартовые значения (`createStatsRecord`):

- `mastery = 0.12`
- все счётчики / timestamps = 0

**Не хранится:** ease, interval, due, weight (вес считается на лету).

У vocab **нет** `PracticeHistory` (daily / confusions) — это у каны.

### 4.2. Сессионное состояние — `PracticeSession`

| Поле | Роль |
|------|------|
| `poolIds` | Замороженный пул |
| `recentHistory` | Антиповтор (до 32 id) |
| `lastCardId` | Последняя в истории |
| `mistakeQueue` | FIFO-подобная очередь ошибок (до `queueSize=5`, новые в начало) |
| `sinceQueuePick` | Сколько выборов прошло с последнего pick из очереди |
| `mode` | Режим при создании сессии (для vocab фактически **устаревает**: picker читает `preferences.pickMode`) |
| `showCounts` | Сколько раз показали в этой сессии |
| `cooldowns` | Сколько ещё «ходов» карта в кулдауне |

### 4.3. Live session (восстановление)

`CardTrainerLiveSession`: текущая карта, view, sessionStats, weightMultipliers, navHistory/navIndex + поля PracticeSession.  
Санитизация: `slices/live-session.ts`.

### 4.4. Эфемерное UI

- `setupExcludedIds`
- `sessionWeightMultipliers` (0…3; пресеты 0 / 100 / 200%)
- `round`: `shownAt`, `mistakes`, `hintUsed`, `confusionLogged`

---

## 5. Гиперпараметры (`DEFAULT_HYPERPARAMS`)

```
masteryGain: 0.18
mistakePenalty: 0.24
hintPenalty: 0.16
retireStreak: 4
masteredWeight: 0.04
recentMistakeBoost: 2.4
recentMistakeHours: 8
problemThreshold: 0.45
queueSize: 5
targetLatencyMs: 2500
confusionBoost: 1.55
unseenBoost: 4.2
seenOnlyBoostRatio: 0.85
staleBoost: 2.2
staleAfterHours: 3
staleRampHours: 12
knownMasteryThreshold: 0.65
sessionFreshBoost: 2.2
weightTemperature: 0.55
mistakeQueueGap: 2
mistakeQueueChance: 0.62
```

Дополнительно: `RECENT_HISTORY_LIMIT = 32`, окно confusion для каны = 30 минут.

---

## 6. Обновление mastery — `updateCardStats`

### `seen` (показ карточки)

- `exposures++`, `lastSeenAt = now`
- mastery **не** меняется

### `wrong`

- `errors++`, `streak = 0`, timestamps ошибки
- `modeFactor = submit ? 1 : 0.75` (в instant-режиме штраф мягче)
- `drop = mistakePenalty * modeFactor * (0.45 + mastery * 0.55)`
- `mastery = clamp(mastery - drop, 0.02, 1)`

Интерпретация: чем выше mastery, тем **больше** абсолютный дроп при ошибке (зависит от mastery линейно внутри скобок).

### `hint` (это не «открыл подсказку», а **исход ответа после подсказки**)

- `hints++`, `streak = 0`
- `drop = hintPenalty * (0.45 + mastery * 0.5)`
- `mastery = clamp(mastery - drop, 0.04, 1)` — пол выше, чем у wrong (0.04 vs 0.02)
- обновляется EMA латентности

### `correct`

- `clears++`, `streak++`, best streak, timestamps
- EMA + fastest latency
- `clean = mistakesOnCard === 0 && !hintUsed`
- fluency:
  - latency ≤ 0.7 × 2500 → ×1.18
  - latency ≥ 1.7 × 2500 → ×0.8
  - иначе ×1
- `recoveryPenalty = clean ? 1 : 0.48` (грязная карта растёт почти вдвое медленнее)
- `streakBonus = 1 + min(streak, 4) * 0.045`
- `gain = masteryGain * (1 - mastery) * fluency * recovery * streakBonus`
- `mastery = clamp(mastery + gain, 0.02, 1)`

Рост насыщается: при высоком mastery `(1 - mastery)` мал.

---

## 7. Вес карточки — `getAdaptiveWeight`

Псевдокод:

```
masteryGap = 1 - mastery
errorRate = no events ? 0.35 : errors / totalEvents
accuracyGap = no events ? 0.4 : (100 - eventAccuracy) / 100
slownessBoost = f(avgLatency / target)   // 0…~1.26

noveltyBoost:
  never answered & never exposed     → unseenBoost (4.2)
  answered 0, but exposures > 0      → 4.2 * 0.85
  clears ≤ 1 и (errors+hints) ≥ 1    → 1.1
  иначе если hours since lastSeen ≥ 3:
    clamp(hours / 12, 0, 2.2)

knownPenalty:
  streak≥4 ∧ mastery≥0.65            → 0.04   (почти «на пенсии»)
  mastery≥0.65 ∧ acc≥80 ∧ clears≥2   → 0.06…0.20
  mastery≥0.5 ∧ acc≥85 ∧ clears≥3 ∧ streak≥2 → 0.28
  иначе → 1

streakReducer:
  streak≥4 → 0.04
  иначе → 1 - min(streak, 3) * 0.16

recentMissBoost = (error или hint за последние 8ч) ? 2.4 : 0

raw = (0.08 + masteryGap^2.4 * 4.2 + errorRate*2.4 + accuracyGap*1.35
       + novelty + recentMiss + slowness)
      * streakReducer * knownPenalty

weight = clamp(raw, 0.01, 14)
```

Смысл: слабые / новые / недавно проваленные доминируют; «уверенные» почти выпадают, но **никогда не до нуля** на уровне базового веса (≥ 0.01). Ноль возможен только через **session multiplier = 0**.

---

## 8. Выбор следующей карты — `pickNextCardId`

Полный пайплайн (режим `adaptive`):

```
1. pool пуст → null

2. Антиповтор
   avoidN = f(poolSize):
     ≤2 → 0
     ≤4 → 1
     ≤8 → min(3, n-1)
     else → min(max(5, ⌊n*0.4⌋), 20, n-1)
   candidates = pool \ recentHistory[-avoidN:]
   если пусто → весь pool

3. Success cooldown
   убрать карты с cooldowns[id] > 0
   если после фильтра пусто → оставить как было

4. Mistake queue (вероятностно)
   если очередь непуста ∧ sinceQueuePick ≥ mistakeQueueGap (2):
     взять первую подходящую из очереди (в candidates/pool, не blocked, не cooling)
     с вероятностью mistakeQueueChance (0.62) → вернуть её сразу
     (иначе идём дальше обычным путём)

5. First-pass coverage (жёстко)
   neverShown = candidates с showCounts[id] == 0
   если есть → candidates = neverShown
   // пока не показали все карты пула хотя бы раз,
   // mastery-веса почти не влияют (кроме прорыва очередью ошибок)

6. mode == 'problem' (кана): фильтр по problemScore ≥ 0.45

7. mode == 'even' внутри pickNextCardId: uniform по candidates
   // но vocab в even НЕ заходит сюда — см. ниже

8. Adaptive weighted
   для каждой карты:
     base = getAdaptiveWeight(...)
     sessionFactor = shows==0 ? 2.2 : 1 / (1 + shows*1.65)^1.25
     linear = base * confusionMult * sessionFactor * max(0, multiplier)
     weight = linear^(1/T)  при T=0.55  (заостряет распределение)
   weighted random; если total≤0 → первая карта
```

### Кулдаун после успеха — `successCooldownTurns`

- pool ≤ 2 → 0
- clean: `min(n-1, max(3, ⌊n*0.55⌋))`
- dirty: `min(n-1, max(2, ⌊n*0.3⌋))`

Тик кулдаунов: при каждом `bumpSessionShow` / `prepareShownCard` — у всех, кроме показанной, `remaining - 1`; у показанной кулдаун снимается.

### Очередь ошибок — `enqueueMistake` / `afterSuccessfulCard`

- ошибка: id в начало очереди, уникально, длина ≤ 5;
- успешный `correct`: id убирается из очереди + ставится кулдаун;
- успешный `hint` (vocab, `enqueueOnHint=true` по умолчанию): id **убирается и сразу снова ставится** в очередь (карта считается «нужно повторить»).

### Confusion multiplier

`getConfusionMultiplier` смотрит `getConfusableIds` из **данных каны**. Для id слов почти всегда возвращает `1` — мёртвый путь для vocab.

### Режим `even` у слов

`pickNextVocabCardId` при `pickMode === 'even'` вызывает **`pickWeightedVocabCardId`**, а не `pickNextCardId`:

- нет mastery;
- нет mistake queue / cooldown / first-pass;
- только exclude текущего id + session multipliers;
- если все веса 0 → равномерный fallback по кандидатам.

Переключение adaptive↔even — ** qualitatively другой алгоритм**, не «чуть ровнее».

---

## 9. Поведение по действиям пользователя

### 9.1. Правильный ответ

1. `finalizeCorrect('correct' | 'hint')` в зависимости от `round.hintUsed`.
2. `clean = kind==='correct' ∧ mistakes==0 ∧ !hintUsed`.
3. Session: `afterSuccessfulCard` (история, очередь, кулдаун или re-queue).
4. Stats: `correct` или `hint`.
5. Автопереход через ~220–700 ms → `advanceToNextCard`.

Важно: ответ **после подсказки** пишется как outcome **`hint`**, не как ослабленный `correct`. Счётчик `clears` не растёт; растёт `hints`; streak сбрасывается.

### 9.2. Неправильный ответ

**Romaji (instant):** при первом переходе в `wrong` — `registerWrongAttempt` (mistakes++, enqueue, stats wrong); карта остаётся.

**Romaji (submit wrong):** то же + принудительно `hintUsed=true`, очистка поля. Дальнейший верный ввод уже пойдёт как `hint`.

**Choice wrong:**

- `registerWrongAttempt`;
- `hintUsed=true`;
- ручной `pushRecentCard` + дублирующая запись в mistakeQueue;
- `recordCleanAnswer(false)`;
- автопереход через 1100 ms **без** `finalizeCorrect` / **без** success-cooldown;
- stats wrong уже записан; stats correct/hint — нет.

### 9.3. Подсказка (Space)

`revealHint`:

- только drill `romaji`;
- ставит `round.hintUsed = true` и UI feedback;
- **не** вызывает `updateCardStats('hint')` в момент открытия.

Штраф mastery наступает только если пользователь **ответит** после этого (путь `finalizeCorrect('hint')`).

Если после открытия подсказки сделать **skip** — штрафа hint в stats не будет (и `hintUsed` сбросится на следующей карте через `resetRound`).

### 9.4. Пропуск (skip prev / next)

`skipToAdjacent`:

| Направление | Поведение | Stats `seen` | Mastery | Mistake queue | Cooldown | recentHistory |
|-------------|-----------|--------------|---------|---------------|----------|---------------|
| Prev | Листает `navHistory` назад | нет (`recordSeen: false`) | нет | нет | нет* | не пушит |
| Next внутри истории | Листает вперёд по nav | нет | нет | нет | нет* | не пушит |
| Next за краем истории | `pushRecentCard(current)` → pick next | нет | нет | нет | нет* | да (текущая) |

\* `showCard` всё равно вызывает `prepareShownCard` → **тикает showCounts и кулдауны**, даже при `recordSeen: false`. То есть скип **влияет на сессионный pacing**, но **не** на персистентный mastery.

Дополнительно:

- forward skip кладёт текущую карту в `recentHistory` → антиповтор может «съесть» слот, хотя exposures/mastery не обновились;
- showCounts растёт → в adaptive после first-pass карта получает меньший `sessionFactor`, будто её реально тренировали.

E2E покрывает: «skip next and previous without scoring».

### 9.5. Вес 0% / исключение / скрытие

| Механизм | Персистентность | Эффект на picker |
|----------|-----------------|------------------|
| Setup exclude | до старта | нет в `poolIds` |
| Weight 0% | live session | weight=0; если есть карты с >0 — не выбирается; если **все** 0 — fallback всё равно вернёт карту |
| Hide word | `hiddenWordIds` | выпадает из пулов / drop из сессии |
| Learned + mine | `learnedWordIds` | может выпасть mid-session |

### 9.6. Конец / резюме сессии

- Stop: чистит live session.
- Уход со страницы: снапшот live при `view==='practice'`.
- Resume: восстанавливает пул/очередь/веса/nav; **заново** `resetRound(Date.now())` — латентность следующего ответа считается от момента restore, не от исходного показа; повторного `seen` нет.

### 9.7. «Исчерпание ревью»

Due-очереди нет. Пул крутится бесконечно взвешенным циклом.  
Пустой пул / null pick → возврат в setup.

---

## 10. Сессионные множители и «свежесть»

Итоговый linear вес:

```
base * confusion(≈1 для vocab) * sessionFactor * multiplier
```

`sessionFactor`:

- первый показ в сессии: ×2.2;
- дальше: `1 / (1 + shows * 1.65)^1.25` — быстро душит уже показанные.

Temperature 0.55: `weight = linear^(1/0.55) ≈ linear^1.82` — ещё сильнее поляризует.

Практический эффект: в начале сессии алгоритм почти **последовательно покрывает** пул (first-pass + freshBoost); после покрытия уходит в «долбить слабые».

---

## 11. Анализ рисков и способов «сломать» поведение

Ниже — не теоретические баги компилятора, а **логические дыры / неочевидные эффекты**, подтверждённые кодом.

### 11.1. Подсказка без штрафа

Открыл Space → скипнул.  
Stats hint не пишется. Карта не уходит в mistake queue через `afterSuccessfulCard`.  
Но `showCounts` уже мог вырасти на предыдущих показах; при forward skip текущая уходит в `recentHistory`.

**Симптом:** пользователь «смотрит ответы» через hint+skip и слабо влияет на mastery.

### 11.2. Submit-wrong превращает следующий correct в hint

Неверный submit ставит `hintUsed=true` **без** показа подсказки.  
Следующий верный ответ → outcome `hint` (штраф + re-queue), хотя человек мог просто опечататься.

**Симптом:** одна опечатка резко бьёт mastery и держит карту в очереди ошибок.

### 11.3. Choice-wrong vs romaji-wrong асимметрия

Choice wrong: автоadvance, unclean session answer, нет success-cooldown, stats только wrong.  
Romaji wrong: остаёшься на карте, можешь потом correct/hint.

Один и тот же «не знаю» даёт разный след в scheduling.

### 11.4. Гонка `registerWrongAttempt` и `sessionRef`

`registerWrongAttempt` делает `setSession(enqueueMistake)` **без** синхронного `sessionRef.current = …`.  
Пути вроде `finalizeCorrect` / `handleChoose` / `showCard` обновляют ref явно.

Если сразу после ошибки (до ре-рендера) вызвать путь, читающий только `sessionRef`, очередь ошибок может быть **устаревшей**.

### 11.5. Skip ломает смысл showCounts / anti-repeat

Forward skip:

- не пишет `seen`/mastery;
- пишет `recentHistory`;
- через `prepareShownCard` крутит `showCounts` и cooldowns.

**Симптом:** после серии скипов first-pass «закрыт», кулдауны утекли, а mastery почти не двигался — адаптив начинает «ревьюить» пустые знания.

### 11.6. Weight 0% — мягкое исключение

Карта видима в сайдбаре, остаётся в пуле.  
При всех нулях picker всё равно вернёт кого-то (`total ≤ 0` → fallback).  
Нельзя считать 0% жёстким «убрать из тренировки» как setup exclude.

### 11.7. First-pass доминирует над mastery

Пока есть `showCounts==0`, кандидаты сужаются до них (кроме вероятностного прорыва mistake queue).  
На большом пуле (сотни слов) первые N показов ≈ обход списка; «адаптивное ревью» включается заметно позже.

### 11.8. Нет due — «адаптив» ≠ интервальное повторение

Карта с высоким mastery почти не выпадает **в этой сессии**, но между сессиями нет календаря.  
Stale-boost поднимает вес только если `lastSeenAt` старше 3ч и уже были события — «забытые» но никогда не отвеченные держатся на unseen/seen-only ветках.

### 11.9. Live restore искажает latency / fluency

После restore `shownAt = now`. Быстрый ответ сразу после восстановления даёт fluency bonus «как будто вспомнил быстро», хотя карта могла висеть минутами до ухода со страницы.

### 11.10. `session.mode` vs `preferences.pickMode`

Сессия запоминает mode при старте, но vocab picker читает **текущие preferences**.  
Смена режима в сайдбаре mid-session мгновенно меняет алгоритм (в т.ч. полное отключение очереди ошибок в even).

### 11.11. Фильтры mid-session vs замороженный пул

Reconcile при смене уровня/фильтров может пересобрать или сузить `poolIds`, прыгнуть на `poolIds[0]` и снова вызвать `seen`.  
Несогласованность «фильтр в prefs» vs «старые id в session» — источник сюрпризов в mid-session.

### 11.12. Homographs / variantIds

Stats ключ — primary `card.id`. Hide/learn часто смотрят `variantIds`.  
Смена identity / merge правок может оставить «сиротскую» статистику или не туда привязать прогресс.

### 11.13. Confusion boost бесполезен для слов

Код общий с каной; для vocab множитель почти всегда 1. Ожидать «путать похожие слова» от этого слоя нельзя.

### 11.14. Hyperparams vocab нельзя крутить

Кана может уехать настройками пользователя; слова всегда на дефолтах. Расхождение ощущений между тренажёрами — ожидаемо.

### 11.15. Нет жёсткого infinite loop в picker

Всегда есть fallback (первый кандидат / uniform). «Застревание» — мягкое: одна слабая карта + очередь + высокий вес будет часто возвращаться (by design), но не зависать в `while`.

### 11.16. Mastery floor ≠ исчезновение из ревью

Даже «пенсия» (`masteredWeight=0.04`) оставляет шанс появления. Полное исчезновение только через exclude / hide / weight 0 (и то с оговоркой §11.6).

---

## 12. Связанный UI

| UI | Файл | Влияние на алгоритм |
|----|------|---------------------|
| Список «Слова в тренировке» + exclude | `VocabSetupPool.tsx` | состав `poolIds` |
| Сайдбар сессии: веса 0/100/200%, even/adaptive, +слово, JLPT | `VocabSessionSidebar.tsx` | multipliers, режим pick, рост пула |
| Space / стрелки | `VocabPractice` / shell swipes | hint / skip |
| Контекст | `features/context/picker.ts` | **другой** алгоритм, не этот отчёт |

---

## 13. Карта ключевых файлов

| Путь | Роль |
|------|------|
| `src/shared/lib/trainer.ts` | гиперпараметры, mastery, вес, `pickNextCardId` |
| `src/shared/lib/trainerCore.ts` | mistake queue, cooldown после успеха, `prepareShownCard` |
| `src/shared/lib/types.ts` | `StatsRecord`, `PracticeSession`, live session |
| `src/features/vocab/pool.ts` | пул, even/weighted pick, +слово |
| `src/features/vocab/VocabTrainer.tsx` | оркестрация ответов / скипов / resume |
| `src/features/vocab/VocabSessionSidebar.tsx` | веса и режим |
| `src/shared/state/vocab-slice.ts` | persist stats / live |
| `src/shared/state/slices/live-session.ts` | sanitize restore |
| `tests/unit/trainer.test.ts` | контракты алгоритма |
| `tests/unit/vocab-pool.test.ts` | пул / weighted pick |
| `tests/e2e/vocab.spec.js` | скипы без скоринга |

---

## 14. Сжатая формула архитектуры

```
Пул (фильтры + popularity/order + newWordLimit + setup exclude)
  → freeze poolIds
  → на каждый переход:
        mistake-queue? → иначе first-pass? → иначе temperature-weighted mastery
  → на ответ:
        wrong/hint/correct обновляют mastery;
        hint/correct двигают очередь и кулдауны
  → skip / голое открытие подсказки:
        почти не трогают mastery;
        но крутят session pacing (history / showCounts / cooldowns)
```

**Итог:** это не календарный SRS, а **сессионный адаптивный дрилллер** с долгоживущим mastery. Он хорошо давит слабые карты внутри сессии; его легко «обмануть» скипами и подсказками без ответа; его легко «перекосить» submit-wrong→hint и нулевыми весами; между сессиями он опирается на mastery/stale, а не на due-dates.
