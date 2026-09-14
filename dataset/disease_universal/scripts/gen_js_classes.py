import json
from pathlib import Path

reg_path = Path("models/disease_universal/class_registry.json")
with open(reg_path, "r", encoding="utf-8") as f:
    classes = json.load(f)["classes"]

lines = []
for c in classes:
    p = f"\"{c['pathogen']}\"" if c.get('pathogen') else "null"
    status = "Healthy" if c["healthy"] else "Diseased"
    lines.append(f"  {{ id: {c['id']}, name: '{c['canonical_class_id']}', crop: '{c['crop']}', disease: '{c['disease']}', status: '{status}', pathogen: {p} }},")

print("\n".join(lines))
