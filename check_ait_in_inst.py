import json
from pathlib import Path
src = Path("C:/Users/User/th_citations/dashboard_data/institutions.json")
deployed = Path("C:/Users/User/OneDrive/Documents/GitHub/thailand-citations-dashboard/public/data/institutions.json")

for label, p in [("source", src), ("deployed", deployed)]:
    if not p.exists():
        print(f"{label}: NOT FOUND at {p}")
        continue
    d = json.loads(p.read_text(encoding="utf-8"))
    print(f"\n{label} ({p}):")
    print(f"  total institutions: {len(d)}")
    if len(d) > 0:
        print(f"  first: {d[0].get('name')} ({d[0].get('n_edges')} edges)")
        print(f"  last: {d[-1].get('name')} ({d[-1].get('n_edges')} edges)")
    # Look for AIT
    ait = [r for r in d if 'asian institute' in r.get('name', '').lower()]
    if ait:
        for a in ait:
            print(f"  AIT: {a.get('name')} type={a.get('type')} n_edges={a.get('n_edges')}")
            print(f"       id: {a.get('id')}")
    else:
        print(f"  AIT: NOT FOUND in this file")
