"""Pick the Store implementation from settings."""

import logging
from functools import lru_cache

from companion.config import get_settings
from companion.db.store import InMemoryStore, Store

logger = logging.getLogger(__name__)


@lru_cache
def get_store() -> Store:
    url = get_settings().database_url
    if url:
        from companion.db.postgres import PostgresStore

        return PostgresStore(url)
    logger.warning("DATABASE_URL not set: using in-memory store (data is lost on restart).")
    return InMemoryStore()
