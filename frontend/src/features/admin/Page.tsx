import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, date, points } from '../../shared/api';
import { useResource } from '../../shared/hooks';
import { ErrorBox, Loading, Pagination } from '../../shared/UI';
import type { Category, Game, Page, Team, Transaction, User } from '../../shared/types';

interface Overview {
  rules: Record<string, number | boolean>;
  metrics: Record<string, number>;
  teams: Team[];
  simulation: { phase?: string; match_id?: number; updated_at?: number; error?: string } | null;
  audit: { id: number; action: string; details: Record<string, unknown>; created_at: number }[];
}
const settingLabels: Record<string, string> = {
  activity_seconds: 'Секунд на начисление',
  activity_reward: 'Начисление, сотых очка',
  minimum_bet: 'Минимальная ставка, сотых',
  maximum_bet: 'Максимальная ставка, сотых',
  betting_seconds: 'Окно ставок, секунд',
  match_seconds: 'Длительность матча, секунд',
  html_limit_mb: 'HTML, МБ',
  cover_limit_mb: 'Обложка, МБ',
};
const attributeLabels: Record<string, string> = {
  speed: 'Скорость',
  passing: 'Точность передач',
  shot_power: 'Сила удара',
  shot_accuracy: 'Точность удара',
  defense: 'Защита',
  keeper: 'Вратарь',
  stamina: 'Выносливость',
  pressing: 'Прессинг',
};

