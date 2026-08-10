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
  refreshInterval: document.getElementById('refresh-interval'),
  counts: document.getElementById('counts'),
  list: document.getElementById('quake-list'),
  emptyState: document.getElementById('empty-state'),
  sourceWarning: document.getElementById('source-warning'),
  trendsToggle: document.getElementById('trends-toggle'),
  trendsPanel: document.getElementById('trends-panel'),
  tableToggle: document.getElementById('table-toggle'),
  trendsCharts: document.getElementById('trends-charts'),
  trendsTableWrap: document.getElementById('trends-table-wrap'),
  trendsTableBody: document.querySelector('#trends-table tbody'),
  dailyChart: document.getElementById('daily-chart'),
  magnitudeChart: document.getElementById('magnitude-chart'),
  tooltip: document.getElementById('chart-tooltip'),
  alertsToggle: document.getElementById('alerts-toggle'),
  alertsStatus: document.getElementById('alerts-status'),
  alertsThreshold: document.getElementById('alerts-threshold'),
  alertsThresholdLabel: document.getElementById('alerts-threshold-label'),
  themeToggle: document.getElementById('theme-toggle'),
};

let refreshTimer = null;
let lastEarthquakes = [];

function magnitudeColor(mag) {
  if (mag == null) return '#8a94ab';
  if (mag < 3) return '#0ca30c';
  if (mag < 4.5) return '#fab219';
  if (mag < 6) return '#ec835a';
  return '#d03b3b';
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

  lastEarthquakes = earthquakes;
  renderTrends(earthquakes);
}

function popupHtml(quake) {
  const magText = quake.magnitude != null ? quake.magnitude.toFixed(1) : 'N/A';
  const depthText = quake.depthKm != null ? `${quake.depthKm.toFixed(1)} km` : 'unknown';
  const link = quake.url
    ? `<br/><a href="${escapeHtml(quake.url)}" target="_blank" rel="noopener">Event details</a>`
    : '';
  return `
    <strong>M ${magText} — ${escapeHtml(quake.place)}</strong><br/>
    ${formatTime(quake.time)}<br/>
    Depth: ${depthText}<br/>
    Source: ${escapeHtml(quake.sources.join(', '))}
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDay(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dayKey(isoString) {
  return new Date(isoString).toISOString().slice(0, 10);
}

function aggregateByDay(earthquakes) {
  const byDay = new Map();
  for (const quake of earthquakes) {
    const key = dayKey(quake.time);
    if (!byDay.has(key)) byDay.set(key, { date: key, count: 0, maxMag: null });
    const entry = byDay.get(key);
    entry.count += 1;
    if (quake.magnitude != null && (entry.maxMag == null || quake.magnitude > entry.maxMag)) {
      entry.maxMag = quake.magnitude;
    }
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function roundedTopRectPath(x, yTop, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${yTop + radius} a${radius},${radius} 0 0 1 ${radius},${-radius} h${w - 2 * radius} a${radius},${radius} 0 0 1 ${radius},${radius} v${h - radius} h${-w} Z`;
}

function showTooltip(clientX, clientY, lines) {
  els.tooltip.innerHTML = '';
  for (const [label, value, strong] of lines) {
    const row = document.createElement('div');
    const valueSpan = document.createElement(strong ? 'strong' : 'span');
    valueSpan.textContent = value;
    if (label) {
      row.appendChild(document.createTextNode(`${label}: `));
    }
    row.appendChild(valueSpan);
    els.tooltip.appendChild(row);
  }
  els.tooltip.style.left = `${clientX + 14}px`;
  els.tooltip.style.top = `${clientY + 14}px`;
  els.tooltip.hidden = false;
}

function hideTooltip() {
  els.tooltip.hidden = true;
}

const CHART_W = 600;
const CHART_H = 200;
const MARGIN = { top: 10, right: 10, bottom: 24, left: 32 };

function pickLabelIndices(n, maxLabels) {
  if (n <= maxLabels) return [...Array(n).keys()];
  const step = Math.ceil(n / maxLabels);
  const indices = [];
  for (let i = 0; i < n; i += step) indices.push(i);
  if (indices[indices.length - 1] !== n - 1) indices.push(n - 1);
  return indices;
}

