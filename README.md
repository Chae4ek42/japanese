# Тренажёр японской каны и слов

React + Vite фронтенд, Express API и PostgreSQL для сохранения прогресса, словаря и статистики.

## Быстрый старт (Docker)

```bash
docker compose up --build
```

Приложение: [http://localhost:8080](http://localhost:8080)

Сервисы:
- **web** — nginx + собранный фронтенд, прокси `/api` → API
- **api** — Node.js API
- **db** — PostgreSQL 16

Остановка:

```bash
docker compose down
```

Данные Postgres сохраняются в volume `pgdata`.

## Локальная разработка

### Только фронт (localStorage fallback)

```bash
npm install
npm run dev
```

Если API недоступен, прогресс сохраняется в браузере как раньше.

### Фронт + API + Postgres

```bash
docker compose up db -d
cd server && npm install && cd ..
set DATABASE_URL=postgres://jp:jp@localhost:5432/jp
npm run dev:api
npm run dev
```

Vite проксирует `/api` на `http://127.0.0.1:3000`.

## Сборка слов

```bash
npm run build:words
```

## Тесты

```bash
npm run test:unit
npm run test:e2e
```

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/health` | Проверка API и БД |
| POST | `/api/users` | Создать пользователя и пустое состояние |
| GET | `/api/users/:id/state` | Загрузить состояние |
| PUT | `/api/users/:id/state` | Сохранить состояние (JSON) |
| DELETE | `/api/users/:id/state` | Сбросить прогресс |

Состояние хранится в PostgreSQL как JSONB: настройки, статистика каны, история, словарь и пользовательские слова.

При первом подключении к API данные из старого `localStorage` автоматически переносятся в базу.
