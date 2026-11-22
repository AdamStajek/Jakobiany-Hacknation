from fastapi.testclient import TestClient

import main


def test_security_headers_present():
    main.security_headers.cache_clear()
    response = TestClient(main.app).get("/health")
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert "object-src 'none'" in response.headers["content-security-policy"]
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_inline_script_hash_from_index(tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text(
        "<script>var a=1</script><script src=\"main.js\"></script>", encoding="utf-8"
    )
    monkeypatch.setenv("WODO_SITE_DIR", str(tmp_path))
    hashes = main.inline_script_hashes()
    assert hashes.startswith("'sha256-") and hashes.count("sha256") == 1


def test_hsts_only_outside_dev(monkeypatch):
    monkeypatch.setenv("WODO_ENV", "production")
    main.security_headers.cache_clear()
    assert "Strict-Transport-Security" in main.security_headers()
    monkeypatch.setenv("WODO_ENV", "dev")
    main.security_headers.cache_clear()
    assert "Strict-Transport-Security" not in main.security_headers()
    main.security_headers.cache_clear()
