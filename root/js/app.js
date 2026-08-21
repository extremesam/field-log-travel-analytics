const COLORS = {
  route: '#E8A33D',
  teal: '#4FB7A6',
  rust: '#D9683B',
  sage: '#8FA79C',
  blue: '#6B94C4',
  ink: '#EAE6D9',
  inkDim: '#B7C2BA',
  muted: '#7E9089',
  grid: '#26382F',
};

const MODE_LABELS = {
  IN_PASSENGER_VEHICLE: 'Passenger vehicle',
  WALKING: 'Walking',
  MOTORCYCLING: 'Motorcycling',
  CYCLING: 'Cycling',
  IN_BUS: 'Bus',
  OTHER: 'Other / unknown',
};
const MODE_COLORS = {
  IN_PASSENGER_VEHICLE: COLORS.route,
  WALKING: COLORS.teal,
  MOTORCYCLING: COLORS.rust,
  CYCLING: COLORS.blue,
  IN_BUS: COLORS.sage,
  OTHER: '#4A5A52',
};

async function loadJSON(name) {
  const res = await fetch(`data/${name}`);
  if (!res.ok) throw new Error(`Failed to load ${name}`);
  return res.json();
}

function fmtInt(n) {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

Chart.defaults.font.family = "'IBM Plex Mono', monospace";
Chart.defaults.color = COLORS.muted;

function baseGrid() {
  return { color: COLORS.grid };
}

// ---------- Hero ----------
let _tickerInterval = null;

function startCoordTicker(topClusters) {
  const el = document.getElementById('coordTicker');
  if (!topClusters || !topClusters.length) return;
  let i = 0;
  const tick = () => {
    const c = topClusters[i % topClusters.length];
    el.innerHTML = `LAT <span>${c.lat.toFixed(3)}</span> &middot; LON <span>${c.lon.toFixed(3)}</span> &middot; ${c.label} &middot; ${fmtInt(c.count)} visits logged`;
    i++;
  };
  tick();
  _tickerInterval = setInterval(tick, 3200);
}

function renderHeroStats(overview) {
  const stats = [
    { val: fmtInt(overview.total_distance_km), unit: 'km', label: 'Total distance' },
    { val: overview.num_years, unit: '', label: 'Years tracked' },
    { val: fmtInt(overview.total_trips), unit: '', label: 'Trips logged' },
    { val: fmtInt(overview.total_visits), unit: '', label: 'Places visited' },
  ];
  const row = document.getElementById('statRow');
  row.innerHTML = stats.map(s => `
    <div class="stat">
      <div class="val">${s.val}${s.unit ? `<span class="unit">${s.unit}</span>` : ''}</div>
      <div class="label">${s.label}</div>
    </div>`).join('');
}

function renderFooterStats(overview, visitStats) {
  const kvs = [
    { k: 'Date range', v: `${overview.start_date} \u2192 ${overview.end_date}` },
    { k: 'Dominant mode', v: MODE_LABELS[overview.top_mode_overall] || overview.top_mode_overall },
    { k: 'Median visit length', v: `${visitStats.median_hours} hrs` },
    { k: 'Longest single trip', v: `${fmtInt(overview.longest_single_trip_km)} km` },
  ];
  document.getElementById('footerStats').innerHTML = kvs.map(x => `
    <div class="kv"><div class="k">${x.k}</div><div class="v">${x.v}</div></div>
  `).join('');
}

// ---------- Charts ----------
function renderYearlyChart(yearly) {
  new Chart(document.getElementById('yearlyChart'), {
    type: 'bar',
    data: {
      labels: yearly.map(y => y.year),
      datasets: [{
        label: 'Distance (km)',
        data: yearly.map(y => y.distance_km),
        backgroundColor: COLORS.route,
        borderRadius: 3,
        maxBarThickness: 26,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: (ctx) => `${fmtInt(ctx.raw)} km`,
      } } },
      scales: {
        y: { beginAtZero: true, grid: baseGrid(), ticks: { color: COLORS.muted } },
        x: { grid: { display: false }, ticks: { color: COLORS.muted } },
      },
    },
  });
}

