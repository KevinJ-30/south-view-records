import io
import os
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image

MODEL = os.environ["KRAKEN_MODEL"]
PORT = int(os.environ.get("PORT", "5000"))
MAX_BYTES = 20 * 1024 * 1024


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path != "/health":
            self.send_error(404)
            return
        self.respond(200, "ok")

    def do_POST(self) -> None:
        if self.path != "/recognize":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BYTES:
            self.respond(400, "Image is missing or larger than 20 MB")
            return
        try:
            text = recognize(self.rfile.read(length))
        except subprocess.TimeoutExpired:
            self.respond(504, "Kraken recognition timed out")
            return
        except subprocess.CalledProcessError as error:
            message = (error.stderr or error.stdout or "Kraken recognition failed").strip()
            self.respond(502, message[-2000:])
            return
        except Exception as error:
            self.respond(400, str(error))
            return
        if not text.strip():
            self.respond(502, "Kraken finished without transcription text")
            return
        self.respond(200, text)

    def respond(self, status: int, text: str) -> None:
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:
        print(f"{self.address_string()} {format % args}", flush=True)


def prepare(image: Image.Image) -> Image.Image:
    image = image.convert("RGB")
    long_side = max(image.size)
    if long_side < 1400:
        image = image.resize((image.width * 2, image.height * 2), Image.Resampling.LANCZOS)
    return image


def recognize(data: bytes) -> str:
    with tempfile.TemporaryDirectory() as tmp:
        image_path = Path(tmp) / "page.png"
        output_path = Path(tmp) / "page.txt"
        with Image.open(io.BytesIO(data)) as image:
            prepare(image).save(image_path, format="PNG")
        result = subprocess.run(
            [
                "kraken",
                "-i",
                str(image_path),
                str(output_path),
                "segment",
                "-bl",
                "ocr",
                "-m",
                MODEL,
            ],
            capture_output=True,
            text=True,
            timeout=600,
        )
        if result.returncode != 0:
            raise subprocess.CalledProcessError(
                result.returncode,
                result.args,
                result.stdout,
                result.stderr,
            )
        if not output_path.exists():
            return ""
        lines = [line.strip() for line in output_path.read_text(encoding="utf-8").splitlines()]
        return "\n".join(line for line in lines if line)


if __name__ == "__main__":
    if not Path(MODEL).is_file():
        raise SystemExit(f"Recognition model not found: {MODEL}")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Kraken listening on {PORT} with {MODEL}", flush=True)
    server.serve_forever()
