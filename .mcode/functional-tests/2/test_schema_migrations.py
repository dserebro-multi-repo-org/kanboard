"""M2 functional tests: the TS app migrates a SQLite DB to the PHP schema (app/Schema/Sqlite.php)."""
import json, os, shutil, sqlite3, subprocess, tempfile, time
import pytest, requests

REPO = os.path.join(os.environ.get("WORKSPACE_DIR", "/l2l/workspace"), "kanboard")
PHP_VERSION = 128
PORT = 18082


def php_db(path, upto):
    """Build a DB with the original PHP schema functions 1..upto."""
    script = f"""<?php
require '{REPO}/vendor/autoload.php';
require '{REPO}/app/Schema/Sqlite.php';
$pdo = new PDO('sqlite:{path}');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('PRAGMA foreign_keys = OFF');
for ($i = 1; $i <= {upto}; $i++) {{
    $f = '\\Schema\\version_'.$i;
    if (function_exists($f)) {{ $pdo->beginTransaction(); $f($pdo); $pdo->exec('PRAGMA user_version='.$i); $pdo->commit(); }}
}}
"""
    p = path + ".php"
    open(p, "w").write(script)
    r = subprocess.run(["php", p], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr + r.stdout


def start_app(db, port=PORT):
    env = dict(os.environ, PORT=str(port), HOST="127.0.0.1", DB_DRIVER="sqlite", DB_FILENAME=db,
               DATA_DIR=os.path.dirname(db), DB_RUN_MIGRATIONS="true")
    proc = subprocess.Popen(["node", "dist/server.js"], cwd=REPO, env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(100):
        try:
            if requests.get(f"http://127.0.0.1:{port}/healthcheck", timeout=2).status_code == 200:
                return proc
        except requests.RequestException:
            pass
        if proc.poll() is not None:
            break
        time.sleep(0.3)
    out = proc.stdout.read().decode() if proc.poll() is not None else ""
    proc.kill()
    raise AssertionError("app did not become healthy: " + out[-2000:])


def stop(proc):
    proc.terminate()
    proc.wait(10)


def rows(db, sql):
    c = sqlite3.connect(db)
    try:
        return c.execute(sql).fetchall()
    finally:
        c.close()


def structure(db):
    c = sqlite3.connect(db)
    out = {}
    names = [r[0] for r in c.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%' and name!='schema_version'")]
    for n in names:
        cols = [(r[1], r[2].upper(), r[3], r[5]) for r in c.execute(f'pragma table_info("{n}")')]
        fks = sorted((r[2], r[3], r[4], r[5], r[6]) for r in c.execute(f'pragma foreign_key_list("{n}")'))
        idx = sorted((r[2], tuple(x[2] for x in c.execute(f'pragma index_info("{r[1]}")'))) for r in c.execute(f'pragma index_list("{n}")') if not r[1].startswith("sqlite_autoindex") or True)
        out[n] = {"cols": cols, "fks": fks, "idx": idx}
    c.close()
    return out


@pytest.fixture(scope="module")
def workdir():
    d = tempfile.mkdtemp(prefix="ftrun_m2_")
    yield d
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture(scope="module")
def fresh(workdir):
    db = os.path.join(workdir, "fresh.sqlite")
    proc = start_app(db)
    yield db
    stop(proc)


@pytest.fixture(scope="module")
def reference(workdir):
    db = os.path.join(workdir, "php.sqlite")
    php_db(db, PHP_VERSION)
    return db


def test_fresh_db_reaches_latest_version(fresh):
    assert rows(fresh, "select version from schema_version") == [(PHP_VERSION,)]


def test_healthcheck_after_migration(fresh):
    assert requests.get(f"http://127.0.0.1:{PORT}/healthcheck", timeout=5).json()["status"] == 200


def test_same_tables_as_php(fresh, reference):
    assert sorted(structure(fresh)) == sorted(structure(reference))


def test_columns_match_php(fresh, reference):
    a, b = structure(fresh), structure(reference)
    diffs = {t: (a[t]["cols"], b[t]["cols"]) for t in b if t in a and a[t]["cols"] != b[t]["cols"]}
    assert not diffs, json.dumps(diffs)[:3000]


def test_foreign_keys_match_php(fresh, reference):
    a, b = structure(fresh), structure(reference)
    diffs = {t: (a[t]["fks"], b[t]["fks"]) for t in b if t in a and a[t]["fks"] != b[t]["fks"]}
    assert not diffs, json.dumps(diffs)[:3000]


def test_indexes_match_php(fresh, reference):
    a, b = structure(fresh), structure(reference)
    diffs = {t: (a[t]["idx"], b[t]["idx"]) for t in b if t in a and a[t]["idx"] != b[t]["idx"]}
    assert not diffs, json.dumps(diffs)[:3000]


def test_seed_settings_match_php(fresh, reference):
    skip = ("api_token", "webhook_token", "application_url")
    q = "select option, value from settings order by option"
    f = {k: v for k, v in rows(fresh, q) if k not in skip}
    r = {k: v for k, v in rows(reference, q) if k not in skip}
    assert f == r


def test_default_admin_user(fresh, reference):
    q = "select username, role, is_ldap_user, name, email, password from users"
    f, r = rows(fresh, q), rows(reference, q)
    assert [x[:5] for x in f] == [x[:5] for x in r]
    assert f[0][0] == "admin" and f[0][5]


def test_default_seed_tables_match_php(fresh, reference):
    for t in ["link", "project_has_categories", "custom_filters", "default_swimlanes"]:
        pass
    for t in ["links", "actions", "project_role_has_restrictions", "swimlanes", "columns"]:
        q = f"select count(*) from {t}"
        assert rows(fresh, q) == rows(reference, q), t
    q = "select label, opposite_id from links order by id"
    assert rows(fresh, q) == rows(reference, q)


def test_idempotent_restart(workdir, fresh):
    db = os.path.join(workdir, "fresh.sqlite")
    before = rows(db, "select count(*) from sqlite_master")
    p = start_app(db, PORT + 1)
    try:
        assert rows(db, "select version from schema_version") == [(PHP_VERSION,)]
        assert rows(db, "select count(*) from sqlite_master") == before
    finally:
        stop(p)


@pytest.mark.parametrize("start", [60, 100, 127])
def test_upgrade_php_db(workdir, reference, start):
    """A DB created by PHP up to version N (user_version=N) is upgraded by the TS app to latest."""
    db = os.path.join(workdir, f"up{start}.sqlite")
    php_db(db, start)
    assert rows(db, "pragma user_version") == [(start,)]
    p = start_app(db, PORT + 2)
    try:
        assert rows(db, "select version from schema_version") == [(PHP_VERSION,)]
        a, b = structure(db), structure(reference)
        assert sorted(a) == sorted(b)
        diffs = [t for t in b if a[t]["cols"] != b[t]["cols"]]
        assert not diffs, diffs
    finally:
        stop(p)
