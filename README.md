# GameHub

Портал HTML-игр и общая футбольная трансляция для локальной сети. React + TypeScript,
Flask, PostgreSQL, Redis, отдельный Python-симулятор и nginx. Все ресурсы работают
локально. Очки виртуальные: покупок, вывода и переводов нет.

## Быстрый запуск для разработки

Нужны Docker Engine с Compose v2 и Python 3.11+ для генерации локального `.env`.

```bash
python scripts/dev_env.py
docker compose up -d --build
```

Откройте **http://localhost:8080**. В явно включённом development mock можно войти
с любым непустым логином; `denied` демонстрирует отказ. Имена регистрозависимы.
Три демонстрационные игры и 12 команд создаются автоматически. Первый расчёт
коэффициентов может занять несколько секунд — ставки откроются только после него.

Игры загружаются с **http://games.localhost:8081**, другого hostname. Современный
Chromium разрешает `*.localhost` в loopback. Если окружение этого не делает,
добавьте `127.0.0.1 games.localhost` в hosts. Не заменяйте адрес на другой порт
того же hostname: cookies изолируются по имени хоста, а не по порту.

Первый администратор: сначала войдите на сайте под выбранным логином, затем:

```bash
docker compose exec backend python -m backend.manage admin ВАШ_ЛОГИН
```

Это меняет роль существующего профиля, не создаёт способ обхода авторизации.
Обновите страницу. Через админпанель можно выдать право автора другим профилям.

## Production и локальная сеть

1. Скопируйте `.env.example` в `.env`, задайте случайные `POSTGRES_PASSWORD` и
   `SECRET_KEY` (например, `python -c "import secrets; print(secrets.token_hex(32))"`).
2. Оставьте `APP_ENV=production`. **Mock в production запрещён на уровне кода.**
3. Получите контракт существующего API и настройте адаптер по
   [docs/auth.md](docs/auth.md). До настройки новые входы отклоняются с понятной ошибкой.
4. Заведите два DNS-имени: например `gamehub.lan` и `games.gamehub.lan`, оба на сервер.
   `GAME_ORIGIN=http://games.gamehub.lan:8081`. Cookie остаётся host-only.
5. Для HTTPS настройте TLS на обоих origin и `COOKIE_SECURE=true`.
6. Выполните `docker compose up -d --build`. PostgreSQL и Redis наружу не публикуются.

## Документация

- [Архитектура и руководство разработчика](docs/development.md)
- [Подключение авторизации](docs/auth.md)
- [Экономика, активность и ставки](docs/economy.md)
- [Футбольная симуляция](docs/simulation.md)
- [HTTP API и realtime](docs/api.md)
- [Обновление, резервные копии, офлайн-перенос](docs/operations.md)
- [Проверки и ограничения](docs/verification.md)

Визуальный ориентир: frontend [ZavodMusic](https://github.com/Slediks/ZavodMusic/tree/master/frontend).
Изучены локальные `index.css`, AppLayout и AlbumCard. Использованы заданные цвета,
системный шрифт, характер границ и карточек; интерфейс и функции написаны для GameHub.

## Проверки

```bash
python -m venv .venv
# Активируйте venv подходящей командой для своей ОС.
pip install -r requirements.lock
pytest -q
ruff check backend shared simulation scripts
ruff format --check backend shared simulation scripts
cd frontend
npm ci
npm run lint
npm run build
npm test
npm run test:e2e
```

Playwright использует Chromium (`npx playwright install chromium` на машине подготовки).
Для установленного Edge задайте `PLAYWRIGHT_CHANNEL=msedge`. Браузерные тесты требуют
запущенного development-стенда. При установке браузера в папку проекта задайте
PLAYWRIGHT_BROWSERS_PATH одинаково для установки и запуска тестов.

Проверка транзакций на отдельной PostgreSQL БД:

```bash
docker compose exec postgres createdb -U gamehub gamehub_test
docker compose -f compose.yaml -f deploy/compose.test.yaml --profile test run --rm tests
```

Тесты отказываются выполнять очистку БД, имя которой не заканчивается на `_test`.
Не используйте production URL для тестирования. Результаты фактических запусков —
в [docs/verification.md](docs/verification.md).