function svgEl(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function renderDailyChart(aggregates) {
  const svg = els.dailyChart;
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${CHART_W} ${CHART_H}`);
  if (aggregates.length === 0) return;

  const innerW = CHART_W - MARGIN.left - MARGIN.right;
  const innerH = CHART_H - MARGIN.top - MARGIN.bottom;
  const maxCount = Math.max(1, ...aggregates.map((a) => a.count));
  const bandWidth = innerW / aggregates.length;
  const barWidth = Math.min(24, bandWidth - 2);

  [0, 0.5, 1].forEach((frac) => {
    const y = MARGIN.top + innerH * (1 - frac);
    svg.appendChild(svgEl('line', { class: 'gridline', x1: MARGIN.left, x2: CHART_W - MARGIN.right, y1: y, y2: y }));
    const label = svgEl('text', { x: MARGIN.left - 6, y: y + 3, 'text-anchor': 'end' });
    label.textContent = Math.round(maxCount * frac);
    svg.appendChild(label);
  });

  const labelIndices = new Set(pickLabelIndices(aggregates.length, 8));

  aggregates.forEach((entry, i) => {
    const barHeight = Math.max(1, innerH * (entry.count / maxCount));
    const x = MARGIN.left + i * bandWidth + (bandWidth - barWidth) / 2;
    const yTop = MARGIN.top + innerH - barHeight;
    const color = entry.maxMag != null ? magnitudeColor(entry.maxMag) : '#8a94ab';

    const bar = svgEl('path', { class: 'bar-mark', d: roundedTopRectPath(x, yTop, barWidth, barHeight, 4), fill: color, tabindex: '0' });
    bar.addEventListener('pointermove', (e) => {
      showTooltip(e.clientX, e.clientY, [
        ['Date', formatDay(entry.date), false],
        ['Earthquakes', String(entry.count), true],
        ['Max magnitude', entry.maxMag != null ? entry.maxMag.toFixed(1) : 'N/A', false],
      ]);
    });
    bar.addEventListener('pointerleave', hideTooltip);
    bar.addEventListener('focus', (e) => {
      const rect = bar.getBoundingClientRect();
      showTooltip(rect.left, rect.top, [
        ['Date', formatDay(entry.date), false],
        ['Earthquakes', String(entry.count), true],
      ]);
    });
    bar.addEventListener('blur', hideTooltip);
    svg.appendChild(bar);

    if (labelIndices.has(i)) {
      const label = svgEl('text', { x: x + barWidth / 2, y: CHART_H - MARGIN.bottom + 14, 'text-anchor': 'middle' });
      label.textContent = formatDay(entry.date);
      svg.appendChild(label);
    }
  });

  svg.appendChild(svgEl('line', { class: 'axis-line', x1: MARGIN.left, x2: CHART_W - MARGIN.right, y1: MARGIN.top + innerH, y2: MARGIN.top + innerH }));
}

function renderMagnitudeChart(earthquakes) {
  const svg = els.magnitudeChart;
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${CHART_W} ${CHART_H}`);

  const dated = earthquakes.filter((q) => q.magnitude != null).slice().sort((a, b) => new Date(a.time) - new Date(b.time));
  if (dated.length === 0) return;

  const innerW = CHART_W - MARGIN.left - MARGIN.right;
  const innerH = CHART_H - MARGIN.top - MARGIN.bottom;
  const times = dated.map((q) => new Date(q.time).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times, minTime + 1);
  const maxMag = Math.max(5, ...dated.map((q) => q.magnitude));

  [0, 0.5, 1].forEach((frac) => {
    const y = MARGIN.top + innerH * (1 - frac);
    svg.appendChild(svgEl('line', { class: 'gridline', x1: MARGIN.left, x2: CHART_W - MARGIN.right, y1: y, y2: y }));
    const label = svgEl('text', { x: MARGIN.left - 6, y: y + 3, 'text-anchor': 'end' });
    label.textContent = (maxMag * frac).toFixed(1);
    svg.appendChild(label);
  });

  const labelIndices = new Set(pickLabelIndices(dated.length, 4));

  dated.forEach((quake, i) => {
    const x = MARGIN.left + (innerW * (new Date(quake.time).getTime() - minTime)) / (maxTime - minTime);
    const y = MARGIN.top + innerH * (1 - quake.magnitude / maxMag);
    const color = magnitudeColor(quake.magnitude);

    const dot = svgEl('circle', { class: 'dot-mark', cx: x, cy: y, r: 5, fill: color, stroke: 'var(--panel)', 'stroke-width': 2 });
    svg.appendChild(dot);

    const hit = svgEl('circle', { class: 'hit-target', cx: x, cy: y, r: 12, tabindex: '0' });
    const tooltipLines = [
      ['Place', quake.place, false],
      ['Magnitude', quake.magnitude.toFixed(1), true],
      ['Date', formatTime(quake.time), false],
    ];
    hit.addEventListener('pointermove', (e) => showTooltip(e.clientX, e.clientY, tooltipLines));
    hit.addEventListener('pointerleave', hideTooltip);
    hit.addEventListener('focus', () => {
      const rect = hit.getBoundingClientRect();
      showTooltip(rect.left, rect.top, tooltipLines);
    });
    hit.addEventListener('blur', hideTooltip);
    svg.appendChild(hit);

    if (labelIndices.has(i)) {
      const label = svgEl('text', { x, y: CHART_H - MARGIN.bottom + 14, 'text-anchor': 'middle' });
      label.textContent = formatDay(quake.time);
      svg.appendChild(label);
    }
  });

  svg.appendChild(svgEl('line', { class: 'axis-line', x1: MARGIN.left, x2: CHART_W - MARGIN.right, y1: MARGIN.top + innerH, y2: MARGIN.top + innerH }));
}