export function AdminPage() {
  const { data, error, reload } = useResource<Overview>('/admin');
  const [tab, setTab] = useState('users'),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [message, setMessage] = useState(''),
    [success, setSuccess] = useState('');
  const users = useResource<Page<User>>(`/admin/users?q=${encodeURIComponent(query)}&page=${page}`);
  const games = useResource<Page<Game>>(`/admin/games?page=${page}`);
  const reviews = useResource<
    Page<{ game_id: string; user_id: string; text: string; hidden: boolean }>
  >(`/admin/reviews?page=${page}`);
  const categories = useResource<Page<Category>>('/categories');
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  async function action(name: string, payload: unknown) {
    setMessage('');
    setSuccess('');
    try {
      await api(`/admin/${name}`, 'POST', payload);
      await Promise.all([
        reload(),
        users.reload(),
        games.reload(),
        reviews.reload(),
        categories.reload(),
      ]);
      setSuccess('Изменения сохранены');
      return true;
    } catch (error) {
      setMessage((error as Error).message);
      return false;
    }
  }
  if (!data) return error ? <ErrorBox message={error} /> : <Loading />;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">УПРАВЛЕНИЕ GAMEHUB</div>
          <h1>Панель администратора</h1>
          <p>Пользователи, контент, экономика и трансляция.</p>
        </div>
      </div>
      <ErrorBox message={message || error} />
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
      <div className="tabs">
        {[
          ['users', 'Пользователи'],
          ['content', 'Контент'],
          ['settings', 'Экономика'],
          ['teams', 'Команды'],
          ['simulation', 'Симулятор'],
          ['audit', 'Журнал'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'active' : ''}
            onClick={() => {
              setTab(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'users' && (
        <>
          <input
            aria-label="Поиск пользователей"
            placeholder="Поиск по логину"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {users.data?.items.map((user) => (
            <section className="panel admin-user" key={user.id}>
              <div className="section-heading">
                <h3>{user.login}</h3>
                <strong>{points(user.balance)} очков</strong>
              </div>
              <div className="actions">
                <label>
                  Роль
                  <select
                    value={user.role}
                    onChange={(e) =>
                      void action('role', { user_id: user.id, role: e.target.value })
                    }
                  >
                    <option value="user">Пользователь</option>
                    <option value="author">Автор</option>
                    <option value="admin">Администратор</option>
                  </select>
                </label>
                <button
                  onClick={async () => {
                    try {
                      const result = await api<Page<Transaction>>(
                        `/admin/users/${user.id}/transactions`,
                      );
                      setTransactions(result.items);
                    } catch (error) {
                      setMessage((error as Error).message);
                    }
                  }}
                >
                  Операции
                </button>
              </div>
              <form
                className="adjustment"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void action('balance', {
                    user_id: user.id,
                    amount: Math.round(Number(form.get('amount')) * 100),
                    reason: form.get('reason'),
                    request_id: crypto.randomUUID(),
                  });
                }}
              >
                <label>
                  Корректировка, очки
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    required
                    placeholder="+10 или −10"
                  />
                </label>
                <label>
                  Причина
                  <input name="reason" required maxLength={1000} />
                </label>
                <button>Применить</button>
              </form>
            </section>
          ))}
          {transactions && (
            <section className="panel">
              <div className="section-heading">
                <h2>Последние операции профиля</h2>
                <button onClick={() => setTransactions(null)}>Закрыть</button>
              </div>
              {transactions.map((row) => (
                <div className="stat-row" key={row.id}>
                  <span>
                    {date(row.created_at)} · {row.kind} · {row.reason}
                  </span>
                  <strong>{points(row.amount)}</strong>
                </div>
              ))}
            </section>
          )}
          <Pagination
            page={page}
            setPage={setPage}
            total={(users.data?.items.length ?? 0) < 24 ? page * 24 : undefined}
          />
        </>
      )}
      {tab === 'content' && (
        <>
          <section className="panel">
            <h2>Категории</h2>
            {categories.data?.items.map((category) => (
              <form
                className="inline-form"
                key={category.id}
                onSubmit={(event) => {
                  event.preventDefault();
                  void action('category', {
                    id: category.id,
                    name: new FormData(event.currentTarget).get('name'),
                  });
                }}
              >
                <input
                  aria-label="Название категории"
                  name="name"
                  defaultValue={category.name}
                  required
                />
                <button>Переименовать</button>
              </form>
            ))}
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void action('category', { name: new FormData(event.currentTarget).get('name') });
              }}
            >
              <input
                aria-label="Новая категория"
                name="name"
                required
                placeholder="Новая категория"
              />
              <button>Добавить</button>
            </form>
          </section>
          <h2>Игры и авторы</h2>
          {games.data?.items.map((game) => (
            <div className="list-row" key={game.id}>
              <div>
                <Link to={`/games/${game.id}`}>
                  <strong>{game.title}</strong>
                </Link>
                <p className="muted">
                  {game.author} · {game.status}
                </p>
              </div>
              <button
                onClick={() =>
                  void action('game', { game_id: game.id, hidden: game.status !== 'hidden' })
                }
              >
                {game.status === 'hidden' ? 'Вернуть в черновики' : 'Скрыть'}
              </button>
            </div>
          ))}
          <h2>Отзывы</h2>
          {reviews.data?.items.map((review) => (
            <div className="list-row" key={review.game_id + review.user_id}>
              <p>{review.text}</p>
              <button
                onClick={() =>
                  void action('review', {
                    game_id: review.game_id,
                    user_id: review.user_id,
                    hidden: !review.hidden,
                  })
                }
              >
                {review.hidden ? 'Показать' : 'Скрыть'}
              </button>
            </div>
          ))}
          <Pagination page={page} setPage={setPage} />
        </>
      )}
      {tab === 'settings' && (
        <>
          <section className="panel">
            <h2>Правила экономики и матчей</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void action(
                  'settings',
                  Object.fromEntries(
                    Object.keys(settingLabels).map((key) => [key, Number(form.get(key))]),
                  ),
                );
              }}
            >
              <div className="form-grid">
                {Object.entries(settingLabels).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      name={key}
                      defaultValue={Number(data.rules[key])}
                      required
                    />
                  </label>
                ))}
              </div>
              <p className="muted">
                Изменения футбольных правил применяются до открытия ставок. В открытом матче правила
                зафиксированы.
              </p>
              <button className="primary">Сохранить правила</button>
            </form>
          </section>
          <h2>Операции экономики, очки</h2>
          <div className="metrics">
            {Object.entries(data.metrics).map(([kind, amount]) => (
              <div className="panel" key={kind}>
                <span>
                  {(
                    {
                      welcome: 'Стартовые начисления',
                      activity: 'За активность',
                      bet: 'Списано на ставки',
                      payout: 'Выплаты',
                      refund: 'Возвраты',
                      adjustment: 'Корректировки',
                    } as Record<string, string>
                  )[kind] ?? kind}
                </span>
                <strong>{points(amount)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'teams' && (
        <div className="team-editor-grid">
          {data.teams.map((team) => (
            <section className="panel" key={team.id}>
              <h2 style={{ color: team.color }}>{team.name}</h2>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void action('team', {
                    id: team.id,
                    tactic: form.get('tactic'),
                    attributes: Object.fromEntries(
                      Object.keys(team.attributes).map((key) => [key, Number(form.get(key))]),
                    ),
                  });
                }}
              >
                <div className="form-grid">
                  {Object.entries(team.attributes).map(([key, value]) => (
                    <label key={key}>
                      {attributeLabels[key]}
                      <input name={key} type="number" min={40} max={80} defaultValue={value} />
                    </label>
                  ))}
                </div>
                <label>
                  Тактика
                  <select name="tactic" defaultValue={team.tactic}>
                    <option value="balanced">Сбалансированная</option>
                    <option value="press">Прессинг</option>
                    <option value="counter">Контратаки</option>
                    <option value="possession">Контроль мяча</option>
                    <option value="vertical">Вертикальная игра</option>
                    <option value="wide">Через фланги</option>
                    <option value="compact">Компактная защита</option>
                  </select>
                </label>
                <button>Сохранить команду</button>
              </form>
            </section>
          ))}
        </div>
      )}
      {tab === 'simulation' && (
        <section className="panel">
          <h2>Состояние трансляции</h2>
          <p>Фаза: {data.simulation?.phase ?? 'Нет свежего статуса'}</p>
          <p>Обновлено: {date(data.simulation?.updated_at ?? null)}</p>
          <ErrorBox message={data.simulation?.error ?? ''} />
          <div className="actions">
            <button onClick={() => void action('settings', { paused: !data.rules.paused })}>
              {data.rules.paused ? 'Возобновить новые матчи' : 'Приостановить после текущего матча'}
            </button>
            <button onClick={() => void reload()}>Обновить статус</button>
          </div>
          <form
            className="cancel-form"
            onSubmit={(event) => {
              event.preventDefault();
              void action('cancel', {
                match_id: Number(new FormData(event.currentTarget).get('match_id')),
              });
            }}
          >
            <h3>Техническая отмена с возвратом ставок</h3>
            <label>
              Номер матча
              <input
                type="number"
                name="match_id"
                min={1}
                required
                defaultValue={data.simulation?.match_id}
              />
            </label>
            <label className="checkbox">
              <input type="checkbox" required />
              Подтверждаю отмену матча и возврат ставок
            </label>
            <button className="danger">Отменить матч</button>
          </form>
        </section>
      )}
      {tab === 'audit' && (
        <div className="item-list">
          {data.audit.map((event) => (
            <div className="panel" key={event.id}>
              <strong>{event.action}</strong>
              <p className="muted">{date(event.created_at)}</p>
              <pre>{JSON.stringify(event.details, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
