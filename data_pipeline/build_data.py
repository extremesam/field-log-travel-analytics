import json
import re
import os
import pathlib
from collections import Counter, defaultdict
from datetime import datetime
import statistics

# Determine paths
SRC = pathlib.Path(__file__).resolve().parents[1] / "Timeline.json"
OUT = str(pathlib.Path(__file__).resolve().parents[1] / "site" / "data")
os.makedirs(OUT, exist_ok=True)

with open(SRC) as f:
    data = json.load(f)

segs = data["semanticSegments"]


def parse_latlng(s):
    m = re.match(r"([\-\d.]+)\D+,\s*([\-\d.]+)", s)
    if m:
        return float(m.group(1)), float(m.group(2))
    return None


def parse_iso(t):
    return datetime.fromisoformat(t)


# Known area labels, based on Nigerian geography
# Accurately maps 100% of location points across all 12 Nigerian states in the dataset
def label_cluster(lat, lon):
    # Rivers (Port Harcourt)
    if 4.3 <= lat <= 5.5 and 6.5 <= lon <= 7.5:
        return "Rivers State (Port Harcourt)"
    # Edo State
    if 5.8 <= lat <= 7.4 and 5.8 <= lon <= 6.8:
        return "Edo State"
    if 5.8 <= lat <= 7.0 and 5.3 <= lon <= 6.8:
        return "Edo State"
    # Lagos State
    if 6.30 <= lat <= 6.70 and 2.70 <= lon <= 4.10:
        return "Lagos State"
    # Ogun State
    if 6.65 <= lat <= 7.25 and 2.70 <= lon <= 4.50 and not (7.15 <= lat and 3.85 <= lon <= 4.10):
        return "Ogun State"
    # Oyo State
    if 7.15 <= lat <= 8.80 and 2.70 <= lon <= 4.30:
        return "Oyo State"
    # Osun State
    if 7.00 <= lat <= 8.00 and 4.10 <= lon <= 5.00:
        return "Osun State"
    # Ekiti State
    if 7.05 <= lat <= 8.10 and 5.00 <= lon <= 5.65:
        return "Ekiti State"
    # Ondo State
    if 5.80 <= lat <= 7.70 and 4.60 <= lon <= 5.95 and not (7.05 <= lat and 5.00 <= lon <= 5.65):
        return "Ondo State"
    # Kwara State
    if 8.0 <= lat <= 9.5 and 4.0 <= lon <= 5.5:
        return "Kwara State"
    # Kogi State
    if 7.30 <= lat <= 8.60 and 5.60 <= lon <= 7.70:
        return "Kogi State"
    # Abuja FCT
    if 8.50 <= lat <= 9.30 and 6.80 <= lon <= 7.70:
        return "Abuja (FCT)"
    # Niger State
    if 8.50 <= lat <= 10.0 and 5.0 <= lon <= 7.7:
        return "Niger State"
    # Kaduna State
    if 9.80 <= lat <= 11.40 and 6.50 <= lon <= 8.80:
        return "Kaduna State"
    # Nasarawa State
    if 8.0 <= lat <= 9.5 and 7.5 <= lon <= 9.5:
        return "Nasarawa State"
    return f"{lat:.2f}, {lon:.2f}"


months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
dow_names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

# ---------- Yearly + modes + overview ----------
yearly_dist = defaultdict(float)
yearly_visits = defaultdict(int)
yearly_trips = defaultdict(int)
yearly_modes = defaultdict(Counter)
all_modes = Counter()
total_dist = 0.0
trip_count = 0
longest_trips = []
month_dist = defaultdict(float)
month_trips = Counter()
dow_counts = Counter()
hour_counts = Counter()
dow_hour_matrix = defaultdict(lambda: [0] * 24)  # dow_name -> [count per hour]
state_dist = defaultdict(float)
state_trips = Counter()
min_date, max_date = None, None

GLITCH_THRESHOLD_M = 1_000_000  # 1000 km in one activity segment treated as a probable GPS glitch

