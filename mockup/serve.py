#!/usr/bin/env python3
"""Dev server for the mockup: serves the repo root without browser caching, so edited ES
modules are always picked up. Run from anywhere:  python3 mockup/serve.py [port]
then open http://localhost:8000/mockup/game.html"""
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    print(f"serving on http://localhost:{port}/mockup/game.html")
    http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
