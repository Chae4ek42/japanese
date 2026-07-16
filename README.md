# Тренажёры японского

React + Vite приложение: кана, кандзи JLPT N5–N3 и числа. Прогресс в `localStorage`.

## Быстрый старт

```bash
npm install
npm run dev
```

Приложение: [http://localhost:5173](http://localhost:5173)

## Банк кандзи и слов

Собран офлайн из OpenJLPT (списки кандзи/vocab) и JMDict rus (чтения и русские переводы):

```bash
npm run build:kanji-bank
```

В тренажёре кандзи есть опция **«Фильтр сложности»**: соседние кандзи в слове должны быть выученными или не сложнее целевого уровня JLPT.

Озвучка — через Web Speech API браузера (`ja-JP`), без внешних API-ключей.

## Тесты

```bash
npm run test:unit
npm run test:e2e
```