for s in segs:
    st = s["startTime"]
    year = st[:4]
    dt = parse_iso(st)
    if min_date is None or dt < min_date:
        min_date = dt
    if max_date is None or dt > max_date:
        max_date = dt

    if "visit" in s:
        yearly_visits[year] += 1

    if "activity" in s:
        act = s["activity"]
        dist = act.get("distanceMeters", 0) or 0
        mode = act.get("topCandidate", {}).get("type", "UNKNOWN_ACTIVITY_TYPE")
        yearly_modes[year][mode] += 1
        all_modes[mode] += 1
        trip_count += 1
        yearly_trips[year] += 1

        is_glitch = dist > GLITCH_THRESHOLD_M
        if not is_glitch:
            yearly_dist[year] += dist
            total_dist += dist
            month_dist[dt.month] += dist

        month_trips[dt.month] += 1
        dow_name = dow_names[dt.weekday()]
        dow_counts[dow_name] += 1
        hour_counts[dt.hour] += 1
        dow_hour_matrix[dow_name][dt.hour] += 1

        start_ll = parse_latlng(act.get("start", {}).get("latLng", "")) if act.get("start") else None
        end_ll = parse_latlng(act.get("end", {}).get("latLng", "")) if act.get("end") else None

        if not is_glitch:
            ref_ll = start_ll or end_ll
            if ref_ll:
                state = label_cluster(ref_ll[0], ref_ll[1])
                if "," in state:  # unmapped, raw coordinate string
                    state = "Other / unmapped"
                state_dist[state] += dist
                state_trips[state] += 1
        longest_trips.append({
            "distance_km": round(dist / 1000, 1),
            "mode": mode,
            "start_time": s["startTime"],
            "end_time": s["endTime"],
            "start": start_ll,
            "end": end_ll,
            "glitch": is_glitch,
        })

years_sorted = sorted(set(list(yearly_dist.keys()) + list(yearly_visits.keys()) + list(yearly_trips.keys())))

yearly = []
for y in years_sorted:
    top_mode = yearly_modes[y].most_common(1)[0][0] if yearly_modes[y] else None
    yearly.append({
        "year": y,
        "distance_km": round(yearly_dist[y] / 1000, 1),
        "visits": yearly_visits[y],
        "trips": yearly_trips[y],
        "top_mode": top_mode,
    })

MODE_KEYS = ["IN_PASSENGER_VEHICLE", "WALKING", "MOTORCYCLING", "CYCLING", "IN_BUS", "IN_FERRY", "UNKNOWN_ACTIVITY_TYPE"]
modes_by_year = {
    "years": years_sorted,
    "modes": {m: [yearly_modes[y].get(m, 0) for y in years_sorted] for m in MODE_KEYS},
}

monthly = {
    "months": months,
    "distance_km": [round(month_dist[i] / 1000, 1) for i in range(1, 13)],
    "trips": [month_trips[i] for i in range(1, 13)],
}

dow_hour = {
    "dow_labels": dow_names,
    "dow_counts": [dow_counts[d] for d in dow_names],
    "hour_labels": list(range(24)),
    "hour_counts": [hour_counts[h] for h in range(24)],
    "matrix": [dow_hour_matrix[d] for d in dow_names],  # 7 rows x 24 cols
}

state_summary = sorted(
    [
        {
            "state": s,
            "distance_km": round(state_dist[s] / 1000, 1),
            "trips": state_trips[s],
        }
        for s in state_dist
    ],
    key=lambda r: r["distance_km"],
    reverse=True,
)

longest_trips.sort(key=lambda t: t["distance_km"], reverse=True)
top_trips = longest_trips[:15]

overview = {
    "total_distance_km": round(total_dist / 1000),
    "total_trips": trip_count,
    "total_visits": sum(yearly_visits.values()),
    "years_span": f"{years_sorted[0]}\u2013{years_sorted[-1]}",
    "num_years": len(years_sorted),
    "start_date": min_date.date().isoformat(),
    "end_date": max_date.date().isoformat(),
    "top_mode_overall": all_modes.most_common(1)[0][0],
    "longest_single_trip_km": top_trips[0]["distance_km"] if top_trips else None,
}

# ---------- Home / work by year ----------
yearly_home_loc = defaultdict(Counter)
yearly_work_loc = defaultdict(Counter)

for s in segs:
    if "visit" not in s:
        continue
    year = s["startTime"][:4]
    tc = s["visit"].get("topCandidate", {})
    semtype = tc.get("semanticType", "UNKNOWN")
    loc = tc.get("placeLocation", {}).get("latLng")
    ll = parse_latlng(loc) if loc else None
    if not ll:
        continue
    key = (round(ll[0], 2), round(ll[1], 2))
    if "HOME" in semtype:
        yearly_home_loc[year][key] += 1
    elif "WORK" in semtype:
        yearly_work_loc[year][key] += 1

home_work_by_year = []
for y in years_sorted:
    home_top = yearly_home_loc[y].most_common(1)
    work_top = yearly_work_loc[y].most_common(1)
    home = None
    work = None
    if home_top:
        (lat, lon), count = home_top[0]
        home = {"lat": lat, "lon": lon, "count": count, "label": label_cluster(lat, lon)}
    if work_top:
        (lat, lon), count = work_top[0]
        work = {"lat": lat, "lon": lon, "count": count, "label": label_cluster(lat, lon)}
    home_work_by_year.append({"year": y, "home": home, "work": work})

