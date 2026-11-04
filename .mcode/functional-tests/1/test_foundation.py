import os, sqlite3, requests, pytest

BASE = os.environ.get("BASE_URL", "http://localhost:8080")
DB = os.path.join(os.environ.get("WORKSPACE_DIR", "/l2l/workspace"), "kanboard", "data", "db.sqlite")


@pytest.fixture(autouse=True, scope="session")
def up():
    assert requests.get(BASE + "/healthcheck", timeout=10).status_code == 200


def q(sql):
    c = sqlite3.connect(DB)
    try:
        return c.execute(sql).fetchall()
    finally:
        c.close()


@pytest.mark.parametrize("path", ["/healthcheck", "/healthcheck.php"])
def test_healthcheck(path):
    r = requests.get(BASE + path, timeout=10)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")
    assert r.json() == {"status": 200, "message": "Database connection is OK"}


def test_home_page_settings():
    r = requests.get(BASE + "/", timeout=10)
    assert r.status_code == 200 and "text/html" in r.headers["content-type"]
    for needle in ["application_language", "en_US", "application_timezone", "UTC", "m/d/Y", "board_highlight_period", "172800"]:
        assert needle in r.text


def test_home_matches_db_settings():
    html = requests.get(BASE + "/", timeout=10).text
    for k, v in q("select option, value from settings where option in ('application_currency','default_color','board_private_refresh_interval')"):
        assert f"<th scope=\"row\">{k}</th><td>{v}</td>" in html


def test_not_found():
    r = requests.get(BASE + "/does-not-exist", timeout=10)
    assert r.status_code == 404


def test_jsonrpc_method_not_found():
    r = requests.post(BASE + "/jsonrpc.php", json={"jsonrpc": "2.0", "method": "getVersion", "id": 7}, timeout=10)
    body = r.json()
    assert body["jsonrpc"] == "2.0" and body["error"]["code"] == -32601 and body["id"] == 7


def test_jsonrpc_invalid_body():
    r = requests.post(BASE + "/jsonrpc.php", data="garbage", headers={"Content-Type": "application/json"}, timeout=10)
    assert r.json()["error"]["code"] == -32700  # JSON-RPC 2.0 parse error


def test_jsonrpc_get_not_routed():
    assert requests.get(BASE + "/jsonrpc.php", timeout=10).status_code == 404


def test_schema_version():
    assert q("select version from schema_version")[0][0] == 128


def test_schema_tables():
    names = {r[0] for r in q("select name from sqlite_master where type='table'")}
    for t in ["users", "projects", "tasks", "columns", "settings", "schema_version", "comments", "swimlanes", "groups", "tags"]:
        assert t in names


def test_default_settings_rows():
    s = dict(q("select option, value from settings"))
    assert s["application_language"] == "en_US"
    assert s["application_timezone"] == "UTC"
    assert s["application_date_format"] == "m/d/Y"
    assert s["board_highlight_period"] == "172800"
    assert s["default_color"] == "yellow"
    assert len(s["api_token"]) == 60


def test_default_admin_user():
    rows = q("select username, role, is_active from users")
    assert ("admin", "app-admin", 1) in rows