function renderModeChart(modesByYear) {
  const keys = ['IN_PASSENGER_VEHICLE', 'WALKING', 'MOTORCYCLING', 'CYCLING', 'IN_BUS'];
  const datasets = keys.map(k => ({
    label: MODE_LABELS[k],
    data: modesByYear.modes[k] || modesByYear.years.map(() => 0),
    backgroundColor: MODE_COLORS[k],
  }));
  new Chart(document.getElementById('modeChart'), {
    type: 'bar',
    data: { labels: modesByYear.years, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: COLORS.muted } },
        y: { stacked: true, beginAtZero: true, grid: baseGrid(), ticks: { color: COLORS.muted } },
      },
    },
  });
  document.getElementById('modeLegend').innerHTML = keys.map(k => `
    <span><span class="sw" style="background:${MODE_COLORS[k]}"></span>${MODE_LABELS[k]}</span>
  `).join('');
}

function renderMonthChart(monthly) {
  const max = Math.max(...monthly.distance_km);
  new Chart(document.getElementById('monthChart'), {
    type: 'bar',
    data: {
      labels: monthly.months,
      datasets: [{
        data: monthly.distance_km,
        backgroundColor: monthly.distance_km.map(v => v === max ? COLORS.rust : COLORS.teal),
        borderRadius: 3,
        maxBarThickness: 20,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${fmtInt(ctx.raw)} km` } } },
      scales: {
        y: { beginAtZero: true, grid: baseGrid(), ticks: { color: COLORS.muted, font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { color: COLORS.muted, font: { size: 10 } } },
      },
    },
  });
}

function renderHourChart(dowHour) {
  new Chart(document.getElementById('hourChart'), {
    type: 'bar',
    data: {
      labels: dowHour.hour_labels.map(h => `${h}`),
      datasets: [{
        data: dowHour.hour_counts,
        backgroundColor: COLORS.blue,
        borderRadius: 2,
        maxBarThickness: 12,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: baseGrid(), ticks: { color: COLORS.muted, font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { color: COLORS.muted, font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
      },
    },
  });
}

// ---------- Weekday x hour heatmap ----------
function heatColor(t) {
  // t in [0,1] -> interpolate bg-1 -> teal -> route -> rust
  const stops = [
    [0.00, [22, 36, 32]],
    [0.35, [24, 74, 66]],
    [0.65, [232, 163, 61]],
    [1.00, [217, 104, 59]],
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const span = b[0] - a[0] || 1;
  const local = (t - a[0]) / span;
  const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * local));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function renderHeatmapGrid(dowHour) {
  const el = document.getElementById('heatmapGrid');
  const matrix = dowHour.matrix;
  const max = Math.max(...matrix.flat());
  let html = '<div></div>';
  for (let h = 0; h < 24; h++) {
    html += `<div class="hg-hour-label">${h % 3 === 0 ? h : ''}</div>`;
  }
  dowHour.dow_labels.forEach((d, ri) => {
    html += `<div class="hg-label">${d}</div>`;
    for (let h = 0; h < 24; h++) {
      const v = matrix[ri][h];
      const t = max ? v / max : 0;
      html += `<div class="hg-cell" style="background:${heatColor(t)}" title="${d} ${h}:00 &mdash; ${v} trips"></div>`;
    }
  });
  el.innerHTML = html;

  document.getElementById('heatmapScale').innerHTML = `
    <span>Fewer trips</span>
    ${[0, 0.35, 0.65, 1].map(t => `<span class="hs-swatch" style="background:${heatColor(t)}"></span>`).join('')}
    <span>More trips</span>
  `;
}

// ---------- Places & States Visited ----------
let _allPlacesData = [];

function renderPlacesSection(allPlaces) {
  _allPlacesData = allPlaces;
  const grid = document.getElementById('placesGrid');
  const filterBtns = document.querySelectorAll('.place-filter-btn');

  function updateGrid(filter) {
    const filtered = filter === 'all' ? allPlaces : allPlaces.filter(p => p.type === filter);
    grid.innerHTML = filtered.map(p => {
      const typeBadgeClass = p.type === 'residence' ? 'background:rgba(6,182,212,0.15); color:#06b6d4;' : (p.type === 'visited' ? 'background:rgba(236,72,153,0.15); color:#ec4899;' : 'background:rgba(100,116,139,0.2); color:#94a3b8;');
      const yearsStr = p.years.length > 3 ? `${p.years[0]}–${p.years[p.years.length - 1]} (${p.years.length} yrs)` : p.years.join(', ');
      return `
        <div class="place-card" style="--card-accent:${p.color};">
          <div class="place-card-top">
            <div class="place-card-header">
              <div class="place-name">${p.state}</div>
              <span class="place-tag" style="${typeBadgeClass}">${p.category}</span>
            </div>
            <p class="place-desc">${p.desc}</p>
          </div>
          <div>
            <div class="place-stats-row">
              <div class="place-stat-item">
                <span class="k">Points</span>
                <span class="v">${fmtInt(p.total_points)}</span>
              </div>
              <div class="place-stat-item">
                <span class="k">Visits</span>
                <span class="v">${fmtInt(p.visits)}</span>
              </div>
              <div class="place-stat-item">
                <span class="k">Trips</span>
                <span class="v">${fmtInt(p.trips)}</span>
              </div>
            </div>
            <div class="place-card-bottom">
              <span class="place-years">Active: ${yearsStr}</span>
              <button class="place-map-jump" onclick="window.focusMapOnState(${p.lat}, ${p.lon}, '${p.state.replace(/'/g, "\\'")}', 9)">
                View Map &rarr;
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateGrid(btn.dataset.filter);
    });
  });

  updateGrid('all');
}