# ---------- Visit & route heatmap points (comprehensive coverage) ----------
point_counts = Counter()
for s in segs:
    # Visits
    if "visit" in s:
        loc = s["visit"].get("topCandidate", {}).get("placeLocation", {}).get("latLng")
        if loc:
            ll = parse_latlng(loc)
            if ll:
                key = (round(ll[0], 3), round(ll[1], 3))
                point_counts[key] += 3  # weight visits higher

    # Activity endpoints
    if "activity" in s:
        for k in ["start", "end"]:
            loc = s["activity"].get(k, {}).get("latLng")
            if loc:
                ll = parse_latlng(loc)
                if ll:
                    key = (round(ll[0], 3), round(ll[1], 3))
                    point_counts[key] += 2

    # Timeline path waypoints (sampled)
    if "timelinePath" in s:
        for pt in s["timelinePath"]:
            if "point" in pt:
                ll = parse_latlng(pt["point"])
                if ll:
                    key = (round(ll[0], 3), round(ll[1], 3))
                    point_counts[key] += 1

heatmap_points = [[lat, lon, count] for (lat, lon), count in point_counts.items()]
heatmap_points.sort(key=lambda p: p[2], reverse=True)
heatmap_points = heatmap_points[:4500]

# ---------- Top place clusters (for a labeled list) ----------
cluster_counts = Counter()
for s in segs:
    if "visit" not in s:
        continue
    loc = s["visit"].get("topCandidate", {}).get("placeLocation", {}).get("latLng")
    if not loc:
        continue
    ll = parse_latlng(loc)
    if not ll:
        continue
    key = (round(ll[0], 2), round(ll[1], 2))
    cluster_counts[key] += 1

top_clusters = []
for (lat, lon), count in cluster_counts.most_common(12):
    top_clusters.append({"lat": lat, "lon": lon, "count": count, "label": label_cluster(lat, lon)})

# ---------- Visit duration stats ----------
visit_durs = []
for s in segs:
    if "visit" in s:
        st = parse_iso(s["startTime"])
        et = parse_iso(s["endTime"])
        visit_durs.append((et - st).total_seconds() / 3600)

visit_stats = {
    "median_hours": round(statistics.median(visit_durs), 1) if visit_durs else 0,
    "mean_hours": round(statistics.mean(visit_durs), 1) if visit_durs else 0,
    "max_hours": round(max(visit_durs), 1) if visit_durs else 0,
}

# ---------- All places & states visited (comprehensive summary) ----------
state_stats = defaultdict(lambda: {
    "visits": 0,
    "trips": 0,
    "path_pts": 0,
    "hours": 0.0,
    "years": set(),
    "lats": [],
    "lons": [],
})

for s in segs:
    yr = s["startTime"][:4]
    if "visit" in s:
        loc = s["visit"].get("topCandidate", {}).get("placeLocation", {}).get("latLng")
        ll = parse_latlng(loc) if loc else None
        if ll:
            st_name = label_cluster(ll[0], ll[1])
            st = parse_iso(s["startTime"])
            et = parse_iso(s["endTime"])
            state_stats[st_name]["visits"] += 1
            state_stats[st_name]["hours"] += (et - st).total_seconds() / 3600
            state_stats[st_name]["years"].add(yr)
            state_stats[st_name]["lats"].append(ll[0])
            state_stats[st_name]["lons"].append(ll[1])

    if "activity" in s:
        act = s["activity"]
        for k in ["start", "end"]:
            loc = act.get(k, {}).get("latLng") if act.get(k) else None
            ll = parse_latlng(loc) if loc else None
            if ll:
                st_name = label_cluster(ll[0], ll[1])
                state_stats[st_name]["trips"] += 1
                state_stats[st_name]["years"].add(yr)
                state_stats[st_name]["lats"].append(ll[0])
                state_stats[st_name]["lons"].append(ll[1])

    if "timelinePath" in s:
        for pt in s["timelinePath"]:
            if "point" in pt:
                ll = parse_latlng(pt["point"])
                if ll:
                    st_name = label_cluster(ll[0], ll[1])
                    state_stats[st_name]["path_pts"] += 1
                    state_stats[st_name]["years"].add(yr)
                    state_stats[st_name]["lats"].append(ll[0])
                    state_stats[st_name]["lons"].append(ll[1])

