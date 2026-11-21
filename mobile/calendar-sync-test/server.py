"""Local Calendar rehearsal. Run from the generated bundle with Python 3."""
import argparse
import datetime as dt
from functools import partial
from http.server import ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import sqlite3
import ssl
import sys
import uuid

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("path_phone_helper", HERE / "serve-phone.py")
phone = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = phone
spec.loader.exec_module(phone)
API = "/calendar-test/api"
FIELDS = {"meeting", "deadline"}


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def valid_values(value):
    if not isinstance(value, dict) or set(value) != FIELDS:
        return False
    title, slot = value["deadline"], value["meeting"]
    return (isinstance(title, str) and 0 < len(title.strip()) <= 500 and
            isinstance(slot, list) and len(slot) == 2 and all(type(n) is int for n in slot) and
            946684800000 <= slot[0] < 4102444800000 and slot[0] % 60000 == 0 and
            1 <= slot[1] <= 10080)


def initialize(db):
    db.executescript("""
      CREATE TABLE IF NOT EXISTS history(rev INTEGER PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata(room TEXT NOT NULL, day TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS receipt(id TEXT PRIMARY KEY, request TEXT NOT NULL, rev INTEGER NOT NULL);
    """)
    db.execute("BEGIN IMMEDIATE")
    if not db.execute("SELECT 1 FROM metadata").fetchone():
        day = dt.date.today()
        instant = dt.datetime.combine(day, dt.time(10)).timestamp()
        db.execute("INSERT INTO metadata VALUES(?,?)", (str(uuid.uuid4()), day.isoformat()))
        db.execute("INSERT INTO history VALUES(1,?)", (encode(dict(meeting=[int(instant)*1000, 60], deadline="Сдать отчёт")),))
    db.commit()


def snapshot(db, rev=None):
    room, day = db.execute("SELECT room,day FROM metadata").fetchone()
    row = (db.execute("SELECT rev,payload FROM history ORDER BY rev DESC LIMIT 1") if rev is None else
           db.execute("SELECT rev,payload FROM history WHERE rev=?", (rev,))).fetchone()
    if not row:
        raise ValueError("revision")
    return dict(room=room, day=day, revision=row[0], values=json.loads(row[1]))


def exchange(db, job):
    db.execute("BEGIN IMMEDIATE")
    head = snapshot(db)
    if not isinstance(job, dict) or set(job) != {"room","revision","id","values"} or not valid_values(job["values"]):
        raise ValueError("request")
    if job["room"] != head["room"]:
        return 409, {"error":"otherRoom"}
    if type(job["revision"]) is not int or not 1 <= job["revision"] <= head["revision"]:
        raise ValueError("revision")
    if not isinstance(job["id"], str) or str(uuid.UUID(job["id"])) != job["id"]:
        raise ValueError("operation")
    prior = db.execute("SELECT request,rev FROM receipt WHERE id=?", (job["id"],)).fetchone()
    if prior:
        if prior[0] != encode(job):
            raise ValueError("operation reused")
        return 200, snapshot(db, prior[1])
    base = snapshot(db, job["revision"])["values"]
    values = dict(head["values"])
    for key in FIELDS:
        local, remote = job["values"][key], values[key]
        if local != base[key]:
            if remote != base[key] and local != remote:
                return 409, head
            values[key] = local
    revision = head["revision"]
    if values != head["values"]:
        revision += 1
        db.execute("INSERT INTO history VALUES(?,?)", (revision,encode(values)))
    db.execute("INSERT INTO receipt VALUES(?,?,?)", (job["id"], encode(job), revision))
    return 200, snapshot(db, revision)


class Handler(phone.PhoneHandler):
    def __init__(self, *args, database, **kwargs):
        self.database = database
        super().__init__(*args, **kwargs)

    def reply(self, code, data):
        body = encode(data).encode()
        self.send_headers(code, "application/json; charset=utf-8", len(body))
        self.wfile.write(body)

    def do_GET(self):
        if self.path != API:
            return super().do_GET()
        with sqlite3.connect(self.database) as db:
            self.reply(200, snapshot(db))

    def do_POST(self):
        origin = "https://" + self.headers.get("Host", "")
        if self.path != API or self.headers.get("Origin") != origin or self.headers.get_content_type() != "application/json":
            return self.send_error(403)
        try:
            size = int(self.headers.get("Content-Length", 0))
            if not 0 < size <= 8192:
                return self.send_error(413)
            job = json.loads(self.rfile.read(size))
            with sqlite3.connect(self.database) as db:
                code, result = exchange(db, job)
            self.reply(code, result)
        except (ValueError, OverflowError):
            self.send_error(400)
        except sqlite3.Error:
            self.send_error(503)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8443)
    parser.add_argument("--allow-lan", action="store_true")
    parser.add_argument("--cert", type=Path, required=True)
    parser.add_argument("--key", type=Path, required=True)
    args = parser.parse_args()
    args.directory = HERE / "www"
    args.public_ca = None
    config = phone.prepare(args, ("calendar-test/desktop/index.html", "calendar-test/mobile/index.html", "calendar-test/sw.js"))
    tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    tls.minimum_version = ssl.TLSVersion.TLSv1_2
    tls.load_cert_chain(config.cert, config.key)
    dbpath = HERE / "calendar-test.sqlite"
    with sqlite3.connect(dbpath) as db:
        initialize(db)
    with ThreadingHTTPServer((config.bind, config.port), partial(Handler, config=config, database=dbpath)) as server:
        server.socket = tls.wrap_socket(server.socket, server_side=True)
        for client in ("desktop", "mobile"):
            print(f"{client}: https://{config.bind}:{config.port}/calendar-test/{client}/", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
