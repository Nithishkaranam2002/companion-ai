"""Apply SQL migrations in supabase/migrations. Run: uv run python -m companion.db.migrate"""

from pathlib import Path

import psycopg

from companion.config import get_settings
from companion.db.postgres import clean_dsn

MIGRATIONS = Path(__file__).resolve().parents[3] / "supabase" / "migrations"


def main() -> None:
    url = get_settings().database_url_direct or get_settings().database_url
    if not url:
        raise SystemExit("Set DATABASE_URL (or POSTGRES_URL) to run migrations.")
    with psycopg.connect(clean_dsn(url), autocommit=True) as conn:
        conn.execute("create table if not exists public._migrations "
                     "(name text primary key, applied_at timestamptz default now())")
        conn.execute("alter table public._migrations enable row level security")
        done = {r[0] for r in conn.execute("select name from public._migrations")}
        for path in sorted(MIGRATIONS.glob("*.sql")):
            if path.name in done:
                continue
            with conn.transaction():
                conn.execute(path.read_text())
                conn.execute("insert into public._migrations (name) values (%s)", (path.name,))
            print(f"applied {path.name}")
    print("migrations up to date")


if __name__ == "__main__":
    main()