function renderTrendsTable(aggregates) {
  els.trendsTableBody.innerHTML = '';
  for (const entry of aggregates.slice().reverse()) {
    const row = document.createElement('tr');
    const cells = [formatDay(entry.date), String(entry.count), entry.maxMag != null ? entry.maxMag.toFixed(1) : 'N/A'];
    for (const value of cells) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    }
    els.trendsTableBody.appendChild(row);
  }
}

function renderTrends(earthquakes) {
  const aggregates = aggregateByDay(earthquakes);
  renderDailyChart(aggregates);
  renderMagnitudeChart(earthquakes);
  renderTrendsTable(aggregates);
}

function scheduleAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const intervalMs = Number.parseInt(els.refreshInterval.value, 10);
  if (intervalMs > 0) {
    refreshTimer = setInterval(loadEarthquakes, intervalMs);
  }
}

els.refreshBtn.addEventListener('click', loadEarthquakes);
els.magFilter.addEventListener('input', () => {
  els.magValue.textContent = Number.parseFloat(els.magFilter.value).toFixed(1);
});
els.magFilter.addEventListener('change', loadEarthquakes);
els.daysFilter.addEventListener('change', loadEarthquakes);
els.refreshInterval.addEventListener('change', scheduleAutoRefresh);

els.trendsToggle.addEventListener('click', () => {
  const nowHidden = !els.trendsPanel.hidden;
  els.trendsPanel.hidden = nowHidden;
  els.trendsToggle.textContent = nowHidden ? 'Show trends' : 'Hide trends';
  if (!nowHidden) renderTrends(lastEarthquakes);
});

els.tableToggle.addEventListener('click', () => {
  const showingTable = !els.trendsTableWrap.hidden;
  els.trendsTableWrap.hidden = showingTable;
  els.trendsCharts.hidden = !showingTable;
  els.tableToggle.textContent = showingTable ? 'View as table' : 'View as charts';
});

const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window;
if (pushSupported) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function getExistingSubscription() {
  if (!pushSupported) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function updateAlertsUI() {
  if (!pushSupported) {
    els.alertsToggle.disabled = true;
    els.alertsStatus.textContent = 'Alerts not supported in this browser';
    return;
  }
  const subscription = await getExistingSubscription();
  const isOn = Boolean(subscription);
  els.alertsStatus.textContent = isOn ? 'Alerts on' : 'Alerts off';
  els.alertsStatus.classList.toggle('on', isOn);
  els.alertsToggle.textContent = isOn ? 'Disable alerts' : 'Enable alerts';
  els.alertsThresholdLabel.hidden = !isOn;
}

async function subscribeWithCurrentThreshold(subscription) {
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription,
      minMagnitude: Number.parseFloat(els.alertsThreshold.value),
    }),
  });
}

async function enableAlerts() {
  try {
    const registration = await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Notifications were blocked. Enable them in your browser/site settings to get alerts.');
      return;
    }

    const keyResponse = await fetch('/api/push/vapid-public-key');
    if (!keyResponse.ok) {
      alert('Push notifications are not configured on this server yet.');
      return;
    }
    const { publicKey } = await keyResponse.json();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await subscribeWithCurrentThreshold(subscription);
  } catch (error) {
    alert(`Could not enable alerts: ${error.message}`);
  }
}

async function disableAlerts() {
  const subscription = await getExistingSubscription();
  if (subscription) {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  }
}

els.alertsToggle.addEventListener('click', async () => {
  els.alertsToggle.disabled = true;
  const subscription = await getExistingSubscription();
  if (subscription) {
    await disableAlerts();
  } else {
    await enableAlerts();
  }
  await updateAlertsUI();
  els.alertsToggle.disabled = false;
});

els.alertsThreshold.addEventListener('change', async () => {
  const subscription = await getExistingSubscription();
  if (subscription) await subscribeWithCurrentThreshold(subscription);
});

updateAlertsUI();

const THEME_LABELS = { auto: 'Theme: Auto', light: 'Theme: Light', dark: 'Theme: Dark' };
const THEME_CYCLE = ['auto', 'light', 'dark'];

function currentTheme() {
  const stored = localStorage.getItem('theme');
  return stored === 'light' || stored === 'dark' ? stored : 'auto';
}

function applyTheme(theme) {
  if (theme === 'auto') {
    localStorage.removeItem('theme');
    document.documentElement.removeAttribute('data-theme');
  } else {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }
  els.themeToggle.textContent = THEME_LABELS[theme];

  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.getElementById('theme-color-meta').setAttribute('content', isDark ? '#131c2f' : '#ffffff');
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentTheme() === 'auto') applyTheme('auto');
  });
}

els.themeToggle.addEventListener('click', () => {
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(currentTheme()) + 1) % THEME_CYCLE.length];
  applyTheme(next);
});

applyTheme(currentTheme());

loadEarthquakes();
scheduleAutoRefresh();