// ---------- Distance by state ----------
function renderStateChart(stateSummary) {
  // Sort by distance descending
  const sorted = [...stateSummary].sort((a, b) => b.distance_km - a.distance_km);
  const colorMap = {
    'Ekiti State': '#06b6d4',
    'Lagos State': '#f97316',
    'Oyo State': '#3b82f6',
    'Ogun State': '#10b981',
    'Osun State': '#8b5cf6',
    'Kogi State': '#e11d48',
    'Kaduna State': '#ec4899',
    'Abuja (FCT)': '#f59e0b',
    'Edo State': '#14b8a6',
    'Ondo State': '#6366f1',
    'Rivers State (Port Harcourt)': '#0ea5e9',
    'Niger State': '#64748b',
  };

  new Chart(document.getElementById('stateChart'), {
    type: 'bar',
    data: {
      labels: sorted.map(s => s.state),
      datasets: [{
        data: sorted.map(s => s.distance_km),
        backgroundColor: sorted.map(s => colorMap[s.state] || COLORS.teal),
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: (ctx) => `${fmtInt(ctx.raw)} km tracked`,
      } } },
      scales: {
        x: { beginAtZero: true, grid: baseGrid(), ticks: { color: COLORS.muted } },
        y: { grid: { display: false }, ticks: { color: COLORS.ink, font: { size: 11 } } },
      },
    },
  });
}

