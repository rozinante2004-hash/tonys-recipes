#!/usr/bin/env python3
"""Tony's Recipes — Local Save Helper"""
import http.server, json, base64, os, sys, threading
from pathlib import Path

PORT = 27182
DEFAULT_SAVE_DIR = Path.home() / 'Documents' / 'Projects' / 'Recipes App' / 'Backups'
ALLOWED_ORIGIN = 'https://rozinante2004-hash.github.io'
_server = None

class SaveHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200); self._cors(); self.end_headers()

    def do_GET(self):
        self.send_response(200); self._cors()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"ok":true,"status":"running"}')

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(length))

            # Ping
            if data.get('ping'):
                self.send_response(200); self._cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"ok":true,"status":"running"}')
                return

            # Stop signal
            if data.get('action') == 'stop':
                self.send_response(200); self._cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
                print('\n⏹  Stop signal received.')
                threading.Thread(target=lambda: _server.shutdown()).start()
                return

            # Save file — use directory from payload if provided
            filename = os.path.basename(data.get('filename', 'download'))
            file_bytes = base64.b64decode(data.get('data', ''))

            # Resolve save directory
            requested_dir = data.get('directory', '').strip()
            if requested_dir:
                save_dir = Path(requested_dir).expanduser()
            else:
                save_dir = DEFAULT_SAVE_DIR

            # Create directory if it doesn't exist
            try:
                save_dir.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                print(f'⚠️  Cannot create directory {save_dir}: {e} — falling back to ~/Downloads')
                save_dir = DEFAULT_SAVE_DIR
                save_dir.mkdir(exist_ok=True)

            save_path = save_dir / filename
            c = 1; stem = Path(filename).stem; suf = Path(filename).suffix
            while save_path.exists():
                save_path = save_dir / f"{stem} ({c}){suf}"; c += 1
            save_path.write_bytes(file_bytes)
            size_kb = len(file_bytes) // 1024
            print(f'✅ Saved: {save_path}  ({size_kb} KB)')

            self.send_response(200); self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'ok': True,
                'filename': save_path.name,
                'path': str(save_path),
                'directory': str(save_dir)
            }).encode())

        except Exception as e:
            print(f'❌ Error: {e}')
            self.send_response(500); self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode())

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, *a): pass

def main():
    global _server
    import socket
    DEFAULT_SAVE_DIR.mkdir(exist_ok=True)
    _server = http.server.HTTPServer(('127.0.0.1', PORT), SaveHandler)
    _server.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    print(f"🍴 Tony's Recipes Save Helper running on port {PORT}")
    print(f"   Default save directory: {DEFAULT_SAVE_DIR}")
    print(f"   (App can override per-export via ⚙️ → Save Helper)")
    try:
        _server.serve_forever()
    except KeyboardInterrupt:
        print('\n👋 Stopped.')
        sys.exit(0)

if __name__ == '__main__':
    main()
