"""Environment configuration. Mutable economy rules live in the settings table."""

import os
from pathlib import Path

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/gamehub.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
DATA_DIR = Path(os.getenv("DATA_DIR", "data"))
DEFAULT_RULES = {
    "activity_seconds": 60,
    "activity_reward": 100,
    "heartbeat_seconds": 15,
    "idle_seconds": 120,
    "lease_seconds": 35,
    "minimum_bet": 1000,
    "maximum_bet": 50000,
    "betting_seconds": 45,
    "match_seconds": 120,
    "html_limit_mb": 20,
    "cover_limit_mb": 2,
    "paused": False,
}
INITIAL_CREDIT = 10000
TICK_RATE = 20
SNAPSHOT_RATE = 10
SIMULATION_VERSION = "2.0"
