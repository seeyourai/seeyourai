/**
 * Shared dashboard HTML/JS for seeyourai web and desktop
 *
 * Single source of truth for the dashboard UI. Both `seeyourai serve`
 * and `seeyourai desktop` use this same code.
 */

export interface DashboardOptions {
	/** Enable Electron-specific styling (traffic light clearance, drag regions) */
	electron?: boolean;
}

/**
 * Generate the dashboard HTML with optional Electron tweaks
 */
export function generateDashboardHTML(options: DashboardOptions = {}): string {
	const isElectron = options.electron ?? false;

	// Base styles shared between web and desktop
	const baseStyles = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0d1117; color: #e6edf3; font-family: 'Segoe UI', system-ui, sans-serif; min-height: 100vh; }
a { color: #58a6ff; text-decoration: none; }
${
	isElectron
		? `
/* Electron: drag region + traffic light clearance */
.header {
  background: #161b22;
  border-bottom: 1px solid #30363d;
  padding: 12px 24px 12px 80px;
  display: flex;
  align-items: center;
  gap: 16px;
  -webkit-app-region: drag;
  user-select: none;
}
.header .live-dot { -webkit-app-region: no-drag; }
.search-box { -webkit-app-region: no-drag; }
.tab { -webkit-app-region: no-drag; }
`
		: `
.header { background: #161b22; border-bottom: 1px solid #30363d; padding: 12px 24px; display: flex; align-items: center; gap: 16px; }
`
}
.header h1 { font-size: 18px; color: #58a6ff; font-weight: 700; }
.header .subtitle { font-size: 13px; color: #7d8590; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: #2ea043; animation: pulse 2s infinite; margin-left: auto; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
.layout { display: flex; height: calc(100vh - 50px); }
.sidebar { width: 280px; border-right: 1px solid #30363d; overflow-y: auto; background: #161b22; flex-shrink: 0; }
.sidebar-header { padding: 12px 16px; font-size: 12px; color: #7d8590; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #30363d; }
.session-item { padding: 10px 16px; cursor: pointer; border-bottom: 1px solid #21262d; transition: background 0.15s; display: flex; justify-content: space-between; align-items: flex-start; }
.session-item:hover { background: #21262d; }
.session-item.active { background: #1f3a5f; border-left: 3px solid #58a6ff; }
.session-info { flex: 1; min-width: 0; }
.session-delete { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 16px; color: #7d8590; cursor: pointer; margin-left: 8px; opacity: 0; transition: all 0.15s; -webkit-app-region: no-drag; }
.session-delete:hover { background: #f85149; color: #fff; }
.session-item:hover .session-delete { opacity: 1; }
.session-date { font-size: 13px; font-weight: 500; color: #e6edf3; }
.session-meta { font-size: 11px; color: #7d8590; margin-top: 3px; }
.session-cost { color: #3fb950; }
.main { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.toolbar { padding: 10px 20px; background: #161b22; border-bottom: 1px solid #30363d; display: flex; align-items: center; gap: 12px; }
.search-box { flex: 1; max-width: 300px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 6px 12px; color: #e6edf3; font-size: 13px; outline: none; }
.search-box:focus { border-color: #58a6ff; }
.tab { padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; color: #7d8590; border: 1px solid transparent; transition: all 0.15s; }
.tab.active { background: #1f3a5f; color: #58a6ff; border-color: #1f3a5f; }
.tab:hover:not(.active) { background: #21262d; color: #e6edf3; }
.content { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; gap: 16px; }
.global-panel { flex: 1; overflow-y: auto; background: #0d1117; display: none; }
.prompt-list { flex: 1; min-width: 0; }
.prompt-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; margin-bottom: 10px; overflow: hidden; cursor: pointer; transition: border-color 0.15s; }
.prompt-card:hover { border-color: #58a6ff; }
.prompt-card.selected { border-color: #58a6ff; background: #1a2332; }
.prompt-header { padding: 10px 14px; display: flex; align-items: center; gap: 10px; }
.prompt-time { font-size: 11px; color: #7d8590; }
.prompt-text { font-size: 13px; color: #e6edf3; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prompt-cost { font-size: 12px; color: #3fb950; font-weight: 600; }
.prompt-tokens { font-size: 11px; color: #7d8590; }
.tool-badge { display: inline-block; background: #21262d; border-radius: 4px; padding: 1px 6px; font-size: 11px; color: #79c0ff; margin: 0 2px; }
.detail-panel { width: 420px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }
.detail-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }
.detail-title { padding: 8px 14px; background: #21262d; font-size: 12px; color: #7d8590; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
.detail-body { padding: 12px 14px; font-size: 13px; line-height: 1.6; }
.detail-body pre { white-space: pre-wrap; word-break: break-word; font-family: 'Cascadia Code', 'JetBrains Mono', monospace; font-size: 12px; }
.tool-row { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid #21262d; }
.tool-row:last-child { border-bottom: none; }
.tool-icon { font-size: 14px; }
.tool-name { font-weight: 600; color: #79c0ff; font-size: 13px; min-width: 60px; }
.tool-args { color: #7d8590; font-size: 12px; word-break: break-all; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 4px; }
.badge.skill { background: #3b82f6; color: white; }
.badge.mcp { background: #8b5cf6; color: white; }
.badge.tool { background: #10b981; color: white; }
.badge.bash { background: #f59e0b; color: white; }
.badge.success { background: #10b981; color: white; }
.badge.error { background: #ef4444; color: white; }
.info-banner {
  background: #1e40af;
  color: white;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
}
.info-banner a {
  color: #93c5fd;
  text-decoration: underline;
}
.data-info-panel {
  padding: 16px;
  background: #1f2937;
  border-radius: 8px;
}
.data-info-panel h3 {
  font-size: 16px;
  color: #e6edf3;
  margin-bottom: 12px;
}
.data-info-panel h4 {
  font-size: 13px;
  color: #7d8590;
  margin: 16px 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.data-info-panel ul {
  margin: 8px 0;
  padding-left: 20px;
}
.data-info-panel li {
  font-size: 13px;
  color: #e6edf3;
  margin: 4px 0;
}
.data-info-panel .note {
  font-size: 12px;
  color: #7d8590;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #30363d;
}
.data-info-panel .muted {
  color: #7d8590;
}
.tool-event {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
}
.tool-badges {
  margin-bottom: 8px;
}
.tool-meta {
  font-size: 12px;
  color: #7d8590;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #21262d;
}
.truncated {
  font-size: 11px;
  color: #7d8590;
  font-style: italic;
}
.response-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
}
.response-header {
  padding: 10px 14px;
  background: #21262d;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.response-header .timestamp {
  font-size: 12px;
  color: #7d8590;
}
.response-header .model {
  font-size: 11px;
  color: #58a6ff;
  background: #1f3a5f;
  padding: 2px 8px;
  border-radius: 4px;
}
.request-section,
.response-section,
.params-section,
.result-section,
.command-section {
  padding: 12px 14px;
  border-top: 1px solid #30363d;
}
.request-section h4,
.response-section h4,
.params-section h4,
.result-section h4,
.command-section h4 {
  font-size: 12px;
  color: #7d8590;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.request-section pre,
.params-section pre,
.result-section pre,
.command-section pre {
  font-size: 12px;
  color: #e6edf3;
  background: #0d1117;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
}
.metadata {
  padding: 10px 14px;
  background: #21262d;
  font-size: 12px;
  color: #7d8590;
  display: flex;
  gap: 16px;
}
.stat-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
.stat-label { color: #7d8590; }
.stat-value { font-weight: 600; }
.stat-value.green { color: #3fb950; }
.stat-value.blue { color: #58a6ff; }
.stat-value.magenta { color: #bc8cff; }
.empty { text-align: center; padding: 60px 20px; color: #7d8590; }
.empty h2 { font-size: 20px; margin-bottom: 8px; color: #e6edf3; }
.bar-chart { display: flex; flex-direction: column; gap: 6px; }
.bar-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.bar-label { width: 130px; color: #7d8590; text-align: right; flex-shrink: 0; }
.bar-fill { height: 16px; background: #1f6feb; border-radius: 3px; min-width: 2px; transition: width 0.3s; }
.bar-value { color: #3fb950; width: 70px; }
.bar-sub { color: #7d8590; }
.copy-btn { float: right; padding: 3px 10px; font-size: 11px; background: #21262d; border: 1px solid #30363d; border-radius: 4px; color: #7d8590; cursor: pointer; }
.copy-btn:hover { background: #30363d; color: #e6edf3; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
.stat-card-label { font-size: 11px; color: #7d8590; text-transform: uppercase; letter-spacing: 0.5px; }
.stat-card-value { font-size: 28px; font-weight: 700; margin-top: 6px; }
.stat-card-value.green { color: #3fb950; }
.stat-card-value.blue { color: #58a6ff; }
.stat-card-value.purple { color: #bc8cff; }
.stat-card-value.orange { color: #f0883e; }
/* JSON syntax highlighting */
.json-key { color: #7ee787; }
.json-string { color: #a5d6ff; }
.json-number { color: #79c0ff; }
.json-boolean { color: #bc8cff; }
.json-null { color: #ff7b72; }
.json-collapsible { cursor: pointer; user-select: none; }
.json-collapsible:hover { background: #21262d; }
.json-toggle-icon { display: inline-block; width: 12px; margin-right: 4px; color: #7d8590; font-size: 10px; }
.json-toggle-icon.collapsed::before { content: '▶'; }
.json-toggle-icon.expanded::before { content: '▼'; }
.json-block { margin-left: 16px; }
.json-block.collapsed { display: none; }
.raw-otlp-container { display: flex; gap: 0; height: 100%; overflow: hidden; }
.raw-otlp-list { width: 320px; flex-shrink: 0; border-right: 1px solid #30363d; overflow-y: auto; background: #161b22; }
.raw-otlp-detail { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.raw-otlp-toolbar { padding: 10px 16px; background: #21262d; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; }
.raw-otlp-filename { font-size: 13px; color: #e6edf3; font-weight: 500; }
.raw-otlp-json { flex: 1; overflow: auto; padding: 16px; font-family: 'Cascadia Code', 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.5; }
.raw-otlp-search { background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 4px 10px; color: #e6edf3; font-size: 12px; width: 180px; outline: none; }
.raw-otlp-search:focus { border-color: #58a6ff; }
.raw-otlp-empty-detail { flex: 1; display: flex; align-items: center; justify-content: center; color: #7d8590; }

/* Enhanced Collapsible Panels */
.collapsible-header { padding: 10px 14px; background: #1c2128; border-top: 1px solid #30363d; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 600; color: #e6edf3; transition: background 0.2s; user-select: none; }
.collapsible-header:hover { background: #22272e; }
.collapsible-header .toggle-icon { font-size: 10px; color: #7d8590; transition: transform 0.2s; }
.collapsible-content { display: none; padding: 12px 14px; border-top: 1px solid #30363d; background: #0d1117; }
.collapsible-content.expanded { display: block; }

/* Token Mini Dashboard */
.token-dash { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 8px; }
.token-stat { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 10px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.token-stat-val { font-size: 16px; font-weight: 700; }
.token-stat-label { font-size: 10px; color: #7d8590; text-transform: uppercase; margin-top: 4px; }
.token-stat-val.input { color: #58a6ff; }
.token-stat-val.output { color: #3fb950; }
.token-stat-val.cache { color: #bc8cff; }
.token-stat-val.cost { color: #f0883e; }
`;

	// Client-side JavaScript (shared between web and desktop)
	const clientScript = `
(function() {
  // Dashboard state management - centralized state
  const state = {
    // Navigation state
    activeTab: 'prompts',
    selectedSessionId: null,
    selectedPromptId: null,
    selectedRawOtlFile: null,
    selectedRawResponseId: null,
    searchQuery: '',
    rawOtlSearchQuery: '',
    // Data caches
    sessions: [],
    currentSessionEvents: [],
    rawOtlFiles: [],
    rawOtlFileData: null,
    rawResponses: [],
    analyticsDeadContext: null
  };

  // Session-aware data loading
  async function loadRawResponses(sessionId) {
    try {
      const url = sessionId
        ? '/api/raw-responses?sessionId=' + encodeURIComponent(sessionId)
        : '/api/raw-responses';
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      state.rawResponses = await r.json();
    } catch (e) {
      console.error('Failed to load raw responses:', e);
      state.rawResponses = [];
    }
  }

  async function loadRawOtlFiles(sessionId) {
    try {
      const url = sessionId
        ? '/api/raw-otlp?sessionId=' + encodeURIComponent(sessionId)
        : '/api/raw-otlp';
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      state.rawOtlFiles = await r.json();
    } catch (e) {
      console.error('Failed to load raw OTLP files:', e);
      state.rawOtlFiles = [];
    }
  }

  async function loadRawOtlFileData(filename) {
    try {
      const r = await fetch('/api/raw-otlp?file=' + encodeURIComponent(filename));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      state.rawOtlFileData = await r.json();
    } catch (e) {
      console.error('Failed to load raw OTLP file data:', e);
      state.rawOtlFileData = null;
    }
  }

  async function loadAnalyticsData(sessionId) {
    try {
      const url = '/api/optimize' + (sessionId ? '?sessionId=' + encodeURIComponent(sessionId) : '');
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      state.analyticsDeadContext = await r.json();
    } catch (e) {
      console.error('Failed to load analytics data:', e);
      state.analyticsDeadContext = null;
    }
  }

  function renderDataInfoPanel() {
    return '<div class="data-info-panel">' +
      '<h3>What Data seeyourai Captures</h3>' +
      '<p>seeyourai receives OpenTelemetry data from Claude Code. Due to privacy design, the following data is available:</p>' +
      '<h4>Available Data</h4>' +
      '<ul>' +
        '<li>Prompt/request text you send to Claude</li>' +
        '<li>Tool calls made by Claude (skill names, MCP tools, bash commands)</li>' +
        '<li>Token usage and costs</li>' +
        '<li>Model information</li>' +
        '<li>Duration and timing</li>' +
        '<li>Raw OTLP spans</li>' +
      '</ul>' +
      '<h4>Not Available (Privacy-Protected)</h4>' +
      '<ul>' +
        '<li>Claude's response content</li>' +
        '<li>Generated code output</li>' +
        '<li>Conversation history</li>' +
      '</ul>' +
      '<p class="note">This is by design - Claude Code intentionally does not expose AI responses via OTEL to protect sensitive information.</p>' +
    '</div>';
  }

  function renderRawResponses(content) {
    hideSettings();
    const infoPanel = renderDataInfoPanel();
    if (state.rawResponses.length === 0) {
      content.innerHTML = infoPanel +
        '<div class="empty">' +
          '<h2>No prompt data available</h2>' +
          '<p>Claude Code's telemetry includes request prompts but not AI response content (privacy design). Raw request data is captured when <code>seeyourai run claude</code> runs with OTEL enabled.</p>' +
        '</div>';
      return;
    }

    const responseList = state.rawResponses.slice(0, 50).map(r => {
      const isSelected = state.selectedRawResponseId === r.id;
      const preview = (r.request ?? '').slice(0, 40) || 'No preview';
      return '<div class="prompt-card ' + (isSelected ? 'selected' : '') + '" onclick="window.selectResponse(' + JSON.stringify(r.id).slice(1, -1) + ')">' +
        '<div class="prompt-header">' +
          '<span class="prompt-time">' + new Date(r.timestamp).toLocaleTimeString() + '</span>' +
          '<span class="prompt-text">' + esc(preview) + '</span>' +
          '<span class="prompt-cost">' + (r.tokenCount ?? r.charCount ?? 0) + ' chars</span>' +
        '</div>' +
      '</div>';
    }).join('');

    let detail = '';
    if (state.selectedRawResponseId) {
      const resp = state.rawResponses.find(r => r.id === state.selectedRawResponseId);
      if (resp) {
        detail = '<div class="detail-panel" style="width:500px">' +
          '<div class="detail-card">' +
            '<div class="detail-title">Request</div>' +
            '<div class="detail-body"><pre style="white-space:pre-wrap;word-break:break-word">' + esc(resp.request ?? '[no request]') + '</pre></div>' +
          '</div>' +
          '<div class="detail-card">' +
            '<div class="detail-title">Response (' + (resp.charCount ?? 0) + ' chars)</div>' +
            '<div class="detail-body"><pre style="white-space:pre-wrap;word-break:break-word">' + esc(resp.response ?? '[no response]') + '</pre></div>' +
          '</div>' +
          '<div class="detail-card">' +
            '<div class="detail-title">Metadata</div>' +
            '<div class="detail-body">' +
              '<div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">' + esc(resp.id.slice(0, 16)) + '...</span></div>' +
              '<div class="stat-row"><span class="stat-label">Timestamp</span><span class="stat-value">' + new Date(resp.timestamp).toLocaleString() + '</span></div>' +
              '<div class="stat-row"><span class="stat-label">Model</span><span class="stat-value">' + esc(resp.model ?? 'unknown') + '</span></div>' +
              '<div class="stat-row"><span class="stat-label">Chunks</span><span class="stat-value">' + (resp.chunkCount ?? 0) + '</span></div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }
    }

    content.innerHTML = infoPanel + '<div class="prompt-list">' + responseList + '</div>' +
      (detail || '<div class="empty">Select a response to view details</div>');
  }

  window.selectResponse = function(id) {
    state.selectedRawResponseId = id;
    renderRawResponses(document.getElementById('content'));
  };

  function renderRawOtl(content) {
    hideSettings();

    if (state.rawOtlFiles.length === 0) {
      content.innerHTML = '<div class="empty">' +
          '<h2>No raw OTLP data</h2>' +
          '<p>Raw OTLP batches are captured when <code>seeyourai trace</code> runs with raw storage enabled.</p>' +
        '</div>';
      return;
    }

    // Build file list
    const filesList = state.rawOtlFiles.slice(0, 50).map(f => {
      const isSelected = state.selectedRawOtlFile === f.filename;
      return '<div class="prompt-card ' + (isSelected ? 'selected' : '') + '" onclick="window.selectRawFile(' + JSON.stringify(f.filename).slice(1, -1) + ')">' +
        '<div class="prompt-header">' +
          '<span class="prompt-time">' + new Date(f.receivedAt).toLocaleTimeString() + '</span>' +
          '<span class="prompt-text">' + f.spanCount + ' spans - ' + (f.scopeName ?? 'unknown') + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    // Build detail panel
    let detailHtml = '';
    if (state.selectedRawOtlFile && state.rawOtlFileData) {
      detailHtml = renderRawOtlDetail();
    } else if (state.selectedRawOtlFile && !state.rawOtlFileData) {
      detailHtml = '<div class="raw-otlp-empty-detail"><div class="empty">Loading...</div></div>';
    } else {
      detailHtml = '<div class="raw-otlp-empty-detail"><div class="empty">Select a raw OTLP file to view</div></div>';
    }

    content.innerHTML = '<div class="raw-otlp-container">' +
      '<div class="raw-otlp-list">' + filesList + '</div>' +
      '<div class="raw-otlp-detail" id="raw-otlp-detail-panel">' + detailHtml + '</div>' +
    '</div>';

    // Attach search handler if detail panel exists
    const searchInput = document.getElementById('raw-otlp-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.rawOtlSearchQuery = (e.target.value ?? '').toLowerCase();
        const jsonContainer = document.getElementById('raw-otlp-json-content');
        if (jsonContainer) {
          highlightRawOtlSearch(jsonContainer);
        }
      });
    }
  }

  function renderRawOtlDetail() {
    if (!state.rawOtlFileData) return '';

    const copyId = 'copy_raw_' + Math.random().toString(36).slice(2);
    window[copyId] = () => {
      navigator.clipboard?.writeText(JSON.stringify(state.rawOtlFileData, null, 2)).then(() => {
        const btn = document.getElementById(copyId);
        if (btn) {
          btn.textContent = 'Copied!';
          setTimeout(() => btn.textContent = 'Copy JSON', 1500);
        }
      });
    };

    const fileName = state.selectedRawOtlFile.split('/').pop() || state.selectedRawOtlFile;
    const jsonHtml = formatJsonWithHighlight(state.rawOtlFileData);

    return '<div class="raw-otlp-toolbar">' +
        '<span class="raw-otlp-filename">' + esc(fileName) + '</span>' +
        '<div style="display:flex;gap:10px;align-items:center;">' +
          '<input type="text" id="raw-otlp-search" class="raw-otlp-search" placeholder="Search JSON..." value="' + esc(state.rawOtlSearchQuery) + '" />' +
          '<button class="copy-btn" id="' + copyId + '" onclick="window[' + JSON.stringify(copyId) + ']()">Copy JSON</button>' +
        '</div>' +
      '</div>' +
      '<div class="raw-otlp-json" id="raw-otlp-json-content">' + jsonHtml + '</div>';
  }

  function formatJsonWithHighlight(obj, key) {
    if (obj === null) {
      return '<span class="json-null">null</span>';
    }
    if (typeof obj === 'boolean') {
      return '<span class="json-boolean">' + obj + '</span>';
    }
    if (typeof obj === 'number') {
      return '<span class="json-number">' + obj + '</span>';
    }
    if (typeof obj === 'string') {
      const escaped = esc(obj).replace(/"/g, '&quot;');
      return '<span class="json-string">"' + escaped + '"</span>';
    }
    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return '<span class="json-boolean">[]</span>';
      }
      const items = obj.map((item, idx) => {
        const isComplex = typeof item === 'object' && item !== null;
        if (isComplex) {
          return '<div class="json-item">' + formatJsonWithHighlight(item) + '</div>';
        }
        return '<div class="json-item">' + formatJsonWithHighlight(item) + '</div>';
      }).join('');
      return '<span class="json-collapsible" onclick="window.toggleJsonCollapse(this)">' +
        '<span class="json-toggle-icon expanded"></span>[</span>' +
        '<div class="json-block">' + items + '</div>' +
        '<span class="json-boolean">]</span>';
    }
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) {
        return '<span class="json-boolean">{}</span>';
      }
      const pairs = keys.map(k => {
        const val = obj[k];
        const isComplex = typeof val === 'object' && val !== null;
        const keyStr = '<span class="json-key">"' + esc(k) + '"</span>';
        if (isComplex) {
          return '<div class="json-pair">' + keyStr + ': ' + formatJsonWithHighlight(val, k) + '</div>';
        }
        return '<div class="json-pair">' + keyStr + ': ' + formatJsonWithHighlight(val) + '</div>';
      }).join('');
      return '<span class="json-collapsible" onclick="window.toggleJsonCollapse(this)">' +
        '<span class="json-toggle-icon expanded"></span>{</span>' +
        '<div class="json-block">' + pairs + '</div>' +
        '<span class="json-boolean">}</span>';
    }
    return esc(String(obj));
  }

  window.toggleJsonCollapse = function(el) {
    const icon = el.querySelector('.json-toggle-icon');
    const block = el.nextElementSibling;
    if (!block || !block.classList.contains('json-block')) return;

    if (block.classList.contains('collapsed')) {
      block.classList.remove('collapsed');
      icon.classList.remove('collapsed');
      icon.classList.add('expanded');
    } else {
      block.classList.add('collapsed');
      icon.classList.remove('expanded');
      icon.classList.add('collapsed');
    }
  };

  window.toggleSection = function(el) {
    const content = el.nextElementSibling;
    const icon = el.querySelector('.toggle-icon');
    if (content.classList.contains('expanded')) {
      content.classList.remove('expanded');
      icon.innerHTML = '&#9654;'; // right arrow
    } else {
      content.classList.add('expanded');
      icon.innerHTML = '&#9660;'; // down arrow
    }
  };

  function highlightRawOtlSearch(container) {
    // Remove existing highlights
    container.querySelectorAll('.search-highlight').forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });

    if (!state.rawOtlSearchQuery) return;

    // Simple text highlight
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    const nodesToHighlight = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.toLowerCase().includes(state.rawOtlSearchQuery)) {
        nodesToHighlight.push(node);
      }
    }

    for (const textNode of nodesToHighlight) {
      const text = textNode.textContent;
      const escapedQuery = state.rawOtlSearchQuery.replace(/[.*+?^\${}()|[]\\]/g, '\\$&');
      const parts = text.split(new RegExp('(' + escapedQuery + ')', 'gi'));
      const fragment = document.createDocumentFragment();
      for (const part of parts) {
        if (part.toLowerCase() === state.rawOtlSearchQuery) {
          const span = document.createElement('span');
          span.className = 'search-highlight';
          span.style.backgroundColor = '#f0883e';
          span.style.color = '#0d1117';
          span.textContent = part;
          fragment.appendChild(span);
        } else {
          fragment.appendChild(document.createTextNode(part));
        }
      }
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  }

  window.selectRawFile = async function(filename) {
    state.selectedRawOtlFile = filename;
    state.rawOtlFileData = null;
    state.rawOtlSearchQuery = '';
    renderRawOtl(document.getElementById('content'));

    try {
      const r = await fetch('/api/raw-otlp?file=' + encodeURIComponent(filename));
      if (!r.ok) throw new Error('Failed to fetch');
      state.rawOtlFileData = await r.json();
      renderRawOtl(document.getElementById('content'));
    } catch (e) {
      console.error('Failed to load raw OTLP file:', e);
      state.rawOtlFileData = { error: 'Failed to load file: ' + e.message };
      renderRawOtl(document.getElementById('content'));
    }
  };

  async function loadSessions() {
    try {
      const r = await fetch('/api/sessions');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      state.sessions = await r.json();
      state.sessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
      renderSessions();
      if (!state.selectedSessionId && state.sessions.length > 0) {
        await selectSession(state.sessions[0].id);
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  }

  async function loadEvents(sessionId) {
    if (!sessionId) {
      state.currentSessionEvents = [];
      return;
    }
    try {
      const r = await fetch('/api/events?sessionId=' + encodeURIComponent(sessionId));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      state.currentSessionEvents = await r.json();
      render();
    } catch (e) {
      console.error('Failed to load events for session', sessionId, ':', e);
      state.currentSessionEvents = [];
    }
  }

  function selectSession(id) {
    state.selectedSessionId = id;
    state.selectedPromptId = null;
    state.analyticsDeadContext = null;
    loadRawResponses(id);
    loadRawOtlFiles(id);
    loadEvents(id);
    if (state.activeTab === 'analytics') {
      loadAnalyticsData(id).then(() => render());
    }
    renderSessions();
  }

  function fmtDate(iso) {
    try {
      const d = new Date(iso);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return isToday ? 'Today ' + time : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
    } catch { return iso; }
  }

  function fmtModel(model) {
    return (model ?? '').replace(/-\\d{8}$/, '').replace('claude-', '');
  }

  function toNum(v) { const n = Number(v ?? 0); return isNaN(n) ? 0 : n; }

  function toolIcon(name) {
    const icons = { Read: '&#x1F4D6;', Edit: '&#x270F;', Write: '&#x1F4BE;', Bash: '&#x26A1;',
      Glob: '&#x1F50D;', Grep: '&#x1F50E;', Task: '&#x1F916;', WebFetch: '&#x1F310;' };
    return icons[name] ?? '&#x1F527;';
  }

  function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  async function deleteSession(sessionId) {
    if (!confirm('Delete this session and all its related events? This cannot be undone.')) {
      return;
    }
    try {
      const r = await fetch('/api/sessions?id=' + encodeURIComponent(sessionId), { method: 'DELETE' });
      const result = await r.json();
      if (result.deleted) {
        state.sessions = state.sessions.filter(s => s.id !== sessionId);
        if (state.selectedSessionId === sessionId) {
          state.selectedSessionId = null;
          state.currentSessionEvents = [];
          state.selectedPromptId = null;
          state.rawResponses = [];
          state.rawOtlFiles = [];
        }
        renderSessions();
        render();
      } else {
        alert('Failed to delete session: ' + (result.error || 'Session not found'));
      }
    } catch (e) {
      alert('Error deleting session: ' + e.message);
    }
  }

  window.deleteSession = deleteSession;

  function renderSessions() {
    const el = document.getElementById('session-list');
    if (!el) return;
    el.innerHTML = state.sessions.map(s => {
      const active = s.id === state.selectedSessionId ? ' active' : '';
      const cost = s.totalCost ?? 0;
      const superBadge = s.superMode ? '<span class="badge error" style="font-size:8px;padding:1px 4px;margin-left:4px;vertical-align:middle">SUPER</span>' : '';
      return '<div class="session-item' + active + '">' +
        '<div class="session-info" onclick="window.selectSession(&quot;' + s.id + '&quot;)">' +
          '<div class="session-date">' + fmtDate(s.startedAt) + superBadge + '</div>' +
          '<div class="session-meta">' + (s.promptCount || 0) + ' prompts &nbsp; <span class="session-cost">$' + cost.toFixed(4) + '</span><br/>' + fmtModel(s.model||'') + '</div>' +
        '</div>' +
        '<div class="session-delete" onclick="window.deleteSession(&quot;' + s.id + '&quot;); event.stopPropagation();" title="Delete session">&#x2715;</div>' +
      '</div>';
    }).join('');
  }

  window.selectSession = selectSession;

  function buildPrompts(events) {
    const map = new Map();
    for (const e of events) {
      if (e.eventType === 'thought') {
        const p = e.payload || {};
        const promptId = p.promptId || e.metadata?.parentId;
        if (!promptId) continue;
        if (!map.has(promptId)) {
          map.set(promptId, { promptId, timestamp: e.timestamp, content: p.content || '', toolCalls: [], completion: null });
        }
      }
    }
    for (const e of events) {
      if (e.eventType === 'tool_call') {
        const p = e.payload || {};
        const promptId = p.promptId || e.metadata?.parentId;
        const prompt = map.get(promptId);
        if (prompt) prompt.toolCalls.push({
          name: p.name || 'unknown',
          args: p.arguments || {},
          skillName: p.skillName,
          mcpServerName: p.mcpServerName,
          mcpToolName: p.mcpToolName,
          result: p.result,
          durationMs: p.durationMs,
          success: p.success,
        });
      }
      if (e.eventType === 'completion') {
        const p = e.payload || {};
        const promptId = p.promptId || e.metadata?.parentId;
        const prompt = map.get(promptId);
        if (prompt) prompt.completion = p;
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  	function render() {
		if (state.activeTab === 'settings') {
			renderSettings();
			return;
		}
		hideSettings();

		const content = document.getElementById('content');

		// Super Mode Banner
		const currentSession = state.sessions.find(s => s.id === state.selectedSessionId);
		let superBanner = '';
		if (currentSession && currentSession.superMode) {
			superBanner = '<div style="background:#822; color:#fcc; padding:8px 16px; font-size:12px; font-weight:bold; border-radius:6px; margin-bottom:16px; border:1px solid #f44; display:flex; align-items:center; gap:10px">' +
				'<span style="font-size:18px">&#x26A0;&#xFE0F;</span>' +
				'<div>SEEYOURAI SUPER MODE ACTIVE: Raw HTTP traffic intercepted and decrypted for this session.</div>' +
				'</div>';
		}

		if (state.activeTab === 'stats') { renderStats(content); content.innerHTML = superBanner + content.innerHTML; return; }
		if (state.activeTab === 'tokens') { renderTokens(content); content.innerHTML = superBanner + content.innerHTML; return; }
		if (state.activeTab === 'analytics') { renderAnalytics(content); content.innerHTML = superBanner + content.innerHTML; return; }
		if (state.activeTab === 'raw-otlp') { renderRawOtl(content); return; }
		if (state.activeTab === 'raw-responses') { renderRawResponses(content); content.innerHTML = superBanner + content.innerHTML; return; }
		if (state.activeTab === 'visualize') { renderVisualization(content); content.innerHTML = superBanner + content.innerHTML; return; }

    const prompts = buildPrompts(state.currentSessionEvents);
    const filtered = state.searchQuery
      ? prompts.filter(p => p.content.toLowerCase().includes(state.searchQuery.toLowerCase()))
      : prompts;

    const selected = filtered.find(p => p.promptId === state.selectedPromptId) || filtered[0];
    if (selected && !state.selectedPromptId) state.selectedPromptId = selected?.promptId;

    content.innerHTML = superBanner + 
      '<div class="prompt-list">' + (filtered.length === 0
        ? '<div class="empty"><h2>No prompts</h2><p>Run seeyourai run claude to capture sessions.</p></div>'
        : filtered.map(p => renderPromptCard(p, p.promptId === selectedPromptId)).join('')
      ) + '</div>' +
      '<div class="detail-panel">' + (selected ? renderDetail(selected) : '<div class="empty">Select a prompt</div>') + '</div>';
  }

  function renderPromptCard(p, isSelected) {
    const c = p.completion ?? {};
    const cost = toNum(c.costUsd);
    const tokens = toNum(c.inputTokens) + toNum(c.outputTokens);
    const tools = [...new Set(p.toolCalls.map(t => t.name))];
    return '<div class="prompt-card' + (isSelected ? ' selected' : '') + '" onclick="window.selectPrompt(' + JSON.stringify(p.promptId) + ')">' +
      '<div class="prompt-header">' +
        '<span class="prompt-time">' + fmtDate(p.timestamp) + '</span>' +
        '<span class="prompt-text">' + esc(p.content ?? '[no content]') + '</span>' +
        (cost > 0 ? '<span class="prompt-cost">$' + cost.toFixed(5) + '</span>' : '') +
      '</div>' +
      (tools.length > 0 ? '<div style="padding: 4px 14px 8px;">' + tools.map(t => '<span class="tool-badge">' + esc(t) + '</span>').join('') +
        '<span class="prompt-tokens">' + tokens.toLocaleString() + ' tok</span></div>' : '') +
    '</div>';
  }

  function renderDetail(p) {
    const c = p.completion || {};
    const inputT = toNum(c.inputTokens);
    const outputT = toNum(c.outputTokens);
    const cacheRead = toNum(c.cacheReadTokens);
    const cacheCreate = toNum(c.cacheCreationTokens);
    const cost = toNum(c.costUsd);
    const duration = toNum(c.durationMs);
    const model = fmtModel(c.model || '');

    const copyId = 'copy_' + Math.random().toString(36).slice(2);
    window[copyId] = () => {
      navigator.clipboard?.writeText(p.content).then(() => {
        const btn = document.getElementById(copyId);
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 1500); }
      });
    };

    return '' +
      '<div class="detail-card">' +
        '<div class="detail-title">Prompt Request Analysis <button class="copy-btn" id="' + copyId + '" onclick="window[' + JSON.stringify(copyId) + ']()" >Copy</button></div>' +
        '<div class="detail-body"><pre>' + esc(p.content || '[no content]') + '</pre></div>' +
      '</div>' +
      (p.toolCalls.length > 0 ?
      '<div class="detail-card">' +
        '<div class="detail-title">Tool Calls (' + p.toolCalls.length + ')</div>' +
        '<div class="detail-body">' + p.toolCalls.map(t => {
          // Build enhanced tool details with badges
          let badges = '';
          if (t.skillName) badges += '<span class="badge skill">' + esc(t.skillName) + '</span>';
          if (t.mcpServerName) badges += '<span class="badge mcp">' + esc(t.mcpServerName) + '</span>';
          if (t.mcpToolName) badges += '<span class="badge tool">' + esc(t.mcpToolName) + '</span>';
          if (t.name === 'Bash') badges += '<span class="badge bash">bash</span>';
          if (t.success !== undefined) {
            badges += '<span class="badge ' + (t.success ? 'success' : 'error') + '">' + (t.success ? 'Success' : 'Failed') + '</span>';
          }

          // Build sections for different tool data
          let sections = '';

          // File path / command section (Header enhancement)
          let toolContext = '';
          if (t.name === 'Read' && t.args && t.args.path) {
            toolContext = '<span style="font-size:11px;color:#7d8590;margin-left:8px;font-style:italic">' + esc(t.args.path) + '</span>';
          } else if (t.name === 'Edit' && t.args && t.args.path) {
            toolContext = '<span style="font-size:11px;color:#7d8590;margin-left:8px;font-style:italic">' + esc(t.args.path) + '</span>';
          } else if (t.name === 'Bash' && t.args && t.args.command) {
            toolContext = '<span style="font-size:11px;color:#7d8590;margin-left:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;display:inline-block;vertical-align:bottom">' + esc(t.args.command) + '</span>';
          }

          // Tool parameters section (Expandable)
          const params = { ...t.args };
          if (t.name === 'Bash') delete params.command; // Skip command as it's shown
          
          if (Object.keys(params).length > 0) {
            sections += '<details class="params-section" style="padding:8px 0;border-top:1px solid #21262d;margin-top:8px">' +
              '<summary style="font-size:11px;color:#7d8590;text-transform:uppercase;margin-bottom:4px;cursor:pointer;user-select:none">Parameters</summary>' +
              '<pre style="font-size:11px;background:#0d1117;padding:8px;border-radius:4px;margin:0;max-height:150px;overflow-y:auto">' + esc(JSON.stringify(params, null, 2)) + '</pre>' +
            '</details>';
          } else if (t.name === 'Bash' && t.args && t.args.command) {
              sections += '<div class="command-section" style="padding:8px 0;border-top:1px solid #21262d;margin-top:8px">' +
              '<h4 style="font-size:11px;color:#7d8590;text-transform:uppercase;margin-bottom:4px">Command</h4>' +
              '<pre style="font-size:11px;background:#0d1117;padding:8px;border-radius:4px;margin:0">' + esc(String(t.args.command)) + '</pre>' +
            '</div>';
          }

          // Result section (File preview, Bash stdout/stderr, truncate)
          if (t.result !== undefined) {
             const resultStr = String(t.result);
             
             // Bash tool special format
             if (t.name === 'Bash') {
                try {
                  const bashRes = JSON.parse(resultStr);
                  sections += '<div class="result-section" style="padding:8px 0;border-top:1px solid #21262d;margin-top:8px">';
                  sections += '<h4 style="font-size:11px;color:#7d8590;text-transform:uppercase;margin-bottom:4px">Result <span style="font-weight:normal;text-transform:none">(Exit: ' + (bashRes.exit_code !== undefined ? bashRes.exit_code : 'unknown') + ')</span></h4>';
                  
                  if (bashRes.stdout) {
                     sections += '<div style="margin-bottom:6px"><span style="font-size:10px;color:#7d8590">STDOUT</span><pre style="font-size:11px;background:#0d1117;padding:8px;border-radius:4px;margin:0;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto">' + esc(bashRes.stdout) + '</pre></div>';
                  }
                  if (bashRes.stderr) {
                     sections += '<div><span style="font-size:10px;color:#f85149">STDERR</span><pre style="font-size:11px;background:#2d1114;color:#ff7b72;padding:8px;border-radius:4px;margin:0;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto">' + esc(bashRes.stderr) + '</pre></div>';
                  }
                  if (!bashRes.stdout && !bashRes.stderr) {
                     sections += '<pre style="font-size:11px;background:#0d1117;padding:8px;border-radius:4px;margin:0;color:#7d8590"><i>No output</i></pre>';
                  }
                  sections += '</div>';
                } catch {
                   // Fallback if not JSON
                   sections += '<div class="result-section" style="padding:8px 0;border-top:1px solid #21262d;margin-top:8px">' +
                    '<h4 style="font-size:11px;color:#7d8590;text-transform:uppercase;margin-bottom:4px">Result</h4>' +
                    '<pre style="font-size:11px;background:#0d1117;padding:8px;border-radius:4px;margin:0;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto">' + esc(resultStr) + '</pre>' +
                  '</div>';
                }
             } else {
                 // Regular result truncation
                 const isLong = resultStr.length > 500;
                 const displayStr = isLong ? resultStr.substring(0, 500) + '\\n\\n... (truncated, ' + (resultStr.length - 500) + ' more chars)' : resultStr;
                 
                 sections += '<div class="result-section" style="padding:8px 0;border-top:1px solid #21262d;margin-top:8px">' +
                  '<h4 style="font-size:11px;color:#7d8590;text-transform:uppercase;margin-bottom:4px">Result / File Content</h4>' +
                  '<pre style="font-size:11px;background:#0d1117;padding:8px;border-radius:4px;margin:0;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto">' + esc(displayStr) + '</pre>' +
                '</div>';
             }
          }

          // Tool metadata
          let meta = '';
          if (t.durationMs) {
            meta = '<div class="tool-meta">Duration: ' + t.durationMs + 'ms</div>';
          }

          return '<div class="tool-event">' +
            '<div class="tool-badges">' + badges + '</div>' +
            '<div style="font-size:13px;color:#79c0ff;font-weight:600;margin-bottom:4px">' + esc(t.name) + toolContext + '</div>' +
            sections +
            meta +
          '</div>';
        }).join('') + '</div>' +
      '</div>' : '') +
      '</div>' : '') +
      ((inputT + outputT) > 0 || c.response ?
      '<div class="detail-card">' +
        '<div class="detail-title">LLM Completion Details</div>' +
        (model ? '<div class="detail-body" style="padding-bottom:8px;"><div class="stat-row"><span class="stat-label">Model Engine</span><span class="stat-value blue">' + esc(model) + '</span></div></div>' : '') +
        
        // Token Mini-Dashboard
        ((inputT + outputT) > 0 ?
        '<div class="detail-body" style="padding-top:0;">' +
          '<div class="token-dash">' +
            '<div class="token-stat"><span class="token-stat-val input">' + inputT.toLocaleString() + '</span><span class="token-stat-label">Input tokens</span></div>' +
            '<div class="token-stat"><span class="token-stat-val output">' + outputT.toLocaleString() + '</span><span class="token-stat-label">Output tokens</span></div>' +
            '<div class="token-stat"><span class="token-stat-val cache">' + (cacheRead + cacheCreate).toLocaleString() + '</span><span class="token-stat-label">Cache tokens</span></div>' +
            '<div class="token-stat"><span class="token-stat-val cost">$' + cost.toFixed(6) + '</span><span class="token-stat-label">Request Cost</span></div>' +
          '</div>' +
          (duration > 0 ? '<div style="margin-top:10px;text-align:right;font-size:11px;color:#7d8590;">Duration: ' + (duration/1000).toFixed(2) + 's</div>' : '') +
        '</div>' : '') +
        
        // Collapsible Response
        (c.response ?
        '<div class="collapsible-header" onclick="window.toggleSection(this)">' +
          '<span>Raw LLM Response</span><span class="toggle-icon">&#9660;</span>' +
        '</div>' +
        '<div class="collapsible-content expanded"><pre style="max-height: 400px; overflow-y: auto;">' + esc(c.response) + '</pre></div>' 
        : '') +

        // Collapsible Prompt context (if we have full prompt payload)
        (p.content ?
        '<div class="collapsible-header" style="border-top: 1px solid #30363d;" onclick="window.toggleSection(this)">' +
          '<span>Raw Request Payload</span><span class="toggle-icon">&#9654;</span>' +
        '</div>' +
        '<div class="collapsible-content"><pre style="max-height: 400px; overflow-y: auto;">' + esc(p.content) + '</pre></div>'
        : '') +
        
      '</div>' : '');
  }

  window.selectPrompt = function(id) {
    state.selectedPromptId = id;
    render();
  };

  function renderTokens(content) {
    hideSettings();
    const prompts = buildPrompts(state.currentSessionEvents);
    const maxCost = Math.max(...prompts.map(p => toNum(p.completion?.costUsd)), 0.0001);
    content.innerHTML = '' +
      '<div style="flex:1">' +
        '<div class="bar-chart">' +
          prompts.slice(0, 30).map(p => {
            const c = p.completion ?? {};
            const cost = toNum(c.costUsd);
            const tokens = toNum(c.inputTokens) + toNum(c.outputTokens);
            const widthPct = (cost / maxCost) * 100;
            return '<div class="bar-row">' +
              '<span class="bar-label">' + esc((p.content ?? '').slice(0,20) || '?') + '</span>' +
              '<div class="bar-fill" style="width:' + widthPct + '%;min-width:2px;max-width:300px"></div>' +
              '<span class="bar-value">$' + cost.toFixed(5) + '</span>' +
              '<span class="bar-sub">' + tokens.toLocaleString() + 't</span>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  function renderStats(content) {
    hideSettings();
    const completions = state.currentSessionEvents.filter(e => e.eventType === 'completion');
    const total = { cost: 0, input: 0, output: 0, cacheRead: 0, cacheCreate: 0, prompts: completions.length };
    const modelMap = new Map();
    for (const e of completions) {
      const p = e.payload || {};
      total.cost += toNum(p.costUsd);
      total.input += toNum(p.inputTokens);
      total.output += toNum(p.outputTokens);
      total.cacheRead += toNum(p.cacheReadTokens);
      total.cacheCreate += toNum(p.cacheCreationTokens);
      const m = fmtModel(p.model || 'unknown');
      const ex = modelMap.get(m) || { cost: 0, prompts: 0 };
      ex.cost += toNum(p.costUsd);
      ex.prompts++;
      modelMap.set(m, ex);
    }
    const totalTokens = total.input + total.output + total.cacheRead + total.cacheCreate;
    const cacheRate = totalTokens > 0 ? ((total.cacheRead / totalTokens) * 100).toFixed(1) : '0';
    const models = Array.from(modelMap.entries()).sort((a,b) => b[1].cost - a[1].cost);
    const maxModelCost = Math.max(...models.map(([,v]) => v.cost), 0.0001);

    content.innerHTML = '' +
      '<div style="flex:1; max-width: 800px; margin: 0 auto; padding-top: 10px;">' +
        '<div class="stats-grid" style="margin-bottom:20px">' +
          '<div class="stat-card"><div class="stat-card-label">Total Cost</div><div class="stat-card-value green">$' + total.cost.toFixed(4) + '</div></div>' +
          '<div class="stat-card"><div class="stat-card-label">Prompts</div><div class="stat-card-value blue">' + total.prompts + '</div></div>' +
          '<div class="stat-card"><div class="stat-card-label">Total Tokens</div><div class="stat-card-value purple">' + totalTokens.toLocaleString() + '</div></div>' +
          '<div class="stat-card" title="Higher cache hit rate = more efficient prompt caching.">' +
            '<div class="stat-card-label" style="display:flex; align-items:center; gap:4px; cursor:help;">' +
              'Cache Hit Rate ' +
              '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm.5 12H7V7h1.5v5zM8 6a1 1 0 110-2 1 1 0 010 2z"/></svg>' +
            '</div>' +
            '<div class="stat-card-value orange">' + cacheRate + '%</div>' +
          '</div>' +
        '</div>' +

        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;">' +
          '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;">' +
            '<h3 style="font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px">Cache Token Breakdown</h3>' +
            '<div class="stat-row"><span class="stat-label">Cache Read</span><span class="stat-value magenta">' + total.cacheRead.toLocaleString() + '</span></div>' +
            '<div class="stat-row" style="border-bottom: 1px solid #21262d; padding-bottom: 8px; margin-bottom: 8px;"><span class="stat-label">Cache Creation</span><span class="stat-value orange">' + total.cacheCreate.toLocaleString() + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">Input tokens</span><span class="stat-value green">' + total.input.toLocaleString() + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">Output tokens</span><span class="stat-value blue">' + total.output.toLocaleString() + '</span></div>' +
             '<div style="font-size: 11px; color: #7d8590; margin-top: 16px; padding-top: 10px; border-top: 1px solid #30363d;">' +
              '<a href="https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching" target="_blank" style="color: #58a6ff; text-decoration: none;">Learn about Anthropic Prompt Caching ↗</a>' +
            '</div>' +
          '</div>' +
          
          (models.length > 0 ?
          '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;">' +
            '<h3 style="font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px">Model Breakdown</h3>' +
            '<div class="bar-chart">' +
              models.map(([name, stats]) => {
                const widthPct = (stats.cost / maxModelCost) * 100;
                return '<div class="bar-row">' +
                  '<span class="bar-label" style="text-align: left; width: 80px;">' + esc(name) + '</span>' +
                  '<div class="bar-fill" style="width:' + widthPct + '%;background:#bc8cff;min-width:2px;max-width:150px"></div>' +
                  '<span class="bar-value">$' + stats.cost.toFixed(4) + '</span>' +
                  '<span class="bar-sub">' + stats.prompts + 'p</span>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>' : '') +
        '</div>' +
      '</div>';
  }

  function renderVisualization(content) {
    hideSettings();
    if (state.currentSessionEvents.length === 0) {
      content.innerHTML = '<div class="empty"><h2>No events to visualize</h2><p>Run seeyourai run claude to capture agent activity.</p></div>';
      return;
    }

    const eventColors = {
      session_start: '#3fb950',
      session_end: '#f85149',
      thought: '#58a6ff',
      tool_call: '#bc8cff',
      tool_result: '#d2a8ff',
      context_change: '#f0883e',
      completion: '#2ea043'
    };

    // Group events by type and time
    const eventsByType = {};
    for (const [type, color] of Object.entries(eventColors)) {
      eventsByType[type] = state.currentSessionEvents.filter(e => e.eventType === type);
    }

    // Build session flow data
    const sessionEvents = state.currentSessionEvents.filter(e => e.metadata?.sessionId === state.selectedSessionId);
    sessionEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Build flow nodes HTML using string concatenation
    let flowNodes = '';
    for (let i = 0; i < sessionEvents.length; i++) {
      const e = sessionEvents[i];
      const color = eventColors[e.eventType] || '#7d8590';
      const x = 80 + (i * 120);
      const y = 80 + (Object.keys(eventColors).indexOf(e.eventType) * 50);
      const timeStr = new Date(e.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      const arrow = i < sessionEvents.length - 1 ? '<path d="M100 18 L120 18" stroke="#30363d" stroke-width="2" marker-end="url(#arrow)"/>' : '';
      flowNodes += '<g transform="translate(' + x + ',' + y + ')">' +
        '<rect width="100" height="36" rx="6" fill="#161b22" stroke="' + color + '" stroke-width="2"/>' +
        '<text x="50" y="14" text-anchor="middle" fill="#7d8590" font-size="9">' + e.eventType + '</text>' +
        '<text x="50" y="28" text-anchor="middle" fill="#e6edf3" font-size="10">' + timeStr + '</text>' +
        arrow +
        '</g>';
    }

    // Calculate stats
    const stats = {
      thoughts: eventsByType.thought?.length || 0,
      toolCalls: eventsByType.tool_call?.length || 0,
      completions: eventsByType.completion?.length || 0,
      contextChanges: eventsByType.context_change?.length || 0
    };

    // Build legend HTML
    let legendHtml = '';
    for (const [type, color] of Object.entries(eventColors)) {
      legendHtml += '<div style="display:flex;align-items:center;gap:6px;font-size:12px">' +
        '<div style="width:12px;height:12px;border-radius:50%;background:' + color + '"></div>' +
        '<span>' + type.replace('_', ' ') + '</span>' +
        '</div>';
    }

    // Build insights HTML
    let insightsHtml = '';
    if (stats.toolCalls > 0) {
      insightsHtml += '<div>🔧 Average ' + (stats.toolCalls / Math.max(stats.thoughts, 1)).toFixed(1) + ' tools per thought</div>';
    }
    if (stats.completions > 0) {
      insightsHtml += '<div>✨ ' + stats.completions + ' LLM completions generated</div>';
    }
    if (stats.contextChanges > 0) {
      insightsHtml += '<div>📁 Context updated ' + stats.contextChanges + ' times</div>';
    }

    const svgWidth = Math.max(800, sessionEvents.length * 120 + 100);
    const emptyMessage = sessionEvents.length > 0 ? flowNodes : '<text x="400" y="200" text-anchor="middle" fill="#7d8590" font-size="14">No events in current session</text>';

    content.innerHTML = '<div style="flex:1;overflow:auto;padding:16px">' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">' +
        '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px">' +
          '<div style="font-size:11px;color:#7d8590;text-transform:uppercase">Thoughts</div>' +
          '<div style="font-size:24px;font-weight:700;color:#58a6ff">' + stats.thoughts + '</div>' +
        '</div>' +
        '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px">' +
          '<div style="font-size:11px;color:#7d8590;text-transform:uppercase">Tool Calls</div>' +
          '<div style="font-size:24px;font-weight:700;color:#bc8cff">' + stats.toolCalls + '</div>' +
        '</div>' +
        '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px">' +
          '<div style="font-size:11px;color:#7d8590;text-transform:uppercase">Completions</div>' +
          '<div style="font-size:24px;font-weight:700;color:#2ea043">' + stats.completions + '</div>' +
        '</div>' +
        '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px">' +
          '<div style="font-size:11px;color:#7d8590;text-transform:uppercase">Context Changes</div>' +
          '<div style="font-size:24px;font-weight:700;color:#f0883e">' + stats.contextChanges + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;overflow:auto">' +
        '<div style="font-size:13px;color:#7d8590;margin-bottom:16px">Session Event Flow (chronological)</div>' +
        '<svg width="' + svgWidth + '" height="400" style="min-width:100%">' +
          '<defs>' +
            '<marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">' +
              '<path d="M0,0 L0,6 L9,3 z" fill="#30363d"/>' +
            '</marker>' +
          '</defs>' +
          emptyMessage +
        '</svg>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">' +
        '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px">' +
          '<div style="font-size:12px;color:#7d8590;margin-bottom:12px">Event Type Legend</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:12px">' + legendHtml + '</div>' +
        '</div>' +
        '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px">' +
          '<div style="font-size:12px;color:#7d8590;margin-bottom:12px">Activity Insights</div>' +
          '<div style="font-size:13px;line-height:1.6">' + insightsHtml + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

    '</div>';
  }

  function renderAnalytics(content) {
    hideSettings();
    if (state.currentSessionEvents.length === 0) {
      content.innerHTML = '<div class="empty"><h2>No events</h2><p>Run seeyourai run claude to capture data.</p></div>';
      return;
    }

    const range = state.analyticsRange || 7;

    // Filter completions
    const now = new Date();
    const completions = state.currentSessionEvents.filter(e => {
        if (e.eventType !== 'completion') return false;
        if (range === 'all') return true;
        const d = new Date(e.timestamp);
        const daysAgo = (now - d) / (1000 * 60 * 60 * 24);
        return daysAgo <= range;
    });

    // Group by date
    const dailyCosts = new Map();
    let totalCost = 0;
    let totalPrompts = completions.length;

    for (const c of completions) {
      const p = c.payload || {};
      const cost = toNum(p.costUsd);
      const d = new Date(c.timestamp);
      const dateStr = d.toDateString();
      
      const current = dailyCosts.get(dateStr) || 0;
      dailyCosts.set(dateStr, current + cost);
      totalCost += cost;
    }

    // Fill missing days
    if (range !== 'all') {
      for (let i = 0; i < range; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toDateString();
        if (!dailyCosts.has(dateStr)) dailyCosts.set(dateStr, 0);
      }
    }

    const sortedDays = Array.from(dailyCosts.entries()).sort((a,b) => new Date(b[0]) - new Date(a[0]));
    const maxDayCost = Math.max(...Array.from(dailyCosts.values()), 0.0001);
    
    // Average calculation
    const daysWithData = new Set(completions.map(c => new Date(c.timestamp).toDateString())).size;
    const avgCost = daysWithData > 0 ? totalCost / daysWithData : 0;

    const chartTitle = range === 'all' ? 'All Time' : \`Last \${range} Days\`;

    content.innerHTML = '' +
      '<div style="flex:1; max-width: 800px; margin: 0 auto; padding-top: 10px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">' +
          '<h2 style="font-size:16px; color:#e6edf3;">Analytics Overview</h2>' +
          '<div style="display:flex; gap:8px;">' +
            '<button class="tab ' + (range === 7 ? 'active' : '') + '" onclick="window.setAnalyticsRange(7)" style="padding:4px 8px; font-size:12px;">7 Days</button>' +
            '<button class="tab ' + (range === 30 ? 'active' : '') + '" onclick="window.setAnalyticsRange(30)" style="padding:4px 8px; font-size:12px;">30 Days</button>' +
            '<button class="tab ' + (range === 'all' ? 'active' : '') + '" onclick="window.setAnalyticsRange(&#39;all&#39;)" style="padding:4px 8px; font-size:12px;">All Time</button>' +
          '</div>' +
        '</div>' +
        
        '<div class="stats-grid" style="grid-template-columns: 1fr 1fr 1fr; margin-bottom:20px">' +
          '<div class="stat-card"><div class="stat-card-label">Total Cost</div><div class="stat-card-value green">$' + totalCost.toFixed(4) + '</div></div>' +
          '<div class="stat-card"><div class="stat-card-label">Avg Daily Cost</div><div class="stat-card-value blue">$' + avgCost.toFixed(4) + '/day</div></div>' +
          '<div class="stat-card"><div class="stat-card-label">Total Prompts</div><div class="stat-card-value purple">' + totalPrompts + '</div></div>' +
        '</div>' +

        '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin-bottom:20px;">' +
          '<h3 style="font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px">Daily Costs (' + chartTitle + ')</h3>' +
          '<div class="bar-chart">' +
            sortedDays.map(([dateStr, cost]) => {
              const d = new Date(dateStr);
              // Format date nicely: "Mon, Jan 15"
              const displayDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const widthPct = (cost / maxDayCost) * 100;
              return '<div class="bar-row">' +
                '<span class="bar-label" style="text-align:left; width:100px;">' + displayDate + '</span>' +
                '<div class="bar-fill" style="width:' + widthPct + '%; max-width:500px; background:' + (cost > 0 ? '#1f6feb' : '#30363d') + '"></div>' +
                '<span style="color:' + (cost > 0 ? '#3fb950' : '#7d8590') + '; font-size:12px; margin-left:8px; width:60px;">$' + cost.toFixed(4) + '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>' +
        renderDeadContextSection() +
      '</div>';
  }

  function renderDeadContextSection() {
    const data = state.analyticsDeadContext;
    if (!data) {
      return '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;">' +
        '<h3 style="font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Dead Context Analysis</h3>' +
        '<p style="font-size:13px;color:#7d8590;">Loading...</p>' +
      '</div>';
    }

    const { deadContext, candidates } = data;
    const totalWaste = deadContext.reduce((sum, f) => sum + (f.potentialSavings || 0), 0);
    const wasteCost = (totalWaste / 1_000_000) * 3;
    const maxWaste = Math.max(...deadContext.map(f => f.potentialSavings || 0), 1);

    let html = '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<h3 style="font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:.5px;">Dead Context Analysis</h3>' +
        '<span style="font-size:11px;color:#7d8590;">run <code style="background:#0d1117;padding:1px 5px;border-radius:3px;">sya optimize</code> to auto-fix</span>' +
      '</div>';

    if (deadContext.length === 0 && candidates.length === 0) {
      html += '<p style="color:#3fb950;font-size:13px;">✅ No context waste detected for this session.</p>';
    } else {
      // Waste score summary
      html += '<div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:16px;">' +
        '<div class="stat-card"><div class="stat-card-label">Dead Files</div><div class="stat-card-value orange">' + deadContext.length + '</div></div>' +
        '<div class="stat-card"><div class="stat-card-label">Wasted Tokens</div><div class="stat-card-value purple">' + (totalWaste > 1000 ? (totalWaste/1000).toFixed(1) + 'k' : totalWaste) + '</div></div>' +
        '<div class="stat-card"><div class="stat-card-label">Est. Waste Cost</div><div class="stat-card-value" style="color:#f85149;">$' + wasteCost.toFixed(4) + '</div></div>' +
      '</div>';

      if (deadContext.length > 0) {
        html += '<h4 style="font-size:12px;color:#f85149;margin-bottom:10px;">💀 Dead Context — Files in context but never accessed</h4>' +
          '<div class="bar-chart" style="margin-bottom:16px;">';
        for (const file of deadContext.slice(0, 8)) {
          const widthPct = ((file.potentialSavings || 0) / maxWaste) * 100;
          const name = file.path.split('/').pop() || file.path;
          const fullPath = esc(file.path);
          html += '<div class="bar-row" title="' + fullPath + '">' +
            '<span class="bar-label" style="text-align:left;width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + fullPath + '">' + esc(name) + '</span>' +
            '<div class="bar-fill" style="width:' + widthPct + '%;max-width:400px;background:#7d2e2e;"></div>' +
            '<span style="color:#f85149;font-size:11px;margin-left:8px;">' + (file.potentialSavings > 1000 ? (file.potentialSavings/1000).toFixed(1)+'k' : file.potentialSavings) + ' tok</span>' +
          '</div>';
        }
        if (deadContext.length > 8) {
          html += '<div style="font-size:11px;color:#7d8590;padding-top:6px;">...and ' + (deadContext.length - 8) + ' more</div>';
        }
        html += '</div>';
      }

      if (candidates.length > 0) {
        html += '<h4 style="font-size:12px;color:#f0883e;margin-bottom:10px;">⚠️ Low-Relevance Context — Rarely accessed relative to size</h4>' +
          '<div style="display:flex;flex-direction:column;gap:4px;">';
        for (const file of candidates.slice(0, 5)) {
          const name = file.path.split('/').pop() || file.path;
          html += '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #21262d;">' +
            '<span style="color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px;" title="' + esc(file.path) + '">' + esc(name) + '</span>' +
            '<span style="color:#7d8590;">' + file.tokens + ' tok</span>' +
          '</div>';
        }
        html += '</div>';
      }
    }

    html += '</div>';
    return html;
  }

  window.setAnalyticsRange = function(days) {
    state.analyticsRange = days;
    renderAnalytics(document.getElementById('content'));
  };

  	// Settings: saved configuration state (stored in localStorage)
	const defaultSettings = { confirmBeforeClearAll: true, defaultPort: 32123, autoRefresh: true, dailyBudget: 1.0 };
	const settingsConfig = defaultSettings;
	try {
		const saved = localStorage.getItem('seeyouraiSettings');
		if (saved) {
			const parsed = JSON.parse(saved);
			Object.assign(settingsConfig, parsed);
		}
	} catch (e) {
		console.error('Failed to load settings from localStorage:', e);
	}

	function saveSettings() {
		try {
			localStorage.setItem('seeyouraiSettings', JSON.stringify(settingsConfig));
		} catch (e) {
			console.error('Failed to save settings to localStorage:', e);
		}
	}

	async function clearAllSessions() {
		if (settingsConfig.confirmBeforeClearAll && !confirm('Clear all sessions?')) {
			return;
		}
		try {
			const r = await fetch('/api/clear-all', { method: 'POST' });
			const result = await r.json();
			if (result.deleted) {
				state.sessions = [];
				state.selectedSessionId = null;
				state.currentSessionEvents = [];
				state.selectedPromptId = null;
				state.rawResponses = [];
				state.rawOtlFiles = [];
				renderSessions();
				render();
        hideSettings(); // Re-render settings to show updated storage text if active
        if (state.activeTab === 'settings') renderSettings();
			}
		} catch (e) {
			console.error('Failed to clear all sessions:', e);
		}
	}

	window.clearAllSessions = clearAllSessions;

  async function clearSessionsBeforeDate(daysAgo) {
     if (!confirm('Delete all sessions older than ' + daysAgo + ' days? This cannot be undone.')) return;
      
     const cutoff = new Date();
     cutoff.setDate(cutoff.getDate() - daysAgo);

     const toDelete = state.sessions.filter(s => new Date(s.startedAt) < cutoff);
     if (toDelete.length === 0) {
       alert('No sessions found older than ' + daysAgo + ' days.');
       return;
     }

     try {
       for (const s of toDelete) {
         await fetch('/api/sessions?id=' + encodeURIComponent(s.id), { method: 'DELETE' });
       }
       state.sessions = state.sessions.filter(s => new Date(s.startedAt) >= cutoff);
       if (state.selectedSessionId && toDelete.find(s => s.id === state.selectedSessionId)) {
          state.selectedSessionId = null;
          state.currentSessionEvents = [];
       }
       renderSessions();
       if (state.activeTab === 'settings') renderSettings();
       alert('Successfully deleted ' + toDelete.length + ' old sessions.');
     } catch(e) {
       alert('Error deleting some sessions: ' + e.message);
     }
  }
  window.clearSessionsBeforeDate = clearSessionsBeforeDate;

  function exportData(type) {
    let dataStr, name;
    if (type === 'sessions') {
      dataStr = JSON.stringify(state.sessions, null, 2);
      name = 'seeyourai_sessions_export.json';
    } else if (type === 'events') {
       // Convert current session events to basic CSV
       const evts = state.currentSessionEvents;
       if(evts.length === 0) { alert('No events in current session to export'); return; }
       
       const header = 'Timestamp,Event Type,Model,Cost USD,Tokens,Prompt\\n';
       const rows = evts.map(e => {
         const p = e.payload || {};
         const cost = toNum(p.costUsd);
         const tokens = toNum(p.inputTokens) + toNum(p.outputTokens) + toNum(p.cacheReadTokens) + toNum(p.cacheCreationTokens);
         const txt = esc(p.content || '').replace(/,/g, ' '); // avoid csv break
         return e.timestamp + ',' + e.eventType + ',' + (p.model || '') + ',' + cost + ',' + tokens + ',"' + txt + '"';
       }).join('\\n');
       dataStr = header + rows;
       name = 'seeyourai_events_' + (state.selectedSessionId || 'export') + '.csv';
    } else {
      return;
    }

    const dataBlob = new Blob([dataStr], { type: type === 'sessions' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  window.exportData = exportData;

	function renderSettings() {
		const globalPanel = document.getElementById('global-panel');
		const content = document.getElementById('content');

		// Hide session-specific content, show global panel
		content.style.display = 'none';
		globalPanel.style.display = 'block';

    const now = new Date();
    const todayStr = now.toDateString();
    
    // Calculate today's spend
    let todaySpend = 0;
    for (const s of state.sessions) {
      const isToday = new Date(s.startedAt).toDateString() === todayStr;
      if (isToday) todaySpend += toNum(s.totalCost);
    }
    
    const budgetPct = Math.min(100, (todaySpend / settingsConfig.dailyBudget) * 100);
    const budgetColor = budgetPct > 90 ? '#f85149' : (budgetPct > 75 ? '#d29922' : '#3fb950');

    // Estimate storage usage (very rough approx for display)
    const storageEstMb = (state.sessions.length * 0.5).toFixed(1);

		globalPanel.innerHTML = '<div style="max-width:800px;margin:0 auto;padding:20px">' +
			'<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:30px;">' +
      
        '<div>' +
          '<div style="font-size:16px;font-weight:600;color:#e6edf3;margin-bottom:16px">Settings & Preferences</div>' +
          
          '<div style="margin-bottom:20px">' +
            '<div style="font-size:13px;font-weight:600;color:#e6edf3;margin-bottom:12px">Preferences</div>' +
            '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' +
              '<input type="checkbox" id="confirmClear" ' + (settingsConfig.confirmBeforeClearAll ? 'checked' : '') + ' style="width:16px;height:16px">' +
              '<span style="font-size:13px;color:#e6edf3">Confirm before clearing sessions</span>' +
            '</label>' +
          '</div>' +
          
          '<div style="margin-bottom:20px">' +
             '<div style="font-size:13px;font-weight:600;color:#e6edf3;margin-bottom:8px">Daily Budget Limit</div>' +
             '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
               '<span style="color:#7d8590">$</span>' + 
               '<input type="number" id="budgetInput" value="' + settingsConfig.dailyBudget + '" step="0.5" min="0.1" style="background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:6px 10px;color:#e6edf3;width:80px;outline:none">' +
               '<span style="font-size:12px;color:#7d8590">USD per day</span>' +
             '</div>' +
             
             '<div style="font-size:12px;color:#7d8590;margin-bottom:4px">Today\\'s Spend: $' + todaySpend.toFixed(4) + ' / $' + settingsConfig.dailyBudget.toFixed(2) + '</div>' + 
             '<div style="width:100%;background:#30363d;height:8px;border-radius:4px;overflow:hidden">' +
                '<div style="width:' + budgetPct + '%;background:' + budgetColor + ';height:100%"></div>' +
             '</div>' +
          '</div>' +

        '</div>' +

        '<div>' +
          '<div style="font-size:16px;font-weight:600;color:#e6edf3;margin-bottom:16px">Data Management</div>' +
          
          '<div style="margin-bottom:20px">' +
            '<div style="font-size:13px;font-weight:600;color:#e6edf3;margin-bottom:8px">Export Data</div>' +
            '<p style="font-size:12px;color:#7d8590;margin-bottom:8px">Download your local telemetry data for external analysis.</p>' +
            '<div style="display:flex;gap:10px">' +
              '<button onclick="window.exportData(&#39;sessions&#39;)" style="background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:8px 12px;font-size:12px;cursor:pointer;flex:1">Export Sessions (JSON)</button>' +
              '<button title="Exports events for currently selected session" onclick="window.exportData(&#39;events&#39;)" style="background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:8px 12px;font-size:12px;cursor:pointer;flex:1">Export Current Events (CSV)</button>' +
            '</div>' +
          '</div>' +
          
          '<div style="margin-bottom:20px">' +
             '<div style="font-size:13px;font-weight:600;color:#e6edf3;margin-bottom:8px">Storage Usage</div>' +
             '<p style="font-size:12px;color:#7d8590;margin-bottom:8px">Estimated ~' + storageEstMb + 'MB used by database files</p>' +
             '<div style="display:flex;gap:10px;margin-bottom:12px">' +
               '<button onclick="window.clearSessionsBeforeDate(7)" style="background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:8px 12px;font-size:12px;cursor:pointer">Clear &gt; 7 Days</button>' +
               '<button onclick="window.clearSessionsBeforeDate(30)" style="background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:8px 12px;font-size:12px;cursor:pointer">Clear &gt; 30 Days</button>' +
             '</div>' +
          '</div>' +
          
          '<div style="border-top:1px solid #30363d;padding-top:20px;margin-top:20px">' +
            '<div style="font-size:13px;font-weight:600;color:#f85149;margin-bottom:8px">Danger Zone</div>' +
            '<button id="clearAllBtn" style="background:#f85149;color:#fff;border:none;border-radius:6px;padding:10px 16px;font-size:13px;cursor:pointer;font-weight:500">' +
              'Clear All Sessions' +
            '</button>' +
          '</div>' +
        '</div>' +

			'</div>' +

			'<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin-bottom:16px">' +
				'<div style="font-size:13px;font-weight:600;color:#e6edf3;margin-bottom:12px">Data Locations</div>' +
				'<ul style="font-size:12px;color:#7d8590;list-style:none;padding:0;margin:0;line-height:1.8">' +
					'<li>Events: ~/.seeyourai/events.jsonl</li>' +
					'<li>Sessions: ~/.seeyourai/sessions.json</li>' +
					'<li>Raw OTLP: ~/.seeyourai/raw-otl/</li>' +
					'<li>Responses: ~/.seeyourai/responses/</li>' +
				'</ul>' +
			'</div>' +

			'<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px">' +
				'<div style="font-size:13px;font-weight:600;color:#e6edf3;margin-bottom:8px">About</div>' +
				'<p style="font-size:12px;color:#7d8590;margin:0">seeyourai v0.1.0</p>' +
			'</div>' +
		'</div>';

		// Bind checkbox event
		const checkbox = document.getElementById('confirmClear');
		if (checkbox) {
			checkbox.addEventListener('change', (e) => {
				settingsConfig.confirmBeforeClearAll = e.target.checked;
				saveSettings();
			});
		}
    
    // Bind budget input
    const budgetInp = document.getElementById('budgetInput');
    if (budgetInp) {
      budgetInp.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val > 0) {
          settingsConfig.dailyBudget = val;
          saveSettings();
          renderSettings(); // re-render to update bar
        }
      });
    }

		// Bind clear all button
		const clearBtn = document.getElementById('clearAllBtn');
		if (clearBtn) {
			clearBtn.addEventListener('click', clearAllSessions);
		}
	}

	function hideSettings() {
		const globalPanel = document.getElementById('global-panel');
		const content = document.getElementById('content');
		globalPanel.style.display = 'none';
		content.style.display = 'flex';
	}

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeTab = tab.dataset.tab;
      if (state.activeTab === 'raw-otlp' && state.rawOtlFiles.length === 0) {
        loadRawOtlFiles(state.selectedSessionId).then(() => render());
      } else if (state.activeTab === 'raw-responses' && state.rawResponses.length === 0) {
        loadRawResponses(state.selectedSessionId).then(() => render());
      } else if (state.activeTab === 'analytics') {
        loadAnalyticsData(state.selectedSessionId).then(() => render());
      } else {
        render();
      }
    });
  });

  // Auto-refresh raw data tabs every 3 seconds to show new captures
  setInterval(() => {
    if (state.activeTab === 'raw-otlp') {
      loadRawOtlFiles(state.selectedSessionId).then(() => render());
    } else if (state.activeTab === 'raw-responses') {
      loadRawResponses(state.selectedSessionId).then(() => render());
    }
  }, 3000);

  document.getElementById('search').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    render();
  });

  const evtSource = new EventSource('/events');
  evtSource.addEventListener('event', (e) => {
    try {
      const newEvent = JSON.parse(e.data);
      if (state.selectedSessionId && newEvent.metadata?.sessionId === state.selectedSessionId) {
        state.currentSessionEvents.push(newEvent);
        render();
      }
      loadSessions();
    } catch (err) {
      console.error('Failed to process SSE event:', err);
    }
  });

  loadSessions();
})();
`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>seeyourai Dashboard</title>
<style>
${baseStyles}
</style>
</head>
<body>
<div class="header">
  <h1>&#x1F441;&#xFE0F; seeyourai Dashboard</h1>
  <span class="subtitle">See Your AI</span>
  <span class="live-dot" title="Live updates via SSE"></span>
</div>
<div class="layout">
  <div class="sidebar">
    <div class="sidebar-header">Sessions</div>
    <div id="session-list"></div>
  </div>
  <div class="main">
    	<div class="toolbar">
			<input class="search-box" id="search" placeholder="Search prompts..." />
			<div class="tab active" data-tab="prompts">Prompts</div>
			<div class="tab" data-tab="tokens">Tokens</div>
			<div class="tab" data-tab="stats">Stats</div>
			<div class="tab" data-tab="analytics">Analytics</div>
			<div class="tab" data-tab="raw-otl">Raw OTLP</div>
			<div class="tab" data-tab="raw-responses">Raw Responses</div>
			<div class="tab" data-tab="visualize">Visualize</div>
			<div class="tab" data-tab="settings">&#x2699; Settings</div>
		</div>
		<div class="content" id="content"></div>
		<div class="global-panel" id="global-panel" style="display:none"></div>
  </div>
</div>

<script>
${clientScript}
</script>
</body>
</html>`;
}
