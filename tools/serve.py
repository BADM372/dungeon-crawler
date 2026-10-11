#!/usr/bin/env python3
"""No-cache dev server for the game. In a git worktree, /assets/* comes from the
main checkout, everything else from this worktree. Override with --assets-root.
Usage: uv run --no-project tools/serve.py [port] [--assets-root REPO]
"""
import argparse
import http.server
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent


def default_assets_root():
    try:
        common = subprocess.run(
            ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
            cwd=ROOT, text=True, capture_output=True, check=True,
        ).stdout.strip()
        main = Path(common).parent
        if (main / "assets").is_dir():
            return main
    except (OSError, subprocess.CalledProcessError):
        pass
    return ROOT


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    assets = ROOT / "assets"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        local = Path(super().translate_path(path))
        if local.is_relative_to(ROOT / "assets"):
            asset = (self.assets / local.relative_to(ROOT / "assets")).resolve()
            # Do not follow an asset symlink out of the designated asset directory.
            if asset.is_relative_to(self.assets):
                return str(asset)
            return str(ROOT / ".not-served")
        return str(local)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("port", nargs="?", type=int, default=8000)
    parser.add_argument("--assets-root", type=Path, default=default_assets_root(), help="checkout containing assets/")
    parser.add_argument("--bind", default="127.0.0.1")
    args = parser.parse_args()
    NoCacheHandler.assets = (args.assets_root.expanduser().resolve() / "assets")
    if not NoCacheHandler.assets.is_dir():
        parser.error("--assets-root must contain assets/")
    print(f"serving on http://{args.bind}:{args.port}/", flush=True)
    print(f"Assets: {NoCacheHandler.assets}", flush=True)
    http.server.ThreadingHTTPServer((args.bind, args.port), NoCacheHandler).serve_forever()
