# JP тренажёры

Веб-приложение для практики японского: кана, кандзи JLPT N5–N3, числа и словарь. Прогресс и «Мои слова» хранятся локально в браузере (`localStorage`).

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
| `npm run build:kanji-bank` | Пересборка банка кандзи |

## Структура

```
src/
  app/                 # App shell, routing by page
  features/
    home/              # Главная
    kana/              # Тренажёр каны
    numbers/           # Числа и возраст
    kanji/             # Таблица + тренажёр + банк данных
    vocab/             # Словарь (каталог + мои слова)
    stats/             # Прогресс
  shared/
    ui/                # AppHeader, PracticeShell, …
    lib/               # trainer engine, storage, speech, hooks
    state/             # AppState v11 + Context
    styles/            # tokens + base
  data/                # kana, numbers
tests/
  unit/                # *.test.ts
  app.spec.js          # e2e
```

Состояние приложения — схема **v13** (`kana` / `numbers` / `kanji` / `vocab` с тренировкой). Старые ключи и версии мигрируются при загрузке.

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
| `/stats` | Прогресс |

Навигация через History API; прямые ссылки и кнопки «Назад/Вперёд» работают. Для статического хостинга добавлены SPA-fallback (`public/_redirects`, `vercel.json`).


## Банк кандзи

Данные собираются из OpenJLPT и JMDict (русские глоссы):

```bash
npm run build:kanji-bank
```

Опция **«Только посильные слова»** показывает слова, где соседние кандзи уже изучены или не сложнее текущего уровня.

Озвучка — Web Speech API (`ja-JP`), без внешних ключей.