// ---------- Migration log ----------
function renderMigrationLog(homeWorkByYear) {
  const el = document.getElementById('migrationLog');
  el.innerHTML = homeWorkByYear.map((row, i) => {
    const home = row.home ? `<span class="v">${row.home.label}</span><span class="coords">${row.home.lat.toFixed(2)}, ${row.home.lon.toFixed(2)} &middot; ${row.home.count} visits</span>` : '<span class="v" style="color:var(--muted)">No signal</span>';
    const work = row.work ? `<span class="v">${row.work.label}</span><span class="coords">${row.work.lat.toFixed(2)}, ${row.work.lon.toFixed(2)} &middot; ${row.work.count} visits</span>` : '<span class="v" style="color:var(--muted)">No signal</span>';
    return `
      <div class="log-entry">
        <div class="log-index">${row.year}</div>
        <div class="log-place"><span class="k">Home</span>${home}</div>
        <div class="log-place"><span class="k">Work</span>${work}</div>
      </div>`;
  }).join('');
}

// ---------- Interactive Map ----------
let _leafletMap = null;

function renderMap(heatPoints, topClusters, homeWorkByYear, allPlaces) {
  // Center on Nigeria: encompassing all points from Port Harcourt (lat 4.8) to Kaduna (lat 10.6)
  const map = L.map('map-el', { scrollWheelZoom: true }).setView([8.0, 5.8], 6);
  _leafletMap = map;

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // Global focus helper
  window.focusMapOnState = function(lat, lon, name, zoom) {
    const mapSection = document.getElementById('map');
    if (mapSection) {
      mapSection.scrollIntoView({ behavior: 'smooth' });
    }
    setTimeout(() => {
      map.flyTo([lat, lon], zoom || 9, { duration: 1.2 });
    }, 400);
  };

  // Region jump pills
  const pillBtns = document.querySelectorAll('.map-pill-btn');
  pillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pillBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const region = btn.dataset.region;
      if (region === 'all') {
        map.fitBounds([[4.5, 2.7], [10.8, 8.5]], { padding: [20, 20] });
      } else if (region === 'kaduna') {
        map.flyTo([10.537, 7.414], 10, { duration: 1.2 });
      } else if (region === 'portharcourt') {
        map.flyTo([4.871, 7.066], 10, { duration: 1.2 });
      } else if (region === 'abuja') {
        map.flyTo([9.017, 7.151], 10, { duration: 1.2 });
      } else if (region === 'southwest') {
        map.flyToBounds([[6.3, 2.7], [8.0, 5.8]], { padding: [30, 30], duration: 1.2 });
      }
    });
  });

  setTimeout(() => {
    map.invalidateSize();

    // Default view: full Nigeria bounds so Kaduna & Port Harcourt are in view immediately
    map.fitBounds([[4.5, 2.7], [10.8, 8.5]], { padding: [30, 30] });

    // Heat layer across all 4,500 points
    const heatData = heatPoints.map(p => [p[0], p[1], Math.min(p[2] / 3, 1)]);
    L.heatLayer(heatData, {
      radius: 9,
      blur: 14,
      maxZoom: 13,
      gradient: { 0.15: '#06b6d4', 0.45: '#4FB7A6', 0.75: '#E8A33D', 1: '#ec4899' }
    }).addTo(map);

    // State Hub Marker Pins (with informative popups)
    allPlaces.forEach(p => {
      const isHub = p.type === 'residence';
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: isHub ? 8 : 6,
        color: p.color,
        weight: isHub ? 2.5 : 1.5,
        fillColor: '#0E1A17',
        fillOpacity: 0.9,
      });

      marker.bindPopup(`
        <div class="custom-map-popup">
          <h4 style="color:${p.color};">${p.state}</h4>
          <p><strong>${p.category}</strong></p>
          <p style="margin:4px 0 6px; font-size:11px; color:#B7C2BA;">${p.desc}</p>
          <div style="font-family:monospace; font-size:11px; color:#EAE6D9; display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:6px; border-top:0.5px solid #26382F; padding-top:4px;">
            <span>Visits: <strong>${fmtInt(p.visits)}</strong></span>
            <span>Trips: <strong>${fmtInt(p.trips)}</strong></span>
            <span>Total Points: <strong>${fmtInt(p.total_points)}</strong></span>
            <span>Years: <strong>${p.years.join(', ')}</strong></span>
          </div>
        </div>
      `);

      marker.bindTooltip(`<strong>${p.state}</strong><br>${p.category}`, { direction: 'top' });
      marker.addTo(map);
    });

    // Migration polyline connecting chronological home locations
    const seen = new Set();
    const pathPts = [];
    homeWorkByYear.forEach(row => {
      if (row.home) {
        const key = `${row.home.lat.toFixed(2)},${row.home.lon.toFixed(2)}`;
        if (!seen.has(key)) {
          seen.add(key);
          pathPts.push([row.home.lat, row.home.lon]);
        }
      }
    });
    if (pathPts.length > 1) {
      L.polyline(pathPts, { color: '#E8A33D', weight: 2.2, dashArray: '5,6', opacity: 0.85 }).addTo(map);
    }
  }, 150);

  document.getElementById('mapLegendRow').innerHTML = `
    <span><span class="sw" style="background:#4FB7A6"></span>GPS Density</span>
    <span><span class="sw" style="background:#ec4899; border-radius:50%;"></span>Visited Cities</span>
    <span><span class="sw" style="background:#E8A33D; border-radius:50%;"></span>Home Relocations</span>
  `;
}

