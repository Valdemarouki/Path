"""Local Calendar rehearsal. Run from the generated bundle with Python 3."""
import argparse
import datetime as dt
from functools import partial
from http.server import ThreadingHTTPServer
import importlib.util
import json
import math
import re
from pathlib import Path
import socket
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
LEGACY_FIELDS = {"meeting", "deadline"}
V2_FIELDS = LEGACY_FIELDS | {"meetingTitle"}
FIELDS = V2_FIELDS | {"meetingImportance", "deadlineImportance"}
PRIORITIES = ("none", "low", "medium", "high")
MAX_PAYLOAD = 8 * 1024 * 1024
INITIAL_MEETING_TITLE = "Тестовая встреча"


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def valid_slot(slot):
    return (isinstance(slot, list) and len(slot) == 2 and all(type(n) is int for n in slot)
            and 946684800000 <= slot[0] < 4102444800000 and slot[0] % 60000 == 0
            and 1 <= slot[1] <= 10080)


def valid_title(text):
    return isinstance(text, str) and 0 < len(text.strip()) <= 500


def valid_event(key, event):
    if not re.fullmatch(r"event:[a-zA-Z0-9_-]{1,128}", key) or key in ("event:path-rehearsal-meeting", "event:path-rehearsal-deadline"):
        return False
    if event is None:
        return True
    if not isinstance(event, dict) or set(event) != {"title","type","importance","when","done","protected","notes","location","eventIcon","reminderMinutes"}:
        return False
    kind, when = event["type"], event["when"]
    if (not valid_title(event["title"]) or event["importance"] not in PRIORITIES
            or kind not in ("busy","routine","workout","focus","deadline","free_time")
            or event["eventIcon"] not in ("calendar","book","focus","sport","sun")
            or type(event["reminderMinutes"]) is not int or event["reminderMinutes"] < 0
            or any(type(event[k]) is not bool for k in ("done","protected"))
            or not isinstance(event["notes"],str) or len(event["notes"]) > 10000
            or not isinstance(event["location"],str) or len(event["location"]) > 500):
        return False
    if kind == "deadline":
        try:
            return isinstance(when,str) and dt.date.fromisoformat(when).isoformat() == when and not event["done"]
        except ValueError:
            return False
    return (isinstance(when,list) and len(when) == 3 and valid_slot(when[:2])
            and isinstance(when[2],str) and 0 < len(when[2]) <= 128)


COLLECTIONS = {"homeTasks":"title", "projects":"name", "notes":"title", "habits":"name",
               "canvases":"name", "focusRecords":"date"}
GROUP = "linked:sport-calendar"
GROUP_LISTS = {"events", "eventSeries", "workoutRecords", "workouts", "programs", "skillTests"}


def safe_tree(value, depth=0):
    if depth > 64:
        return False
    if isinstance(value, dict):
        return all(k not in ("__proto__", "constructor", "prototype") and safe_tree(item, depth+1)
                   for k, item in value.items())
    if isinstance(value, list):
        return all(safe_tree(item, depth+1) for item in value)
    return not isinstance(value, float) or math.isfinite(value)


def valid_entry(key, row):
    if key.startswith("event:"):
        return valid_event(key, row)
    if key in ("starter:deadline", "starter:meeting"):
        return row is None or (isinstance(row, dict) and "id" not in row)
    if key == "library:sport":
        return row is None or (isinstance(row, dict) and not row.keys() - {"sportsLibrary", "exercisePreferences"}
                               and all(isinstance(item, dict) for item in row.values()))
    if key == GROUP:
        if row is None:
            return True
        if not isinstance(row, dict) or row.keys() - GROUP_LISTS - {"activeWorkout"}:
            return False
        for name, items in row.items():
            if name not in GROUP_LISTS:
                if not isinstance(items, dict):
                    return False
            elif (not isinstance(items, list) or len(items) > 5000
                  or any(not isinstance(x,dict) or not isinstance(x.get("id"),str) or not x["id"] for x in items)
                  or len({x["id"] for x in items}) != len(items)):
                return False
        return True
    kind, _, ident = key.partition(":")
    if kind not in COLLECTIONS or not 0 < len(ident) <= 512:
        return False
    if row is None:
        return True
    if not isinstance(row,dict) or row.get("id") != ident:
        return False
    if not isinstance(row.get(COLLECTIONS[kind]),str):
        return False
    if kind == "notes":
        return row.get("kind") == "note" and isinstance(row.get("body"),str)
    if kind == "projects":
        return isinstance(row.get("tasks"),list)
    if kind == "canvases":
        return "viewport" not in row and all(isinstance(row.get(k),list) for k in ("nodes","edges"))
    return True


