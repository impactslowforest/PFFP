#!/usr/bin/env python3
"""
PFFP Google Sheets → PocketBase Sync Script (v2)
Syncs 5 collections from Google Sheets to PocketBase every 5 minutes.
Run via systemd timer on VPS.

Usage: python3 sheets-sync-v2.py
"""
import json, urllib.request, urllib.error, sys, time, os, fcntl, atexit
from datetime import datetime

# === CONFIG ===
# IMPORTANT: Replace with your deployed Apps Script Web App URL
SHEETS_API = "https://script.google.com/macros/s/AKfycbzaxHXkb_93oYKeTNYScj_wmHW8WpFgeqiX8b0UABbxgZEiAuals-k2Ov1amybdqcOivw/exec"
PB_API = "http://127.0.0.1:8095/api/collections"
LOG_FILE = "/var/log/pffp-sync.log"
LOCK_FILE = "/tmp/pffp-sync.lock"

# Sync map: Apps Script action → PocketBase collection
SYNC_MAP = [
    ("getFarmers",       "farmers"),
    ("getPlots",         "plots"),
    ("getYearlyData",    "yearly_data"),
    ("getSupported",     "supported"),
    ("getSurvivalCheck", "survival_check"),
]

# ID fields for each PB collection
ID_FIELDS = {
    "farmers":        "Farmer_ID",
    "plots":          "Plot_Id",
    "yearly_data":    "Record_Id",
    "supported":      "Support_ID",
    "survival_check": "Check_ID",
}

# Number fields per collection (PB rejects strings for number fields)
NUMBER_FIELDS = {
    "farmers": [
        "Num_Household_Members", "Num_Working_Members", "Total_Coffee_Area",
        "Total_Area_registered", "Number_of_coffee_farm_plots",
    ],
    "plots": [
        "Area_ha", "Num_Shade_Trees_Before", "Num_Coffee_Trees",
        "Number_of_shade_trees", "Number_of_shade_tree_species",
    ],
    "yearly_data": [
        "Annual_Volume_Cherry", "Volume_High_Quality", "Total_Coffee_Income",
        "Fertilizer_volume", "Fertilizer_cost", "Pesticides_volume",
        "Pesticides_cost", "Herbicides_volume", "Herbicides_cost",
        "Hired_Labor_Costs", "Other_Costs", "Number_Shade_Trees_Planted",
        "Shade_Trees_Died", "Survival",
        "Cherry_sales_registered_to_Slow", "Cherry_sales_supplied_to_Slow",
        "Revenue_from_cherry_sales_to_Slow", "Cherry_bought_by_Slow_thru_processor",
    ],
    "supported": ["Quantity"],
    "survival_check": ["Trees_Alive", "Survival_Rate"],
}


# === LOGGING ===
def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = "[{}] {}".format(timestamp, msg)
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


# === LOCK FILE ===
_lock_fd = None