// ---------- Trips table ----------
function renderTrips(trips) {
  const tbody = document.querySelector('#tripsTable tbody');
  tbody.innerHTML = trips.map(t => {
    const start = new Date(t.start_time);
    const end = new Date(t.end_time);
    const hrs = ((end - start) / 3600000).toFixed(1);
    const dateStr = start.toISOString().slice(0, 10);
    const modeLabel = MODE_LABELS[t.mode] || t.mode;
    const glitchBadge = t.glitch ? '<span class="badge">Likely GPS anomaly</span>' : '';
    return `<tr>
      <td>${dateStr}</td>
      <td>${modeLabel}${glitchBadge}</td>
      <td class="num">${t.distance_km.toLocaleString()} km</td>
      <td class="num">${hrs} hrs</td>
    </tr>`;
  }).join('');

  const glitch = trips.find(t => t.glitch);
  const note = document.getElementById('glitchNote');
  if (glitch) {
    note.textContent = `Note: the ${glitch.distance_km.toLocaleString()} km entry on ${glitch.start_time.slice(0,10)} is flagged as a likely GPS anomaly rather than a real trip \u2014 it's excluded from the distance totals shown elsewhere on this page, but kept visible here for transparency.`;
  } else {
    note.textContent = '';
  }
}

// ---------- Boot ----------
(async function init() {
  try {
    const [overview, yearly, modesByYear, monthly, dowHour, stateSummary, homeWorkByYear, heatPoints, topClusters, trips, visitStats, allPlaces] = await Promise.all([
      loadJSON('overview.json'),
      loadJSON('yearly.json'),
      loadJSON('modes_by_year.json'),
      loadJSON('monthly.json'),
      loadJSON('dow_hour.json'),
      loadJSON('state_summary.json'),
      loadJSON('home_work_by_year.json'),
      loadJSON('visit_heatmap.json'),
      loadJSON('top_clusters.json'),
      loadJSON('longest_trips.json'),
      loadJSON('visit_stats.json'),
      loadJSON('all_places.json'),
    ]);

    startCoordTicker(topClusters);
    renderHeroStats(overview);
    renderFooterStats(overview, visitStats);

    renderYearlyChart(yearly);
    renderModeChart(modesByYear);
    renderMonthChart(monthly);
    renderHourChart(dowHour);
    renderHeatmapGrid(dowHour);
    renderPlacesSection(allPlaces);
    renderStateChart(stateSummary);

    renderMigrationLog(homeWorkByYear);
    renderMap(heatPoints, topClusters, homeWorkByYear, allPlaces);
    renderTrips(trips);
  } catch (err) {
    console.error(err);
  }
})();