def valid_values(value):
    if not isinstance(value, dict) or not LEGACY_FIELDS.issubset(value):
        return False
    if not valid_slot(value["meeting"]) or not valid_title(value["deadline"]):
        return False
    if set(value) == LEGACY_FIELDS:
        return True
    if not V2_FIELDS.issubset(value) or not valid_title(value["meetingTitle"]):
        return False
    if set(value) == V2_FIELDS:
        return True
    return (FIELDS.issubset(value) and len(value) <= 5000 + len(FIELDS)
            and all(value[k] in PRIORITIES for k in ("meetingImportance","deadlineImportance"))
            and safe_tree(value) and all(valid_entry(k,value[k]) for k in value.keys() - FIELDS))


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
        initial = {"meeting": [int(instant) * 1000, 60], "meetingTitle": INITIAL_MEETING_TITLE, "deadline": "Сдать отчёт"}
        db.execute("INSERT INTO history VALUES(1,?)", (encode(initial),))
    db.commit()


def snapshot(db, rev=None):
    room, day = db.execute("SELECT room,day FROM metadata").fetchone()
    row = (db.execute("SELECT rev,payload FROM history ORDER BY rev DESC LIMIT 1") if rev is None else
           db.execute("SELECT rev,payload FROM history WHERE rev=?", (rev,))).fetchone()
    if not row:
        raise ValueError("revision")
    values = json.loads(row[1])
    # Older revisions predate title exchange. Preserve their IDs and receipts.
    values.setdefault("meetingTitle", INITIAL_MEETING_TITLE)
    values.setdefault("meetingImportance", "none")
    values.setdefault("deadlineImportance", "none")
    return dict(room=room, day=day, revision=row[0], values=values)


def exchange(db, job, version=None, view=None):
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
    for key, local in job["values"].items():
        remote = values.get(key)
        if key not in FIELDS and not key.startswith("event:") and (version != "4" or view not in ("mobile","desktop")):
            raise ValueError("protocol")
        if key.startswith("canvases:") and view != "desktop" and local != base.get(key):
            raise ValueError("Canvas is read-only on mobile")
        if local != base.get(key) or (key not in base and local is None):
            if remote != base.get(key) and local != remote:
                return 409, head
            values[key] = local
    revision = head["revision"]
    group = values.get(GROUP) or {}
    for event in group.get("events", []):
        if values.get("event:" + event["id"]) is not None or event["id"] in ("path-rehearsal-meeting","path-rehearsal-deadline"):
            raise ValueError("duplicate event")
    if values != head["values"]:
        revision += 1
        payload = encode(values)
        if len(payload.encode()) > MAX_PAYLOAD - 512 or len(values) > 5000 + len(FIELDS):
            raise ValueError("calendar capacity")
        db.execute("INSERT INTO history VALUES(?,?)", (revision,payload))
    db.execute("INSERT INTO receipt VALUES(?,?,?)", (job["id"], encode(job), revision))
    return 200, snapshot(db, revision)


class Handler(phone.PhoneHandler):
    def __init__(self, *args, database, **kwargs):
        self.database = database
        super().__init__(*args, **kwargs)

    def reply(self, code, data):
        version = self.headers.get("X-Path-Calendar-Version")
        if "values" in data and version != "4":
            keys = V2_FIELDS if version == "2" else LEGACY_FIELDS
            if version == "3":
                keys = FIELDS | {k for k in data["values"] if k.startswith("event:")}
            data = {**data, "values": {k: data["values"][k] for k in keys}}
        elif "values" in data:
            data = {**data, "protocol": 4}
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
            if not 0 < size <= MAX_PAYLOAD:
                return self.send_error(413)
            job = json.loads(self.rfile.read(size))
            with sqlite3.connect(self.database) as db:
                code, result = exchange(db, job, self.headers.get("X-Path-Calendar-Version"), self.headers.get("X-Path-View"))
            self.reply(code, result)
        except (ValueError, OverflowError, RecursionError):
            self.send_error(400)
        except sqlite3.Error:
            self.send_error(503)


def local_lan_address():
    candidates = set()
    for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET, socket.SOCK_STREAM):
        address = info[4][0]
        try:
            address = phone.validate_bind(address, True)
        except phone.SetupError:
            continue
        if not address.startswith("127."):
            candidates.add(address)
    if len(candidates) != 1:
        choices = ", ".join(sorted(candidates)) or "see ipconfig"
        raise phone.SetupError("Run Start.cmd with the home-network IPv4 address. Candidates: " + choices)
    return candidates.pop()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8443)
    parser.add_argument("--allow-lan", action="store_true")
    parser.add_argument("--cert", type=Path, required=True)
    parser.add_argument("--key", type=Path, required=True)
    args = parser.parse_args()
    if args.bind == "lan" and args.allow_lan:
        args.bind = local_lan_address()
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
        print(f"Open Path: https://{config.bind}:{config.port}/open.html", flush=True)
        print(f"Database: {dbpath}", flush=True)
        for client in ("desktop", "mobile"):
            print(f"{client}: https://{config.bind}:{config.port}/calendar-test/{client}/", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    try:
        main()
    except phone.SetupError as error:
        raise SystemExit(str(error)) from None
    except KeyboardInterrupt:
        pass