def acquire_lock():
    global _lock_fd
    _lock_fd = open(LOCK_FILE, "w")
    try:
        fcntl.flock(_lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except IOError:
        log("Another sync is running. Exiting.")
        sys.exit(0)
    _lock_fd.write(str(os.getpid()))
    _lock_fd.flush()
    atexit.register(release_lock)

def release_lock():
    global _lock_fd
    if _lock_fd:
        try:
            fcntl.flock(_lock_fd, fcntl.LOCK_UN)
            _lock_fd.close()
            os.unlink(LOCK_FILE)
        except Exception:
            pass


# === HTTP HELPERS ===
def fetch_json(url, timeout=120, retries=1):
    """Fetch JSON with retry."""
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            if attempt < retries:
                log("  Retry in 5s: {}".format(str(e)[:80]))
                time.sleep(5)
            else:
                raise


def pb_request(url, data=None, method="GET", timeout=30):
    """PocketBase API request."""
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(
            url, data=body,
            headers={"Content-Type": "application/json"},
            method=method
        )
    else:
        req = urllib.request.Request(url, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        if resp.status in (200, 201, 204):
            body = resp.read()
            return json.loads(body) if body else {}
    return {}


# === DATA HELPERS ===
def normalize_value(val):
    """Normalize value for comparison."""
    if val is None or val == "":
        return ""
    if isinstance(val, bool):
        return str(val).lower()
    if isinstance(val, (int, float)):
        if val == 0:
            return "0"
        if isinstance(val, float) and val == int(val):
            return str(int(val))
        return str(val)
    s = str(val).strip()
    return s


def coerce_numbers(record, collection):
    """Convert string values to numbers for PB number fields."""
    num_fields = NUMBER_FIELDS.get(collection, [])
    for field in num_fields:
        if field in record:
            val = record[field]
            if val == "" or val is None:
                record[field] = 0
            elif isinstance(val, str):
                try:
                    record[field] = float(val) if "." in val else int(val)
                except (ValueError, TypeError):
                    record[field] = 0
    return record


def records_differ(sheets_rec, pb_rec, id_field):
    """Check if sheets record differs from PB record."""
    for key, val in sheets_rec.items():
        if key == id_field:
            continue
        pb_val = pb_rec.get(key)
        if normalize_value(val) != normalize_value(pb_val):
            return True
    return False


# === FETCH FUNCTIONS ===
def fetch_sheets_data(action):
    """Fetch data from Google Sheets via Apps Script."""
    url = "{}?action={}".format(SHEETS_API, action)
    result = fetch_json(url, timeout=120, retries=1)
    if result.get("status") != "success":
        raise Exception("Sheets API error: {}".format(result.get("message", "unknown")))
    return result.get("data", [])


def fetch_pb_records(collection):
    """Fetch all records from PocketBase."""
    all_items = []
    page = 1
    per_page = 500
    while True:
        url = "{}/{}/records?perPage={}&page={}".format(PB_API, collection, per_page, page)
        data = fetch_json(url, timeout=30)
        items = data.get("items", [])
        all_items.extend(items)
        if len(all_items) >= data.get("totalItems", 0):
            break
        page += 1
    return all_items


# === SYNC LOGIC ===
def sync_collection(sheets_action, pb_collection):
    """Sync one collection from Sheets to PocketBase."""
    log("  {} → {}".format(sheets_action, pb_collection))

    id_field = ID_FIELDS.get(pb_collection)
    if not id_field:
        log("    ERROR: No ID field for {}".format(pb_collection))
        return {"created": 0, "updated": 0, "deleted": 0, "skipped": 0, "errors": 0}

    # Fetch from both sources
    sheets_data = fetch_sheets_data(sheets_action)
    pb_data = fetch_pb_records(pb_collection)

    # Build maps keyed by business ID
    sheets_map = {}
    for rec in sheets_data:
        key = str(rec.get(id_field, "")).strip()
        if key:
            sheets_map[key] = rec

    pb_map = {}
    for rec in pb_data:
        key = str(rec.get(id_field, "")).strip()
        if key:
            pb_map[key] = rec

    stats = {"created": 0, "updated": 0, "deleted": 0, "skipped": 0, "errors": 0}

    # CREATE / UPDATE
    for key, sheets_rec in sheets_map.items():
        pb_rec = pb_map.get(key)
        try:
            # Coerce number fields
            sheets_rec = coerce_numbers(sheets_rec, pb_collection)

            if not pb_rec:
                # Create new record
                url = "{}/{}/records".format(PB_API, pb_collection)
                pb_request(url, data=sheets_rec, method="POST")
                stats["created"] += 1
            elif records_differ(sheets_rec, pb_rec, id_field):
                # Update existing
                url = "{}/{}/records/{}".format(PB_API, pb_collection, pb_rec["id"])
                pb_request(url, data=sheets_rec, method="PATCH")
                stats["updated"] += 1
            else:
                stats["skipped"] += 1
        except Exception as e:
            if stats["errors"] < 5:
                log("    ERR {}: {}".format(key, str(e)[:120]))
            stats["errors"] += 1

    # DELETE orphans (in PB but not in Sheets)
    for key, pb_rec in pb_map.items():
        if key not in sheets_map:
            try:
                url = "{}/{}/records/{}".format(PB_API, pb_collection, pb_rec["id"])
                pb_request(url, method="DELETE")
                stats["deleted"] += 1
            except Exception as e:
                if stats["errors"] < 5:
                    log("    ERR delete {}: {}".format(key, str(e)[:120]))
                stats["errors"] += 1

    log("    +{} ~{} -{} ={} !{}".format(
        stats["created"], stats["updated"], stats["deleted"],
        stats["skipped"], stats["errors"]
    ))
    return stats


# === MAIN ===
def main():
    # Acquire lock
    acquire_lock()

    start_time = time.time()
    log("=" * 60)
    log("PFFP Sync Start")
    log("=" * 60)

    # Check API URL
    if "REPLACE" in SHEETS_API:
        log("ERROR: SHEETS_API not configured! Edit the script.")
        sys.exit(1)

    total = {"created": 0, "updated": 0, "deleted": 0, "skipped": 0, "errors": 0}

    for sheets_action, pb_collection in SYNC_MAP:
        try:
            stats = sync_collection(sheets_action, pb_collection)
            for k in total:
                total[k] += stats.get(k, 0)
        except Exception as e:
            log("  ERROR {}: {}".format(pb_collection, str(e)[:200]))
            total["errors"] += 1

    elapsed = time.time() - start_time
    log("-" * 60)
    log("DONE: +{} ~{} -{} ={} !{} ({:.1f}s)".format(
        total["created"], total["updated"], total["deleted"],
        total["skipped"], total["errors"], elapsed
    ))
    log("=" * 60)

    sys.exit(1 if total["errors"] > 0 else 0)


if __name__ == "__main__":
    main()
