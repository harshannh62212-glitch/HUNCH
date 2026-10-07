#!/usr/bin/env python3
"""Split the LLASO manifest into rover-sized parcels.

The cargo bay is 2 ft x 2 ft (0.61 m) and the arm is rated for a 5 kg parcel
at full reach in lunar gravity. CTB contents are divisible and are cut into
parcels of at most 5 kg. Lockers, cryo cells, and other indivisible hardware
above that limit stay on the lander for an external hauler / ILTR gantry.

Masses are the manifest masses. Parcel masses of each divisible item sum back
to the source item.
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "lunar_logistics_manifest.json"
OUT = HERE / "rover_parcel_manifest.json"

G_EARTH = 9.806
G_MOON = 1.622
PARCEL_CAP_KG = 5.0
# Half of a single CTB so two parcels sit side by side in the 0.61 m bay.
PARCEL_DIM_M = [0.43, 0.25, 0.25]


def split_mass(mass_kg: float, cap: float = PARCEL_CAP_KG) -> list[float]:
    left = round(float(mass_kg), 3)
    parts: list[float] = []
    while left > cap + 1e-6:
        parts.append(cap)
        left = round(left - cap, 3)
    if left > 1e-6:
        parts.append(left)
    return parts


def main() -> None:
    data = json.loads(SRC.read_text())
    parcels = []
    hauler = []
    for item in data["manifest"]:
        mass = float(item["Mass_kg"])
        kind = str(item.get("Cargo_Type", ""))
        divisible = kind.startswith("CTB")
        if divisible or mass <= PARCEL_CAP_KG + 1e-6:
            parts = split_mass(mass) if divisible else [round(mass, 3)]
            if any(p > PARCEL_CAP_KG + 1e-6 for p in parts):
                raise SystemExit(f"parcel over cap: {item['Item']} {parts}")
            if abs(sum(parts) - mass) > 0.02:
                raise SystemExit(f"mass mismatch: {item['Item']} {sum(parts)} != {mass}")
            for i, part in enumerate(parts, start=1):
                parcels.append(
                    {
                        "id": f"P{len(parcels) + 1:03d}",
                        "source_item": item["Item"],
                        "source_type": kind,
                        "part": i,
                        "parts": len(parts),
                        "day_number": int(item["Day_Number"]),
                        "mass_kg": part,
                        "earth_N": round(part * G_EARTH, 1),
                        "lunar_N": round(part * G_MOON, 2),
                        "dim_m": list(PARCEL_DIM_M),
                        "actor": item.get("Responsible_Actor", ""),
                    }
                )
        else:
            hauler.append(
                {
                    "source_item": item["Item"],
                    "source_type": kind,
                    "day_number": int(item["Day_Number"]),
                    "mass_kg": mass,
                    "earth_N": round(mass * G_EARTH, 1),
                    "lunar_N": round(mass * G_MOON, 1),
                    "reason": "requires external hauler / ILTR",
                    "actor": item.get("Responsible_Actor", ""),
                }
            )

    parcels.sort(key=lambda p: (p["day_number"], p["id"]))
    for i, p in enumerate(parcels, start=1):
        p["id"] = f"P{i:03d}"

    rover_kg = round(sum(p["mass_kg"] for p in parcels), 3)
    hauler_kg = round(sum(h["mass_kg"] for h in hauler), 3)
    manifest_kg = round(sum(float(it["Mass_kg"]) for it in data["manifest"]), 3)
    if abs((rover_kg + hauler_kg) - manifest_kg) > 0.05:
        raise SystemExit(f"total mass {rover_kg + hauler_kg} != manifest {manifest_kg}")
    if any(p["mass_kg"] > PARCEL_CAP_KG + 1e-6 for p in parcels):
        raise SystemExit("cap violated")

    out = {
        "source": data.get("reference_name", "LLASO"),
        "gravity_m_s2": {"earth": G_EARTH, "moon": G_MOON},
        "limits": {
            "parcel_mass_cap_kg": PARCEL_CAP_KG,
            "bay_mass_cap_kg": 10.0,
            "bay_slots": 2,
            "bay_size_m": [0.61, 0.61, 0.30],
            "parcel_dim_m": PARCEL_DIM_M,
            "note": "5 kg at 0.45 m reach in 1.622 m/s^2 is about 3.6 N·m (~37 kg·cm), inside a 35–40 kg·cm servo.",
        },
        "rover_payload_kg": rover_kg,
        "hauler_payload_kg": hauler_kg,
        "manifest_payload_kg": manifest_kg,
        "parcel_count": len(parcels),
        "parcels": parcels,
        "hauler_items": hauler,
    }
    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print(
        f"Wrote {OUT.name}: {len(parcels)} parcels ({rover_kg} kg), "
        f"{len(hauler)} hauler items ({hauler_kg} kg)"
    )


if __name__ == "__main__":
    main()
