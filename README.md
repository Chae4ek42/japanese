# Тренажёр японских чисел

React + Vite приложение для тренировки чтения чисел и возраста. Прогресс сохраняется в браузере (localStorage) или через опциональный локальный API.

## Быстрый старт

```bash
npm install
npm run dev
```

Приложение: [http://localhost:5173](http://localhost:5173)

## Локальный API (опционально)

Если нужна синхронизация через PostgreSQL:

```bash
cd server && npm install && cd ..
set DATABASE_URL=postgres://jp:jp@localhost:5432/jp
npm run dev:api
npm run dev
```

Vite проксирует `/api` на `http://127.0.0.1:3000`.

Без API прогресс сохраняется только в `localStorage`.

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

Состояние хранится как JSON: настройки и статистика тренажёра чисел.
