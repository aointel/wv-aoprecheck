import json
import glob
import re
import collections
import os

path = sorted(glob.glob(r"c:\dev\AOIrail\server\scripts\output\state-prompt-response-audit-*.json"))[-1]
rows = json.load(open(path, "r", encoding="utf-8"))


def norm(t: str) -> str:
    return re.sub(r"\s+", " ", (t or "").strip())


def cls_yes_no(text: str):
    s = (text or "").lower()
    yes = bool(re.search(r"\b(yes|yeah|yep|correct|right|affirmative|that is right|thats right)\b", s))
    no = bool(re.search(r"\b(no|nope|nah|negative|wrong|not)\b", s))
    return yes, no


prompted = [r for r in rows if norm(r.get("promptText", ""))]
no_user = [r for r in prompted if not norm(r.get("responseText", ""))]
with_user = [r for r in prompted if norm(r.get("responseText", ""))]

buckets = collections.Counter()
examples = {}

for r in with_user:
    t = norm(r.get("responseText", ""))
    tl = t.lower()
    yes, no = cls_yes_no(t)

    if yes or no:
        cat = "binary_or_negation_detected"
    elif re.search(r"\?$|\b(what|where|who|when|which|why|how)\b", tl):
        cat = "clarifier_question"
    elif re.search(r"\b(uh|um|huh|hmm|mm-hmm|okay|ok|alright|go ahead|hello)\b", tl):
        cat = "backchannel_ack"
    elif re.search(r"\b(live in|from|my son|my wife|my husband|wrong person|deceased|passed away|died)\b", tl):
        cat = "contextual_but_nonbinary"
    elif len(t) <= 6:
        cat = "too_short"
    else:
        cat = "offtopic_or_unclassified"

    buckets[cat] += 1
    examples.setdefault(cat, [])
    if len(examples[cat]) < 4:
        examples[cat].append(
            {"name": r.get("name"), "declared": r.get("declaredState"), "response": t}
        )

verified = buckets["binary_or_negation_detected"]
not_verified = len(prompted) - verified

print("file", os.path.basename(path))
print("prompt_found_total", len(prompted))
print("verified_yes_no_or_negation", verified)
print("not_verified_total", not_verified)
print("not_verified_breakdown:")
print("  no_user_response_after_prompt", len(no_user))
for k, v in buckets.items():
    if k != "binary_or_negation_detected":
        print(" ", k, v)

print("\nresponse_bucket_counts:")
for k, v in buckets.most_common():
    print(k, v)

print("\nexamples:")
for k in buckets:
    if k == "binary_or_negation_detected":
        continue
    print("\n" + k)
    for e in examples.get(k, []):
        print(e)
