from pathlib import Path
dep = Path("C:/Users/User/OneDrive/Documents/GitHub/thailand-citations-dashboard/src/Dashboard.jsx")
print(f"Deployed Dashboard.jsx size: {dep.stat().st_size:,} bytes (expecting 232,716)")
text = dep.read_text(encoding="utf-8")
print(f"Has 'Clip spacer' marker: {'spacer' in text and 'overflow' in text}")
print(f"Has innerHeight calc: {'innerHeight' in text}")
