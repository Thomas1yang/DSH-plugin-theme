#!/usr/bin/env bash
# Serve the plugin market index and the plugin repository over HTTP, for use
# before the repository is published to GitHub.
#
# The index URL may use http, but the market format requires a Git source URL
# to use https, so this script also serves the repository over https with a
# self-signed certificate that git is told to trust.
#
# Usage:
#   ./serve-local.sh [http-port] [https-port]
#
# The index is written to ../market-index.json with its Git source pointed at
# the local server, so the Discover tab can install the plugin from here.

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
HTTP_PORT="${1:-8099}"
HTTPS_PORT="${2:-8443}"
SERVE_ROOT="$REPO_ROOT/.local-market"

mkdir -p "$SERVE_ROOT"

echo "==> preparing the local repository"
rm -rf "$SERVE_ROOT/Thomas1yang"
mkdir -p "$SERVE_ROOT/Thomas1yang"
git clone --bare "$REPO_ROOT" "$SERVE_ROOT/Thomas1yang/DSH-plugin.git" 2>&1 | tail -1

echo "==> preparing the certificate"
if [ ! -f "$SERVE_ROOT/cert.pem" ]; then
  openssl req -x509 -newkey rsa:2048 -keyout "$SERVE_ROOT/key.pem" -out "$SERVE_ROOT/cert.pem" \
    -days 365 -nodes -subj "/CN=127.0.0.1" -addext "subjectAltName=IP:127.0.0.1" 2>/dev/null
fi
git config --global http.sslCAInfo "$SERVE_ROOT/cert.pem"

echo "==> writing the index"
COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD)"
node "$HERE/build-market-index.mjs" \
  --repo "Thomas1yang/DSH-plugin" \
  --out "$SERVE_ROOT/market-index.json" >/dev/null

# Point the index's Git source at this local server, so the Discover tab can
# install the plugin from here.
python3 - "$SERVE_ROOT/market-index.json" "$HTTPS_PORT" "$COMMIT" <<'PYEOF'
import json
import sys

path, https_port, commit = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path) as handle:
    index = json.load(handle)
for version in index['plugins'][0]['versions']:
    version['source']['url'] = f'https://127.0.0.1:{https_port}/Thomas1yang/DSH-plugin.git'
    version['source']['commit'] = commit
with open(path, 'w') as handle:
    json.dump(index, handle, indent=2, ensure_ascii=False)
print(f"  source: https://127.0.0.1:{https_port}/Thomas1yang/DSH-plugin.git")
print(f"  commit: {commit}")
PYEOF

echo "==> serving"
exec python3 - "$HTTP_PORT" "$HTTPS_PORT" "$SERVE_ROOT" <<'PYEOF'
import http.server
import os
import ssl
import subprocess
import sys
import threading

http_port = int(sys.argv[1])
https_port = int(sys.argv[2])
root = sys.argv[3]

backend = "/opt/homebrew/opt/git/libexec/git-core/git-http-backend"
if not os.path.exists(backend):
    exec_path = subprocess.run(["git", "--exec-path"], capture_output=True, text=True).stdout.strip()
    backend = os.path.join(exec_path, "git-http-backend")


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _run_backend(self):
        path, _, query = self.path.partition("?")
        env = dict(os.environ)
        env["GIT_PROJECT_ROOT"] = root
        env["GIT_HTTP_EXPORT_ALL"] = "1"
        env["PATH_INFO"] = path
        env["QUERY_STRING"] = query
        env["REQUEST_METHOD"] = self.command
        env["REMOTE_USER"] = ""
        env["REMOTE_ADDR"] = self.client_address[0]
        env["CONTENT_TYPE"] = self.headers.get("Content-Type", "")
        env["HTTP_GIT_PROTOCOL"] = self.headers.get("Git-Protocol", "")
        length = int(self.headers.get("Content-Length", "0") or 0)
        body = self.rfile.read(length) if length else b""
        proc = subprocess.run([backend], env=env, input=body, capture_output=True)
        if proc.returncode != 0:
            self.send_error(500, proc.stderr.decode("utf-8", "replace"))
            return
        raw = proc.stdout
        header_blob, _, payload = raw.partition(b"\r\n\r\n")
        headers = []
        for line in header_blob.decode("utf-8", "replace").split("\r\n"):
            if not line.strip():
                continue
            key, _, value = line.partition(":")
            headers.append((key.strip(), value.strip()))
        status = 200
        content_type = None
        for key, value in headers:
            if key.lower() == "status":
                status = int(value.split()[0])
            elif key.lower() == "content-type":
                content_type = value
        self.send_response(status)
        for key, value in headers:
            if key.lower() in ("status", "content-type", "content-length", "transfer-encoding"):
                continue
            self.send_header(key, value)
        if content_type:
            self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path.split("?")[0] == "/market-index.json":
            with open(os.path.join(root, "market-index.json"), "rb") as handle:
                body = handle.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self._run_backend()

    def do_POST(self):
        self._run_backend()


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True


http_server = Server(("127.0.0.1", http_port), Handler)
https_server = Server(("127.0.0.1", https_port), Handler)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(os.path.join(root, "cert.pem"), os.path.join(root, "key.pem"))
https_server.socket = context.wrap_socket(https_server.socket, server_side=True)

threading.Thread(target=http_server.serve_forever, daemon=True).start()
sys.stderr.write(f"\nindex: http://127.0.0.1:{http_port}/market-index.json\n")
sys.stderr.write(f"git:   https://127.0.0.1:{https_port}/Thomas1yang/DSH-plugin.git\n\n")
https_server.serve_forever()
PYEOF
