import csv
import math
from collections import defaultdict
from datetime import datetime

FILES = [
    r"c:\dev\AOIrail\server\sql\taalk-20260325-20260406.csv",
    r"c:\dev\AOIrail\server\sql\85a8249f-e3ce-47e4-8004-5d4a06330648.csv",
]


def normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else ""


def parse_timestamp(date_str: str, time_str: str):
    try:
        t = (time_str or "").strip().strip('"')
        return datetime.strptime(f"{date_str} {t}", "%m/%d/%Y %I:%M:%S %p")
    except Exception:
        return None


rows = []
for fp in FILES:
    with open(fp, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for d in reader:
            ts = parse_timestamp((d.get("Date") or "").strip(), (d.get("Time") or "").strip())
            if ts is None:
                continue
            phone = normalize_phone(d.get("Phone") or "")
            if not phone:
                continue
            market = (d.get("Taalk_Market") or "").strip() or "Unknown"
            transferred = ((d.get("Transferred") or "").strip().upper() == "YES")
            rows.append((ts, phone, market, transferred))

rows.sort(key=lambda x: x[0])

# Attempts counted per (phone, market), until first transfer for that (phone, market).
seen_attempts = defaultdict(int)
first_transfer_attempt = {}
total_sightings = defaultdict(int)

for ts, phone, market, transferred in rows:
    key = (phone, market)
    total_sightings[key] += 1
    if key in first_transfer_attempt:
        continue
    seen_attempts[key] += 1
    if transferred:
        first_transfer_attempt[key] = seen_attempts[key]

by_market = defaultdict(list)
by_market_before = defaultdict(list)
by_market_total_all = defaultdict(list)
by_market_total_transferred = defaultdict(list)

for (phone, market), total in total_sightings.items():
    by_market_total_all[market].append(total)

for (phone, market), attempt in first_transfer_attempt.items():
    by_market[market].append(attempt)
    by_market_before[market].append(attempt - 1)
    by_market_total_transferred[market].append(total_sightings[(phone, market)])

print(f"phones_with_transfer={len(first_transfer_attempt)}")
print("market,count_transferred,avg_seen_before_transfer,avg_attempt_at_transfer,avg_total_seen_transferred,avg_total_seen_all_phones")
for market in sorted(by_market):
    vals = by_market[market]
    before_vals = by_market_before[market]
    total_transferred_vals = by_market_total_transferred[market]
    total_all_vals = by_market_total_all[market]
    n = len(vals)
    avg_attempt = sum(vals) / n
    avg_before = sum(before_vals) / n
    avg_total_transferred = sum(total_transferred_vals) / n
    avg_total_all = sum(total_all_vals) / len(total_all_vals)
    print(
        f"{market},{n},{avg_before:.2f},{avg_attempt:.2f},{avg_total_transferred:.2f},{avg_total_all:.2f}"
    )

# Overall rollup
all_attempts = list(first_transfer_attempt.values())
all_before = [v - 1 for v in all_attempts]
all_total_all = list(total_sightings.values())
all_total_transferred = [total_sightings[k] for k in first_transfer_attempt.keys()]
print("\nOVERALL")
print(
    "count_transferred="
    + str(len(all_attempts))
    + ",avg_seen_before_transfer="
    + f"{(sum(all_before) / len(all_before)):.2f}"
    + ",avg_attempt_at_transfer="
    + f"{(sum(all_attempts) / len(all_attempts)):.2f}"
    + ",avg_total_seen_transferred="
    + f"{(sum(all_total_transferred) / len(all_total_transferred)):.2f}"
    + ",avg_total_seen_all_phones="
    + f"{(sum(all_total_all) / len(all_total_all)):.2f}"
)

