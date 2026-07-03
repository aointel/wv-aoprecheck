import json
import glob
import os
import re
import collections

paths = sorted(glob.glob(r"c:\dev\AOIrail\server\scripts\output\state-prompt-response-audit-*.json"))
path = paths[-1]
rows = json.load(open(path, "r", encoding="utf-8"))

STATE = {
    "ALABAMA": "AL", "ALASKA": "AK", "ARIZONA": "AZ", "ARKANSAS": "AR", "CALIFORNIA": "CA",
    "COLORADO": "CO", "CONNECTICUT": "CT", "DELAWARE": "DE", "FLORIDA": "FL", "GEORGIA": "GA",
    "HAWAII": "HI", "IDAHO": "ID", "ILLINOIS": "IL", "INDIANA": "IN", "IOWA": "IA", "KANSAS": "KS",
    "KENTUCKY": "KY", "LOUISIANA": "LA", "MAINE": "ME", "MARYLAND": "MD", "MASSACHUSETTS": "MA",
    "MICHIGAN": "MI", "MINNESOTA": "MN", "MISSISSIPPI": "MS", "MISSOURI": "MO", "MONTANA": "MT",
    "NEBRASKA": "NE", "NEVADA": "NV", "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM",
    "NEW YORK": "NY", "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", "OHIO": "OH", "OKLAHOMA": "OK",
    "OREGON": "OR", "PENNSYLVANIA": "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD", "TENNESSEE": "TN", "TEXAS": "TX", "UTAH": "UT", "VERMONT": "VT",
    "VIRGINIA": "VA", "WASHINGTON": "WA", "WEST VIRGINIA": "WV", "WISCONSIN": "WI", "WYOMING": "WY",
    "DISTRICT OF COLUMBIA": "DC",
}


def norm(t: str) -> str:
    return re.sub(r"\s+", " ", (t or "").strip())


def extract_states(text: str):
    s = " " + norm(text).upper() + " "
    found = []
    for n, a in sorted(STATE.items(), key=lambda kv: -len(kv[0])):
        if f" {n} " in s:
            found.append(a)
    for m in re.finditer(r"\b(?:in|from|at|to|state|live in)\s+([A-Z]{2})\b", s):
        ab = m.group(1)
        if ab in set(STATE.values()) and ab not in found:
            found.append(ab)
    return found


def classify(resp: str, declared: str):
    t = norm(resp).lower()
    if not t:
        return ("unknown", "empty")

    states = extract_states(resp)
    dec = (declared or "").upper().strip()
    if states:
        if dec and dec in states:
            if re.search(r"\b(no|not|don't|do not|never|isn't|aint|ain't)\b", t):
                return ("mismatch_high", "negates_declared_state")
            return ("match_high", "explicit_declared_state")
        if dec and any(st != dec for st in states):
            return ("mismatch_high", "explicit_other_state")

    if re.search(r"\b(yes|yeah|yep|correct|right|affirmative|that's right|that is right)\b", t):
        if re.search(r"\b(not|don't|do not|never)\b", t):
            return ("mismatch_med", "yes_with_negation")
        return ("match_med", "yes_like")
    if re.search(r"\b(no|nope|nah|negative|wrong)\b", t):
        return ("mismatch_med", "no_like")
    if re.search(r"\b(i\s+live\s+in|we\s+live\s+in|not\s+in|never\s+lived\s+in)\b", t):
        return ("mismatch_med", "implicit_location_correction")
    if re.search(r"\b(what|who|where|huh|uh|um|okay|ok|alright|go ahead)\b", t) or "?" in t:
        return ("unknown", "clarifier_or_backchannel")
    return ("unknown", "unclassified")


prompted = [r for r in rows if norm(r.get("promptText", ""))]
with_resp = [r for r in prompted if norm(r.get("responseText", ""))]

res = []
for r in with_resp:
    v, reason = classify(r.get("responseText", ""), r.get("declaredState", ""))
    res.append((r, v, reason))

c = collections.Counter(v for _, v, _ in res)
reason = collections.Counter(rr for *_, rr in res)
known = c["match_high"] + c["match_med"] + c["mismatch_high"] + c["mismatch_med"]
mismatch = c["mismatch_high"] + c["mismatch_med"]

print("file", os.path.basename(path))
print("with_response", len(with_resp))
print("match_high", c["match_high"])
print("match_med", c["match_med"])
print("mismatch_high", c["mismatch_high"])
print("mismatch_med", c["mismatch_med"])
print("unknown", c["unknown"])
print("known_total", known)
if known:
    print("mismatch_rate_known", round(mismatch / known * 100, 2))

print("\nTop reasons:")
for k, v in reason.most_common(10):
    print(k, v)

st = collections.Counter((r.get("declaredState") or "").upper() for r, v, _ in res if v.startswith("mismatch"))
print("\nTop mismatch declared states:")
for k, v in st.most_common(12):
    print(k, v)

print("\nSample mismatch_high:")
for r, v, rr in [x for x in res if x[1] == "mismatch_high"][:8]:
    print({"name": r.get("name"), "declared": r.get("declaredState"), "response": norm(r.get("responseText", ""))[:110], "reason": rr})

print("\nSample mismatch_med:")
for r, v, rr in [x for x in res if x[1] == "mismatch_med"][:8]:
    print({"name": r.get("name"), "declared": r.get("declaredState"), "response": norm(r.get("responseText", ""))[:110], "reason": rr})
