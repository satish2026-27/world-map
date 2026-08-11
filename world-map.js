// Premium World Map - Main Application
// Uses Natural Earth simplified SVG paths (projected) rendered via D3-style math

(function() {
  'use strict';

  // ─── STATE ─────────────────────────────────────────────────────────
  const state = {
    selectedCountry: null,
    hoveredCountry: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartPanX: 0,
    dragStartPanY: 0,
    colorMode: 'region', // region | population | gdp
    activeTab: 'info',
    theme: 'dark',
    sidebarOpen: true,
    filterRegion: null,
  };

  // Min/Max zoom
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 8;

  // ─── DOM REFS ───────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const svg = $('world-svg');
  const tooltip = $('tooltip');
  const sidebar = $('sidebar');

  // ─── UTIL ──────────────────────────────────────────────────────────
  function fmt(n) {
    if (n === undefined || n === null) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  function fmtGDP(n) {
    if (!n) return '—';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'T';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'B';
    return '$' + n + 'M';
  }

  function fmtArea(n) {
    if (!n) return '—';
    return n.toLocaleString() + ' km²';
  }

  function regionClass(region) {
    if (!region) return '';
    return 'region-' + region.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '');
  }

  // ─── COLOR LOGIC ────────────────────────────────────────────────────
  function getCountryColor(code) {
    const data = COUNTRIES_DATA[code];
    if (!data) return '#2a3a4a';

    if (state.colorMode === 'region') {
      const rc = REGION_COLORS[data.region];
      return rc ? rc.primary : '#2a3a4a';
    }

    if (state.colorMode === 'population') {
      const pop = data.population || 0;
      if (pop > 500e6) return '#1a237e';
      if (pop > 100e6) return '#1565c0';
      if (pop > 50e6)  return '#1e88e5';
      if (pop > 10e6)  return '#42a5f5';
      if (pop > 1e6)   return '#90caf9';
      return '#bbdefb';
    }

    if (state.colorMode === 'gdp') {
      const gdp = data.gdp || 0;
      if (gdp > 5e6)  return '#1b5e20';
      if (gdp > 1e6)  return '#2e7d32';
      if (gdp > 500e3) return '#43a047';
      if (gdp > 100e3) return '#66bb6a';
      if (gdp > 50e3)  return '#a5d6a7';
      return '#c8e6c9';
    }

    return '#2a3a4a';
  }

  // ─── COUNTRY DATA HELPERS ──────────────────────────────────────────
  function getPopulationDensity(code) {
    const d = COUNTRIES_DATA[code];
    if (!d || !d.population || !d.area) return null;
    return (d.population / d.area).toFixed(1);
  }

  // ─── TRANSFORM ─────────────────────────────────────────────────────
  function applyTransform() {
    const g = svg.querySelector('#map-group');
    if (g) {
      g.setAttribute('transform', `translate(${state.panX},${state.panY}) scale(${state.zoom})`);
    }
    updateMiniViewport();
    updateZoomIndicator();
  }

  function updateZoomIndicator() {
    const el = document.querySelector('.zoom-indicator');
    if (el) el.textContent = Math.round(state.zoom * 100) + '%';
  }

  function constrainPan() {
    const rect = svg.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    const mapW = 960, mapH = 500;
    const scaledW = mapW * state.zoom;
    const scaledH = mapH * state.zoom;

    const maxX = W * 0.5;
    const minX = W - scaledW - W * 0.5 + W * 0.5;
    const maxY = H * 0.5;
    const minY = H - scaledH - H * 0.5 + H * 0.5;

    // Allow generous panning
    const pad = 100;
    state.panX = Math.min(maxX + pad, Math.max(minX - pad, state.panX));
    state.panY = Math.min(maxY + pad, Math.max(minY - pad, state.panY));
  }

  // ─── ZOOM ──────────────────────────────────────────────────────────
  function zoomAt(cx, cy, factor) {
    const oldZoom = state.zoom;
    state.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom * factor));
    const zoomChange = state.zoom / oldZoom;
    state.panX = cx - (cx - state.panX) * zoomChange;
    state.panY = cy - (cy - state.panY) * zoomChange;
    constrainPan();
    applyTransform();
  }

  function resetView() {
    const rect = svg.getBoundingClientRect();
    state.zoom = Math.min(rect.width / 960, rect.height / 500) * 0.9;
    state.panX = (rect.width - 960 * state.zoom) / 2;
    state.panY = (rect.height - 500 * state.zoom) / 2;
    applyTransform();
  }

  // ─── COUNTRY FOCUS ─────────────────────────────────────────────────
  function focusCountry(code) {
    const path = svg.querySelector(`[data-code="${code}"]`);
    if (!path) return;

    const bbox = path.getBBox();
    const rect = svg.getBoundingClientRect();
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    const targetZoom = Math.min(MAX_ZOOM, Math.max(2, Math.min(rect.width / (bbox.width + 80), rect.height / (bbox.height + 80))));

    state.zoom = targetZoom;
    state.panX = rect.width / 2 - cx * state.zoom;
    state.panY = rect.height / 2 - cy * state.zoom;
    constrainPan();
    applyTransform();
  }

  // ─── TOOLTIP ───────────────────────────────────────────────────────
  function showTooltip(code, x, y) {
    const data = COUNTRIES_DATA[code];
    if (!data) return;

    tooltip.querySelector('.tooltip-flag').textContent = data.flag || '🏳️';
    tooltip.querySelector('.tooltip-name').textContent = data.name;
    tooltip.querySelector('.tooltip-capital').textContent = '🏛 ' + (data.capital || '—');
    tooltip.querySelector('.tooltip-pop').textContent = fmt(data.population);
    tooltip.querySelector('.tooltip-gdp').textContent = fmtGDP(data.gdp);
    tooltip.querySelector('.tooltip-region').textContent = data.region || '—';

    tooltip.classList.add('visible');
    moveTooltip(x, y);
  }

  function moveTooltip(x, y) {
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    let tx = x + 16, ty = y - 10;
    if (tx + tw > ww - 10) tx = x - tw - 16;
    if (ty + th > wh - 10) ty = y - th - 10;
    if (ty < 10) ty = 10;
    tooltip.style.left = tx + 'px';
    tooltip.style.top  = ty + 'px';
  }

  function hideTooltip() {
    tooltip.classList.remove('visible');
  }

  // ─── COUNTRY SELECTION ─────────────────────────────────────────────
  function selectCountry(code) {
    const prev = state.selectedCountry;
    state.selectedCountry = code;

    // Update SVG classes
    svg.querySelectorAll('.country').forEach(p => {
      const c = p.dataset.code;
      p.classList.remove('selected', 'dimmed');
      if (code) {
        if (c === code) p.classList.add('selected');
        else p.classList.add('dimmed');
      }
    });

    if (code) {
      renderCountryPanel(code);
      focusCountry(code);
      if (!state.sidebarOpen) toggleSidebar();
      // Switch to info tab
      switchTab('info');
    } else {
      renderEmptyPanel();
    }
  }

  function deselectCountry() {
    state.selectedCountry = null;
    svg.querySelectorAll('.country').forEach(p => {
      p.classList.remove('selected', 'dimmed');
    });
    renderEmptyPanel();
  }

  // ─── SIDEBAR PANELS ────────────────────────────────────────────────
  function renderEmptyPanel() {
    const panel = document.querySelector('.country-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="country-panel-empty animate-in">
        <div class="empty-icon">🌍</div>
        <p>Click on any country to explore detailed information</p>
      </div>
    `;
  }

  function renderCountryPanel(code) {
    const d = COUNTRIES_DATA[code];
    const panel = document.querySelector('.country-panel');
    if (!d || !panel) return;

    const density = getPopulationDensity(code);
    const regionCls = regionClass(d.region);

    panel.innerHTML = `
      <div class="animate-in">
        <div class="country-hero">
          <span class="country-flag-large">${d.flag || '🏳️'}</span>
          <div class="country-name-large">${d.name}</div>
          <div class="country-capital">🏛 ${d.capital || '—'}</div>
          <span class="region-badge ${regionCls}">${getRegionEmoji(d.region)} ${d.region || '—'}</span>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Population</div>
            <div class="stat-value">${fmt(d.population)}</div>
            <div class="stat-sub">${density ? density + '/km²' : ''}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">GDP</div>
            <div class="stat-value">${fmtGDP(d.gdp)}</div>
            <div class="stat-sub">Nominal</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Area</div>
            <div class="stat-value">${fmt(d.area)}</div>
            <div class="stat-sub">km²</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Subregion</div>
            <div class="stat-value" style="font-size:12px;font-weight:600">${d.subregion || '—'}</div>
          </div>
        </div>

        <div style="margin-bottom:16px">
          <div class="detail-row">
            <span class="detail-key">Currency</span>
            <span class="detail-val">💰 ${d.currency || '—'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-key">Language(s)</span>
            <span class="detail-val">🗣 ${d.language || '—'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-key">ISO Code</span>
            <span class="detail-val"><code style="background:var(--bg-primary);padding:2px 6px;border-radius:4px;font-size:12px">${code}</code></span>
          </div>
        </div>

        <button onclick="deselectAll()" style="
          width:100%;padding:10px;background:var(--bg-card);border:1px solid var(--border);
          border-radius:var(--radius-sm);color:var(--text-secondary);font-size:13px;
          font-family:inherit;cursor:pointer;transition:var(--transition);
        " onmouseover="this.style.background='var(--bg-card-hover)'"
           onmouseout="this.style.background='var(--bg-card)'">
          ✕ Deselect Country
        </button>
      </div>
    `;
  }

  window.deselectAll = () => {
    deselectCountry();
    resetView();
  };

  function getRegionEmoji(region) {
    const map = { Africa: '🌍', Americas: '🌎', Asia: '🌏', Europe: '🌍', Oceania: '🌊' };
    return map[region] || '🌐';
  }

  // ─── RANKINGS TAB ──────────────────────────────────────────────────
  function renderRankingsTab() {
    const panel = document.querySelector('.rankings-panel');
    if (!panel) return;

    const countries = Object.entries(COUNTRIES_DATA);

    // Top by population
    const byPop = countries.sort((a, b) => (b[1].population || 0) - (a[1].population || 0)).slice(0, 10);
    // Top by GDP
    const byGDP = countries.sort((a, b) => (b[1].gdp || 0) - (a[1].gdp || 0)).slice(0, 10);
    // Top by area
    const byArea = countries.sort((a, b) => (b[1].area || 0) - (a[1].area || 0)).slice(0, 10);

    const maxPop = byPop[0][1].population;
    const maxGDP = byGDP[0][1].gdp;
    const maxArea = byArea[0][1].area;

    panel.innerHTML = `
      <div style="margin-bottom:16px">
        <div class="ranking-section-title">👥 Top 10 by Population</div>
        ${byPop.map(([code, d], i) => `
          <div class="ranking-item" onclick="selectCountryExternal('${code}')">
            <span class="ranking-num ${i < 3 ? 'top3' : ''}">${i + 1}</span>
            <span class="ranking-flag">${d.flag}</span>
            <span class="ranking-name">${d.name}</span>
            <div>
              <div class="ranking-bar-wrap"><div class="ranking-bar" style="width:${Math.round(d.population/maxPop*100)}%"></div></div>
              <div class="ranking-value">${fmt(d.population)}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="margin-bottom:16px">
        <div class="ranking-section-title">💰 Top 10 by GDP</div>
        ${byGDP.map(([code, d], i) => `
          <div class="ranking-item" onclick="selectCountryExternal('${code}')">
            <span class="ranking-num ${i < 3 ? 'top3' : ''}">${i + 1}</span>
            <span class="ranking-flag">${d.flag}</span>
            <span class="ranking-name">${d.name}</span>
            <div>
              <div class="ranking-bar-wrap"><div class="ranking-bar" style="width:${Math.round(d.gdp/maxGDP*100)}%;background:linear-gradient(90deg,#10b981,#06b6d4)"></div></div>
              <div class="ranking-value">${fmtGDP(d.gdp)}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div>
        <div class="ranking-section-title">📐 Top 10 by Area</div>
        ${byArea.map(([code, d], i) => `
          <div class="ranking-item" onclick="selectCountryExternal('${code}')">
            <span class="ranking-num ${i < 3 ? 'top3' : ''}">${i + 1}</span>
            <span class="ranking-flag">${d.flag}</span>
            <span class="ranking-name">${d.name}</span>
            <div>
              <div class="ranking-bar-wrap"><div class="ranking-bar" style="width:${Math.round(d.area/maxArea*100)}%;background:linear-gradient(90deg,#f59e0b,#ef4444)"></div></div>
              <div class="ranking-value">${fmt(d.area)} km²</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  window.selectCountryExternal = (code) => {
    selectCountry(code);
    switchTab('info');
  };

  // ─── STATS TAB ─────────────────────────────────────────────────────
  function renderStatsTab() {
    const panel = document.querySelector('.stats-panel');
    if (!panel) return;

    const countries = Object.values(COUNTRIES_DATA);
    const totalPop = countries.reduce((s, d) => s + (d.population || 0), 0);
    const totalGDP = countries.reduce((s, d) => s + (d.gdp || 0), 0);
    const totalArea = countries.reduce((s, d) => s + (d.area || 0), 0);
    const count = countries.length;

    const regionCounts = {};
    countries.forEach(d => {
      regionCounts[d.region] = (regionCounts[d.region] || 0) + 1;
    });

    const maxCount = Math.max(...Object.values(regionCounts));
    const regionColors = {
      'Africa': '#FF7043', 'Americas': '#42A5F5', 'Asia': '#66BB6A',
      'Europe': '#AB47BC', 'Oceania': '#FFB300'
    };

    panel.innerHTML = `
      <div class="global-stat">
        <div class="global-stat-header">
          <div class="global-stat-title">Countries on Map</div>
          <div class="global-stat-icon">🌍</div>
        </div>
        <div class="global-stat-value">${count}</div>
        <div class="global-stat-sub">Sovereign nations represented</div>
      </div>

      <div class="global-stat">
        <div class="global-stat-header">
          <div class="global-stat-title">World Population</div>
          <div class="global-stat-icon">👥</div>
        </div>
        <div class="global-stat-value">${fmt(totalPop)}</div>
        <div class="global-stat-sub">Combined population</div>
      </div>

      <div class="global-stat">
        <div class="global-stat-header">
          <div class="global-stat-title">Combined GDP</div>
          <div class="global-stat-icon">💰</div>
        </div>
        <div class="global-stat-value">${fmtGDP(totalGDP)}</div>
        <div class="global-stat-sub">Nominal USD</div>
      </div>

      <div class="global-stat">
        <div class="global-stat-header">
          <div class="global-stat-title">Total Land Area</div>
          <div class="global-stat-icon">📐</div>
        </div>
        <div class="global-stat-value">${fmt(totalArea)}</div>
        <div class="global-stat-sub">km² of land</div>
      </div>

      <div class="region-breakdown" style="margin-top:16px">
        <div class="ranking-section-title">🗂 Countries by Region</div>
        ${Object.entries(regionCounts).sort((a,b)=>b[1]-a[1]).map(([region, cnt]) => `
          <div class="region-row">
            <div class="region-dot" style="background:${regionColors[region] || '#888'}"></div>
            <div class="region-name">${region}</div>
            <div class="region-count">${cnt}</div>
            <div class="region-bar-wrap">
              <div class="region-bar" style="width:${Math.round(cnt/maxCount*100)}%;background:${regionColors[region] || '#888'}"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ─── TAB SWITCHING ─────────────────────────────────────────────────
  function switchTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.sidebar-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.style.display = pane.dataset.tab === tab ? 'block' : 'none';
    });
    if (tab === 'rankings') renderRankingsTab();
    if (tab === 'stats') renderStatsTab();
  }

  // ─── SEARCH ────────────────────────────────────────────────────────
  function setupSearch() {
    const input = $('search-input');
    const results = document.querySelector('.search-results');

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.classList.remove('visible'); return; }

      const matches = Object.entries(COUNTRIES_DATA).filter(([code, d]) =>
        d.name.toLowerCase().includes(q) ||
        (d.capital && d.capital.toLowerCase().includes(q)) ||
        code.toLowerCase() === q
      ).slice(0, 8);

      if (!matches.length) { results.classList.remove('visible'); return; }

      results.innerHTML = matches.map(([code, d]) => `
        <div class="search-result-item" data-code="${code}">
          <span class="search-result-flag">${d.flag}</span>
          <span class="search-result-name">${d.name}</span>
          <span class="search-result-region">${d.region}</span>
        </div>
      `).join('');
      results.classList.add('visible');

      results.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          selectCountry(item.dataset.code);
          input.value = '';
          results.classList.remove('visible');
        });
      });
    });

    document.addEventListener('click', e => {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.classList.remove('visible');
      }
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { results.classList.remove('visible'); input.blur(); }
    });
  }

  // ─── SIDEBAR TOGGLE ────────────────────────────────────────────────
  function toggleSidebar() {
    state.sidebarOpen = !state.sidebarOpen;
    sidebar.classList.toggle('collapsed', !state.sidebarOpen);
    const btn = $('toggle-sidebar-btn');
    if (btn) btn.textContent = state.sidebarOpen ? '◀ Hide Panel' : '▶ Show Panel';
  }

  // ─── THEME ─────────────────────────────────────────────────────────
  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const btn = $('theme-btn');
    if (btn) btn.innerHTML = `<span class="btn-icon">${theme === 'dark' ? '☀️' : '🌙'}</span> ${theme === 'dark' ? 'Light' : 'Dark'}`;
    localStorage.setItem('wm-theme', theme);
  }

  // ─── COLOR MODE ────────────────────────────────────────────────────
  function setColorMode(mode) {
    state.colorMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    applyColors();
    updateLegend();
  }

  function applyColors() {
    svg.querySelectorAll('.country').forEach(path => {
      path.style.fill = getCountryColor(path.dataset.code);
    });
  }

  function updateLegend() {
    const legend = $('legend');
    if (!legend) return;

    if (state.colorMode === 'region') {
      legend.classList.remove('hidden');
      const items = Object.entries(REGION_COLORS).map(([region, colors]) => `
        <div class="legend-item" onclick="filterByRegion('${region}')">
          <div class="legend-dot" style="background:${colors.primary}"></div>
          <span class="legend-label">${region}</span>
        </div>
      `).join('');
      legend.querySelector('.legend-items').innerHTML = items;
    } else if (state.colorMode === 'population') {
      legend.classList.remove('hidden');
      const items = [
        { color: '#1a237e', label: '>500M' },
        { color: '#1565c0', label: '>100M' },
        { color: '#1e88e5', label: '>50M' },
        { color: '#42a5f5', label: '>10M' },
        { color: '#90caf9', label: '>1M' },
        { color: '#bbdefb', label: '<1M' },
      ].map(i => `
        <div class="legend-item">
          <div class="legend-dot" style="background:${i.color}"></div>
          <span class="legend-label">${i.label}</span>
        </div>
      `).join('');
      legend.querySelector('.legend-items').innerHTML = items;
    } else if (state.colorMode === 'gdp') {
      legend.classList.remove('hidden');
      const items = [
        { color: '#1b5e20', label: '>$5T' },
        { color: '#2e7d32', label: '>$1T' },
        { color: '#43a047', label: '>$500B' },
        { color: '#66bb6a', label: '>$100B' },
        { color: '#a5d6a7', label: '>$50B' },
        { color: '#c8e6c9', label: '<$50B' },
      ].map(i => `
        <div class="legend-item">
          <div class="legend-dot" style="background:${i.color}"></div>
          <span class="legend-label">${i.label}</span>
        </div>
      `).join('');
      legend.querySelector('.legend-items').innerHTML = items;
    }
  }

  window.filterByRegion = (region) => {
    if (state.filterRegion === region) {
      state.filterRegion = null;
      svg.querySelectorAll('.country').forEach(p => p.classList.remove('dimmed'));
      showNotification('Showing all regions');
    } else {
      state.filterRegion = region;
      svg.querySelectorAll('.country').forEach(p => {
        const code = p.dataset.code;
        const d = COUNTRIES_DATA[code];
        p.classList.toggle('dimmed', !d || d.region !== region);
      });
      showNotification(`Filtered: ${region}`);
    }
  };

  // ─── NOTIFICATIONS ─────────────────────────────────────────────────
  function showNotification(msg) {
    const el = $('notification');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('visible'), 2500);
  }

  // ─── MINI MAP ──────────────────────────────────────────────────────
  function updateMiniViewport() {
    const miniRect = document.querySelector('#mini-map-container');
    if (!miniRect) return;
    const viewport = document.querySelector('.mini-viewport');
    if (!viewport) return;

    const svgRect = svg.getBoundingClientRect();
    const scaleX = 160 / 960;
    const scaleY = 90 / 500;

    const vx = (-state.panX / state.zoom) * scaleX;
    const vy = (-state.panY / state.zoom) * scaleY;
    const vw = (svgRect.width / state.zoom) * scaleX;
    const vh = (svgRect.height / state.zoom) * scaleY;

    viewport.setAttribute('x', Math.max(0, vx));
    viewport.setAttribute('y', Math.max(0, vy));
    viewport.setAttribute('width', Math.min(160, vw));
    viewport.setAttribute('height', Math.min(90, vh));
  }

  // ─── SVG MOUSE EVENTS ──────────────────────────────────────────────
  function setupMapInteraction() {
    // Mouse move for tooltip
    svg.addEventListener('mousemove', e => {
      const target = e.target.closest('.country');
      if (target) {
        const code = target.dataset.code;
        if (code !== state.hoveredCountry) {
          state.hoveredCountry = code;
          showTooltip(code, e.clientX, e.clientY);
        } else {
          moveTooltip(e.clientX, e.clientY);
        }
      } else {
        state.hoveredCountry = null;
        hideTooltip();
      }

      // Pan
      if (state.isDragging) {
        state.panX = state.dragStartPanX + (e.clientX - state.dragStartX);
        state.panY = state.dragStartPanY + (e.clientY - state.dragStartY);
        constrainPan();
        applyTransform();
      }

      // Update coords display
      const svgPt = svgClientToMap(e.clientX, e.clientY);
      const coords = document.querySelector('.map-coords');
      if (coords) {
        const lng = ((svgPt.x / 960) * 360 - 180).toFixed(2);
        const lat = (90 - (svgPt.y / 500) * 180).toFixed(2);
        coords.textContent = `${lat > 0 ? lat + '°N' : Math.abs(lat) + '°S'} ${lng > 0 ? lng + '°E' : Math.abs(lng) + '°W'}`;
      }
    });

    svg.addEventListener('mousedown', e => {
      if (e.target.closest('.country')) return;
      state.isDragging = true;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;
      state.dragStartPanX = state.panX;
      state.dragStartPanY = state.panY;
    });

    window.addEventListener('mouseup', () => { state.isDragging = false; });

    svg.addEventListener('click', e => {
      if (state.isDragging) return;
      const target = e.target.closest('.country');
      if (target) {
        const code = target.dataset.code;
        if (state.selectedCountry === code) {
          deselectCountry();
          resetView();
        } else {
          selectCountry(code);
        }
      }
    });

    svg.addEventListener('mouseleave', () => {
      hideTooltip();
      state.hoveredCountry = null;
    });

    // Wheel zoom
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const rect = svg.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
    }, { passive: false });

    // Touch support
    let lastTouchDist = null;
    svg.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        state.isDragging = true;
        state.dragStartX = e.touches[0].clientX;
        state.dragStartY = e.touches[0].clientY;
        state.dragStartPanX = state.panX;
        state.dragStartPanY = state.panY;
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    svg.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && state.isDragging) {
        state.panX = state.dragStartPanX + (e.touches[0].clientX - state.dragStartX);
        state.panY = state.dragStartPanY + (e.touches[0].clientY - state.dragStartY);
        constrainPan();
        applyTransform();
      } else if (e.touches.length === 2 && lastTouchDist) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / lastTouchDist;
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = svg.getBoundingClientRect();
        zoomAt(cx - rect.left, cy - rect.top, factor);
        lastTouchDist = dist;
      }
    }, { passive: true });

    svg.addEventListener('touchend', () => {
      state.isDragging = false;
      lastTouchDist = null;
    });

    // Double-click to zoom in
    svg.addEventListener('dblclick', e => {
      const rect = svg.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, 2);
    });
  }

  function svgClientToMap(cx, cy) {
    const rect = svg.getBoundingClientRect();
    return {
      x: (cx - rect.left - state.panX) / state.zoom,
      y: (cy - rect.top  - state.panY) / state.zoom
    };
  }

  // ─── BUTTON EVENTS ─────────────────────────────────────────────────
  function setupButtons() {
    $('zoom-in-btn').onclick  = () => { const r = svg.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 1.4); };
    $('zoom-out-btn').onclick = () => { const r = svg.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 1/1.4); };
    $('reset-btn').onclick    = resetView;
    $('theme-btn').onclick    = () => setTheme(state.theme === 'dark' ? 'light' : 'dark');
    $('toggle-sidebar-btn').onclick = toggleSidebar;

    document.querySelectorAll('.sidebar-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setColorMode(btn.dataset.mode));
    });
  }

  // ─── KEYBOARD SHORTCUTS ────────────────────────────────────────────
  function setupKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key) {
        case 'Escape':   deselectCountry(); resetView(); break;
        case '+': case '=': { const r = svg.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 1.3); break; }
        case '-':           { const r = svg.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 1/1.3); break; }
        case 'r': case 'R': resetView(); break;
        case 't': case 'T': setTheme(state.theme === 'dark' ? 'light' : 'dark'); break;
        case '/': $('search-input').focus(); e.preventDefault(); break;
        case 's': case 'S': toggleSidebar(); break;
      }
    });
  }

  // ─── RESIZE HANDLER ────────────────────────────────────────────────
  function setupResize() {
    window.addEventListener('resize', () => {
      resetView();
    });
  }

  // ─── LOADING ───────────────────────────────────────────────────────
  function hideLoading() {
    const loading = $('loading');
    if (loading) {
      loading.classList.add('fade-out');
      setTimeout(() => loading.remove(), 600);
    }
  }

  // ─── INIT ──────────────────────────────────────────────────────────
  function init() {
    // Restore theme
    const savedTheme = localStorage.getItem('wm-theme') || 'dark';
    setTheme(savedTheme);

    // Apply initial colors
    applyColors();
    updateLegend();

    // Setup all interactions
    setupSearch();
    setupButtons();
    setupKeyboard();
    setupResize();
    setupMapInteraction();

    // Initial view
    setTimeout(() => {
      resetView();
      renderEmptyPanel();
      renderStatsTab();
      switchTab('info');
      hideLoading();
      showNotification('🌍 Premium World Map loaded — click any country!');
    }, 1200);
  }

  document.addEventListener('DOMContentLoaded', init);

})();
