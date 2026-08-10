const map = L.map('map', { worldCopyJump: true }).setView([15.5, -74], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 12,
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);

const els = {
  statusDot: document.getElementById('status-dot'),
  lastUpdated: document.getElementById('last-updated'),
  refreshBtn: document.getElementById('refresh-btn'),
  magFilter: document.getElementById('mag-filter'),
  magValue: document.getElementById('mag-value'),
  daysFilter: document.getElementById('days-filter'),
  autoRefresh: document.getElementById('auto-refresh'),
  counts: document.getElementById('counts'),
  list: document.getElementById('quake-list'),
  emptyState: document.getElementById('empty-state'),
  sourceWarning: document.getElementById('source-warning'),
};

let refreshTimer = null;

function magnitudeColor(mag) {
  if (mag == null) return '#8a94ab';
  if (mag < 3) return '#4fd18b';
  if (mag < 4.5) return '#f5c542';
  if (mag < 6) return '#f57c42';
  return '#ef4444';
}

function magnitudeRadius(mag) {
  if (mag == null) return 5;
  return Math.max(4, mag * 3.2);
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function timeAgo(isoString) {
  const deltaMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function loadEarthquakes() {
  els.statusDot.className = 'status-dot';
  els.refreshBtn.disabled = true;
  els.refreshBtn.textContent = 'Refreshing…';

  const days = els.daysFilter.value;
  const minMagnitude = els.magFilter.value;

  try {
    const response = await fetch(`/api/earthquakes?days=${days}&minMagnitude=${minMagnitude}`);
    if (!response.ok) throw new Error(`Server responded ${response.status}`);
    const data = await response.json();
    renderEarthquakes(data);
    els.statusDot.className = 'status-dot ok';
    els.lastUpdated.textContent = `Updated ${new Date(data.generatedAt).toLocaleTimeString()}`;
  } catch (error) {
    els.statusDot.className = 'status-dot error';
    els.lastUpdated.textContent = `Update failed: ${error.message}`;
  } finally {
    els.refreshBtn.disabled = false;
    els.refreshBtn.textContent = 'Refresh';
  }
}

function renderEarthquakes(data) {
  markerLayer.clearLayers();
  els.list.innerHTML = '';

  const { earthquakes, counts, sourceErrors } = data;

  els.counts.textContent = `USGS ${counts.usgs} · EMSC ${counts.emsc} · UWI-SRC ${counts.uwi} · merged ${counts.merged}`;

  els.sourceWarning.hidden = sourceErrors.length === 0;
  if (sourceErrors.length > 0) {
    els.sourceWarning.textContent = `Some sources are temporarily unavailable: ${sourceErrors
      .map((e) => e.source)
      .join(', ')}. Showing data from remaining sources.`;
  }

  els.emptyState.hidden = earthquakes.length > 0;

  for (const quake of earthquakes) {
    if (quake.lat != null && quake.lon != null) {
      const marker = L.circleMarker([quake.lat, quake.lon], {
        radius: magnitudeRadius(quake.magnitude),
        fillColor: magnitudeColor(quake.magnitude),
        color: '#0b1220',
        weight: 1,
        fillOpacity: 0.75,
      });
      marker.bindPopup(popupHtml(quake));
      marker.addTo(markerLayer);
    }

    els.list.appendChild(listItem(quake));
  }
}

function popupHtml(quake) {
  const magText = quake.magnitude != null ? quake.magnitude.toFixed(1) : 'N/A';
  const depthText = quake.depthKm != null ? `${quake.depthKm.toFixed(1)} km` : 'unknown';
  const link = quake.url
    ? `<br/><a href="${quake.url}" target="_blank" rel="noopener">Event details</a>`
    : '';
  return `
    <strong>M ${magText} — ${quake.place}</strong><br/>
    ${formatTime(quake.time)}<br/>
    Depth: ${depthText}<br/>
    Source: ${quake.sources.join(', ')}
    ${link}
  `;
}

function listItem(quake) {
  const li = document.createElement('li');
  li.className = 'quake-item';

  const badge = document.createElement('div');
  badge.className = 'mag-badge';
  badge.style.background = magnitudeColor(quake.magnitude);
  badge.textContent = quake.magnitude != null ? quake.magnitude.toFixed(1) : '–';

  const info = document.createElement('div');
  info.className = 'quake-info';

  const place = document.createElement('div');
  place.className = 'quake-place';
  place.textContent = quake.place;

  const meta = document.createElement('div');
  meta.className = 'quake-meta';
  const depthText = quake.depthKm != null ? `${quake.depthKm.toFixed(0)} km deep` : 'depth unknown';
  meta.innerHTML = `
    <span>${timeAgo(quake.time)}</span>
    <span>${depthText}</span>
    ${quake.sources.map((s) => `<span class="source-tag">${s}</span>`).join('')}
  `;

  info.appendChild(place);
  info.appendChild(meta);
  li.appendChild(badge);
  li.appendChild(info);

  if (quake.lat != null && quake.lon != null) {
    li.addEventListener('click', () => {
      map.flyTo([quake.lat, quake.lon], Math.max(map.getZoom(), 7));
    });
  }

  return li;
}

function scheduleAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (els.autoRefresh.checked) {
    refreshTimer = setInterval(loadEarthquakes, 60_000);
  }
}

els.refreshBtn.addEventListener('click', loadEarthquakes);
els.magFilter.addEventListener('input', () => {
  els.magValue.textContent = Number.parseFloat(els.magFilter.value).toFixed(1);
});
els.magFilter.addEventListener('change', loadEarthquakes);
els.daysFilter.addEventListener('change', loadEarthquakes);
els.autoRefresh.addEventListener('change', scheduleAutoRefresh);

loadEarthquakes();
scheduleAutoRefresh();
