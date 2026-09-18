# Эксплуатация и офлайн-развёртывание

Целевая среда — Linux с Docker Compose v2. Исходный код и образы можно подготовить
на подключённой машине; работающий сервер не обращается к CDN, внешним шрифтам,
аналитике или моделям. Внешний API авторизации должен быть доступен в локальной сети.

## Перенос на изолированный сервер

На машине подготовки с той же архитектурой CPU:

```bash
docker compose build backend nginx
docker pull postgres:16-alpine
docker pull redis:7-alpine
docker pull nginx:1.27-alpine
docker save -o gamehub-images.tar gamehub-backend:1.0 gamehub-frontend:1.0 \
  postgres:16-alpine redis:7-alpine nginx:1.27-alpine
sha256sum gamehub-images.tar > gamehub-images.tar.sha256
```

Передайте архив, контрольную сумму, compose.yaml, deploy/games.conf, .env.example
и документацию. Секреты .env создайте на сервере отдельно. Полный исходный код
также рекомендуется хранить рядом для сопровождения, но runtime не требует npm/pip.

```bash
sha256sum -c gamehub-images.tar.sha256
docker load -i gamehub-images.tar
# Настройте .env, DNS и реальную авторизацию.
docker compose up -d --no-build --pull never
docker compose ps
```

Postgres/Redis не имеют host-портов. Приложение слушает APP_PORT (8080), игровой
origin — GAMES_PORT (8081). Откройте только эти порты в локальной сети. Нужны два
имени хоста. Для TLS поставьте локальный reverse proxy с доверенным сертификатом
перед обоими origin; включите COOKIE_SECURE. Разрешение real-time Origin должно
сохранять исходный Host и scheme.

## Обновление

1. В админпанели приостановите новые матчи. Дождитесь текущего результата и расчёта.
2. Сделайте согласованную резервную копию.
3. Загрузите новые версионированные образы, замените теги в compose.
4. `docker compose run --rm migrate` применит миграции и идемпотентные начальные данные.
5. `docker compose up -d --no-build --pull never` и проверка `/api/health`.
6. Проверьте login, игру и футбол, возобновите новые матчи.

При изменении физики меняйте SIMULATION_VERSION, чтобы не переиспользовать старые
коэффициенты. Для production зафиксируйте digest образов после сборки. Не выполняйте
`docker compose down -v`, если нужны сохранённые данные.

## Резервное копирование

Скрипт рассчитан на Linux/bash. Он кратковременно останавливает процессы записи,
создаёт PostgreSQL custom-format dump и tar игровых файлов, затем запускает сервисы.
Для отсутствия отменённых матчей сначала дождитесь конца текущего матча с paused=true.

```bash
bash scripts/backup.sh backups/2026-09-17
```

Храните вместе `database.dump`, `games.tar.gz`, `SHA256SUMS`, версию образов и защищённую
копию конфигурации. В БД находятся сессии и профили: доступ к архиву должен быть ограничен.
Периодически проверяйте восстановление на отдельном сервере/проекте Compose.

## Восстановление

На отдельном чистом стенде с соответствующей версией образов и .env:

```bash
docker compose up -d postgres redis
docker compose stop nginx backend simulation
docker compose exec -T postgres pg_restore -U gamehub -d gamehub --clean --if-exists < backups/2026-09-17/database.dump
docker compose run --rm --no-deps -T backend tar -C /data -xzf - < backups/2026-09-17/games.tar.gz
docker compose run --rm migrate
docker compose up -d --no-build --pull never
```

Команда pg_restore заменяет данные целевой БД содержимым резервной копии. Запускайте
её только на выбранном стенде восстановления. Сохраняйте исходную копию неизменной.
Новые миграции применяются после восстановления. При восстановлении live/penalties
симулятор отменяет матч и возвращает ставки, если результат не был надёжно сохранён.
Повторный запуск recover не повторяет выплаты.

## Наблюдение

```bash
docker compose ps
docker compose logs --tail 100 backend simulation
docker compose exec backend alembic current
```

`/api/health` проверяет БД и Redis. Отдельный healthcheck симулятора проверяет его
обновляемый ключ; подробный статус и последняя ошибка доступны в админпанели.
Симулятор при потере БД/Redis прекращает работу, что приводит к восстановлению
при автоматическом перезапуске. При отсутствии auth API уже созданные сессии
продолжают жить до своего срока, новые входы закрыты.

Начальные образы содержат тестовые инструменты для воспроизводимости. Для более
компактного production-образа можно отделить dev lock после завершения приёмки.
Запущенный local dev mock и тестовые профили предназначены только для проверки;
они не являются production-учётными записями.
