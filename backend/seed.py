from pathlib import Path
from shutil import copyfile

from sqlalchemy import select

from shared.config import DATA_DIR
from shared.db import SessionLocal
from shared.game_bridge import instrument_html
from shared.models import Category, Game, GameVersion, Team, TeamPlayer, User, Wallet
from simulation.scheduling import ensure_calendar

TEAM_NAMES = [
    "Север",
    "Метеор",
    "Волна",
    "Искра",
    "Орион",
    "Вектор",
    "Атлас",
    "Рассвет",
    "Тайфун",
    "Рубиновые лисы",
    "Полюс",
    "Комета",
]
COLORS = [
    "#58bde9",
    "#ff9f56",
    "#5adbb5",
    "#f3cf69",
    "#a89cfc",
    "#f58db9",
    "#82c7f0",
    "#e7a866",
    "#5db7ad",
    "#ec737a",
    "#9eafbf",
    "#cbe082",
]


def seed():
    (DATA_DIR / "games").mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "covers").mkdir(parents=True, exist_ok=True)
    with SessionLocal.begin() as db:
        if not db.scalar(select(Category.id).limit(1)):
            db.add_all([Category(name=name) for name in ["Аркады", "Головоломки", "На реакцию"]])
        author = db.scalar(select(User).where(User.external_id == "system:demo"))
        if not author:
            author = User(external_id="system:demo", login="GameHub", role="author")
            db.add(author)
            db.flush()
            db.add(Wallet(user_id=author.id))
        db.flush()
        for index, (slug, title, description) in enumerate(
            [
                (
                    "snake",
                    "Змейка",
                    "Собирайте светящиеся точки, растите и не врезайтесь в собственный хвост. Управление стрелками или кнопками на экране.",
                ),
                (
                    "memory",
                    "Парные карточки",
                    "Найдите восемь пар символов за минимальное количество ходов. Спокойная тренировка памяти.",
                ),
                (
                    "reaction",
                    "Точный момент",
                    "Дождитесь зелёного сигнала и нажмите на поле. Проверьте свою реакцию в пяти раундах.",
                ),
            ]
        ):
            cover_name = f"demo-{slug}.png"
            copyfile(Path("demo-games/covers") / f"{slug}.png", DATA_DIR / "covers" / cover_name)
            existing = db.scalar(
                select(Game).where(Game.title == title, Game.author_id == author.id)
            )
            if existing:
                if not existing.cover:
                    existing.cover = cover_name
                continue
            game = Game(
                author_id=author.id,
                title=title,
                description=description,
                category_id=index + 1,
                tags=["Офлайн", "Для всех"],
                status="published",
                cover=cover_name,
            )
            db.add(game)
            db.flush()
            version = GameVersion(game_id=game.id, filename=f"demo-{slug}.html")
            db.add(version)
            (DATA_DIR / "games" / version.filename).write_bytes(
                instrument_html((Path("demo-games") / f"{slug}.html").read_bytes())
            )
        for index, name in enumerate(TEAM_NAMES):
            existing_team = db.scalar(select(Team).where(Team.name == name))
            style = ["press", "counter", "possession", "vertical", "wide", "compact"][index % 6]
            if existing_team:
                # Upgrade only untouched seeded profiles; frozen match snapshots are immutable.
                if (
                    existing_team.revision == 1
                    and existing_team.tactic == ["balanced", "press", "counter"][index % 3]
                ):
                    existing_team.tactic = style
                    existing_team.revision = 2
                continue
            team = Team(
                name=name,
                color=COLORS[index],
                tactic=style,
                revision=2,
                attributes={
                    key: 55 + (index * 7 + offset * 3) % 16
                    for offset, key in enumerate(
                        [
                            "speed",
                            "passing",
                            "shot_power",
                            "shot_accuracy",
                            "defense",
                            "keeper",
                            "stamina",
                            "pressing",
                        ]
                    )
                },
            )
            db.add(team)
            db.flush()
            for number in range(1, 6):
                db.add(
                    TeamPlayer(
                        team_id=team.id,
                        number=number,
                        role="keeper" if number == 1 else "defender" if number < 4 else "forward",
                    )
                )
        db.flush()
        ensure_calendar(db)
