# JP тренажёры

Веб-приложение для практики японского: кана, кандзи (JLPT N5–N1 + Jōyō), числа, словарь и контекстные предложения. Прогресс тренировок и «Мои слова» хранятся локально в браузере (`localStorage`).

## Запуск

```bash
npm install
npm run dev
```

Откройте [http://localhost:5173](http://localhost:5173).

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Vite dev-сервер |
| `npm run typecheck` | TypeScript (`strict`) |
| `npm run build` | `tsc` + production-сборка |
| `npm run lint` | Oxlint |
| `npm run test:unit` | Unit-тесты (`node` + `tsx`) |
| `npm run test:e2e` | Playwright |
| `npm test` | unit + e2e |
| `npm run scrape:kanji-components` | Скрейп компонентов Kanshudo (локальный кэш) |
| `npm run russify:kanji` | Русификация текстов компонентов |
| `npm run build:kanji-bank` | Пересборка банка кандзи + слов + `components.json` |
| `npm run build:context-sentences` | Пересборка корпуса предложений для модуля «Контекст» |

## Структура

```
src/
  app/                 # App shell, routing by page
  features/
    home/              # Главная
    kana/              # Тренажёр каны
    numbers/           # Числа и возраст
    kanji/             # Таблица + тренажёр
    vocab/             # Словарь (каталог + мои слова + тренировка)
    context/           # Предложения i+N по теме
  shared/
    ui/                # AppHeader, PracticeShell, …
    lib/               # trainer engine, storage, speech, hooks
    state/             # AppState + Context
    styles/            # tokens + base
  data/                # kana, numbers, words bank, grammar starters
tests/
  unit/                # *.test.ts
  e2e/                 # Playwright specs по фичам
```

Состояние приложения — схема **v17** (`kana` / `numbers` / `kanji` / `vocab` / `context`). Старые ключи и версии мигрируются при загрузке через normalize.

## Маршруты

| URL | Раздел |
|-----|--------|
| `/` | Главная |
| `/kana` | Кана |
| `/kanji` | Кандзи |
| `/numbers` | Числа |
| `/vocab` | Словарь |
| `/vocab/train` | Тренировка слов |
| `/vocab/mine` | Мои слова |
| `/context` | Контекст (предложения) |

Навигация через History API; прямые ссылки и кнопки «Назад/Вперёд» работают. Для статического хостинга добавлены SPA-fallback (`public/_redirects`, `vercel.json`).

Опциональный LLM для генерации предложений: переменные `VITE_CONTEXT_LLM_*` в `.env` (см. `.env.example`).

## Банк кандзи

Полная цепочка данных:

```bash
# 1) Скрейп компонентов/заметок Kanshudo → .cache/kanshudo/
npm run scrape:kanji-components

# 2) Русификация → .cache/ru/components-ru.json
npm run russify:kanji

# 3) Сборка банка (OpenJLPT N5–N1 + Jōyō + JMDict-rus + компоненты)
npm run build:kanji-bank
```

Источники:

- **OpenJLPT** — уровни JLPT и базовые поля кандзи/словаря
- **joyo2010** — список Jōyō (~2136)
- **jmdict-simplified (rus)** — слова с русскими глоссами (EDRDG / CC-BY-SA)
- **Kanshudo** — локальный скрейп компонентов и публичных заметок (мнемоники за логином недоступны). Артефакты скрейпа (`.cache/kanshudo/`) **не публиковать** без проверки лицензий сайта; в репозиторий коммитится только пересобранный банк после ручной проверки.
- **KRADFILE (EDRDG)** — запасной граф разложения, если скрейп неполон
- **KanjiVG** (CC BY-SA 3.0) — SVG-контуры для подсветки графем при наведении

В UI карточки есть блок **«Состав»**: формула частей, русская заметка/мнемоника, клик по части открывает стек карточек, список «Используется в». Средний клик по знаку открывает карточку кандзи.

Фильтры на странице кандзи: **N5…N1 / Jōyō / все**.

Опция **«Только посильные слова»** показывает слова, где соседние кандзи уже изучены или не сложнее текущего уровня.

Озвучка — Web Speech API (`ja-JP`), без внешних ключей.
