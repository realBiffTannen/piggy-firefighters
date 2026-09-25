#!/usr/bin/env python3
"""Local stand-in for the OpenAI images API (tests only). Behaviour per request is scripted by a queue file:
each line = status code to answer (200 -> a PNG). Logs path, content-type, auth-present, field names."""
import base64, io, json, os, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image

Q = sys.argv[2]
LOG = sys.argv[3]
lock = threading.Lock()


def png():
    b = io.BytesIO()
    Image.new("RGBA", (64, 64), (215, 38, 43, 254)).save(b, "PNG")
    return base64.b64encode(b.getvalue()).decode()


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n)
        with lock:
            lines = open(Q).read().split()
            code = int(lines[0]) if lines else 200
            open(Q, "w").write("\n".join(lines[1:]))
            ct = self.headers.get("Content-Type", "")
            fields = []
            if ct.startswith("multipart"):
                fields = sorted(set(x.split('"')[1] for x in body.decode("latin1").split("Content-Disposition: form-data; name=")[1:]))
            else:
                fields = sorted(json.loads(body).keys())
            with open(LOG, "a") as f:
                f.write(json.dumps({"path": self.path, "ct": ct.split(";")[0], "auth": self.headers.get("Authorization", "")[:7],
                                    "fields": fields, "code": code}) + "\n")
        if code == 200:
            out = json.dumps({"data": [{"b64_json": png()}], "model": "gpt-image-2.5-sunburst",
                              "usage": {"input_tokens": 10, "output_tokens": 20, "total_tokens": 30}}).encode()
        else:
            out = json.dumps({"error": {"message": f"mock {code} (Bearer sk-shouldbescrubbed123456)", "code": code}}).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)


ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