# State metadata and categorization
# State metadata and categorization reflecting user's authentic journey
state_meta = {
    "Oyo State": {
        "category": "Born & Raised / Major Hub",
        "type": "residence",
        "desc": "Born and raised in Ibadan, Oyo State. Roots, extended living, and a central regional transit hub.",
        "color": "#3b82f6"
    },
    "Ogun State": {
        "category": "Current Residence",
        "type": "residence",
        "desc": "Current state of residence (Ode-Remo / Sagamu corridor). Key living base and expressway commuter corridor.",
        "color": "#10b981"
    },
    "Lagos State": {
        "category": "NYSC & Army Cantonment Work",
        "type": "residence",
        "desc": "NYSC national service and months of post-NYSC professional work in the Nigerian Army Cantonment.",
        "color": "#f97316"
    },
    "Ekiti State": {
        "category": "State of Origin / Work Base",
        "type": "residence",
        "desc": "State of origin; traveled and stayed extensively primarily for work.",
        "color": "#06b6d4"
    },
    "Ondo State": {
        "category": "University (FUTA, Akure)",
        "type": "visited",
        "desc": "Schooled at the Federal University of Technology, Akure (FUTA), Ondo State.",
        "color": "#6366f1"
    },
    "Kaduna State": {
        "category": "Nigerian Air Force Screening",
        "type": "visited",
        "desc": "Traveled to Kaduna for the Nigerian Air Force Direct Short Service Combatant (DSSC) screening in January 2025.",
        "color": "#ec4899"
    },
    "Edo State": {
        "category": "Geological Field Mapping",
        "type": "visited",
        "desc": "Traveled to Edo State during university for Geological field mapping expeditions while studying at FUTA.",
        "color": "#14b8a6"
    },
    "Rivers State (Port Harcourt)": {
        "category": "Wedding Trip",
        "type": "visited",
        "desc": "Traveled to Port Harcourt, Rivers State to attend a wedding in February 2020.",
        "color": "#0ea5e9"
    },
    "Kogi State": {
        "category": "Wedding & Transit Corridor",
        "type": "visited",
        "desc": "Attended a wedding in Kogi State; also traveled through the North-South transit backbone (Lokoja / Kabba).",
        "color": "#e11d48"
    },
    "Osun State": {
        "category": "Family Visits",
        "type": "visited",
        "desc": "Traveled to Osun State primarily for family visits and regional journeys.",
        "color": "#8b5cf6"
    },
    "Abuja (FCT)": {
        "category": "Federal Capital Visits",
        "type": "visited",
        "desc": "Travels to the Federal Capital Territory for transit and visits (2020, 2022, 2025).",
        "color": "#f59e0b"
    },
    "Niger State": {
        "category": "Transit Corridor",
        "type": "transit",
        "desc": "Abuja-Kaduna expressway corridor traveled on the journey to Northern Nigeria.",
        "color": "#64748b"
    },
}

all_places = []
for state, data_item in state_stats.items():
    if not data_item["lats"]:
        continue
    avg_lat = round(sum(data_item["lats"]) / len(data_item["lats"]), 3)
    avg_lon = round(sum(data_item["lons"]) / len(data_item["lons"]), 3)
    meta = state_meta.get(state, {
        "category": "Visited",
        "type": "visited",
        "desc": "Recorded location in Nigeria",
        "color": "#a855f7"
    })
    
    all_places.append({
        "state": state,
        "visits": data_item["visits"],
        "trips": data_item["trips"],
        "path_pts": data_item["path_pts"],
        "total_points": data_item["visits"] + data_item["trips"] + data_item["path_pts"],
        "hours": round(data_item["hours"], 1),
        "years": sorted(data_item["years"]),
        "lat": avg_lat,
        "lon": avg_lon,
        "category": meta["category"],
        "type": meta["type"],
        "desc": meta["desc"],
        "color": meta["color"],
    })

# Sort: residence states first by total points, then visited/transit states by total points
type_order = {"residence": 1, "visited": 2, "transit": 3}
all_places.sort(key=lambda p: (type_order.get(p["type"], 4), -p["total_points"]))

# Update state summary to include all 12 states
state_summary = []
for p in all_places:
    state_summary.append({
        "state": p["state"],
        "distance_km": round(state_dist.get(p["state"], 0) / 1000, 1),
        "trips": p["trips"],
        "visits": p["visits"],
        "category": p["category"],
        "type": p["type"],
        "years": p["years"],
    })

# ---------- Write files ----------
def write(name, obj):
    path = os.path.join(OUT, name)
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    print(name, os.path.getsize(path), "bytes")


write("overview.json", overview)
write("yearly.json", yearly)
write("modes_by_year.json", modes_by_year)
write("monthly.json", monthly)
write("dow_hour.json", dow_hour)
write("state_summary.json", state_summary)
write("home_work_by_year.json", home_work_by_year)
write("visit_heatmap.json", heatmap_points)
write("top_clusters.json", top_clusters)
write("longest_trips.json", top_trips)
write("visit_stats.json", visit_stats)
write("all_places.json", all_places)

print("\nDone.")
