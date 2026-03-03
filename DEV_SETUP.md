# World Monitor — Dev Environment Setup

## ✅ Завершено

### 1. Форк и клонирование
```bash
cd ~/Projects/forks
gh repo fork koala73/worldmonitor --clone
```
**Форк:** https://github.com/bendertheclaw/worldmonitor

### 2. Настройка окружения
```bash
cp .env.example .env.local
# Минимальная конфигурация для dev:
VITE_VARIANT=full
VITE_MAP_INTERACTION_MODE=3d
```

### 3. Установка зависимостей
```bash
npm install
# Результат: 936 пакетов установлено
```

### 4. Запуск dev-сервера
```bash
npm run dev
# URL: http://localhost:3000/
```

## 🏗️ Архитектура проекта

```
worldmonitor/
├── src/              # Frontend (React + TypeScript + Vite)
├── api/              # Backend API endpoints
├── convex/           # Convex DB для регистраций
├── server/           # Server-side utilities
├── scripts/          # Build & utility scripts
├── src-tauri/        # Desktop app (Tauri)
├── e2e/              # Playwright тесты
└── public/           # Static assets
```

## 🔧 Варианты сборки

- `full` — полный World Monitor (геополитика, военные, конфликты)
- `tech` — Tech Monitor (стартапы, AI, облака, кибербезопасность)
- `finance` — Finance Monitor (рынки, банки, торговля)
- `happy` — Happy Monitor (хорошие новости)

```bash
# Запуск конкретного варианта
npm run dev:tech
npm run dev:finance
npm run dev:happy
```

## 🔑 Опциональные API-ключи

Для полной функциональности добавь в `.env.local`:

| Ключ | Для чего | Где взять |
|------|----------|-----------|
| `GROQ_API_KEY` | AI-суммаризация | https://console.groq.com |
| `FINNHUB_API_KEY` | Акции и рынки | https://finnhub.io |
| `UPSTASH_REDIS_*` | Кэш | https://upstash.com |
| `AISSTREAM_API_KEY` | Корабли AIS | https://aisstream.io |

## 🚀 Команды

```bash
# Dev сервер
npm run dev

# Build
npm run build
npm run build:tech
npm run build:finance

# Desktop (Tauri)
npm run desktop:dev
npm run desktop:build:full

# Тесты
npm run test:e2e
npm run test:e2e:full
```

## 📝 Готов к разработке!

- ✅ Fork на GitHub
- ✅ Локальный репозиторий
- ✅ Dev-сервер запущен
- ✅ Push changes ready

**Следующие шаги:**
1. Вносить изменения в `src/`
2. Коммитить: `git commit -m "feat: ..."`
3. Пушить: `git push origin main`
