/**
 * Airminal Agent Bridge — Popup Controller
 * 
 * All settings persisted in chrome.storage.local under 'airminalConfig'.
 * Endpoint is saved immediately on input change — survives enable/disable.
 */

const PLATFORMS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: '💬',
    iconClass: 'whatsapp',
    description: 'web.whatsapp.com',
  },
  {
    id: 'messenger',
    name: 'Messenger',
    icon: '💙',
    iconClass: 'messenger',
    description: 'messenger.com',
  },
  {
    id: 'instagram',
    name: 'Instagram DM',
    icon: '📸',
    iconClass: 'instagram',
    description: 'instagram.com/direct',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '✈️',
    iconClass: 'telegram',
    description: 'web.telegram.org',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    iconClass: 'linkedin',
    description: 'linkedin.com/messaging',
  },
  {
    id: 'x_twitter',
    name: 'X / Twitter',
    icon: '𝕏',
    iconClass: 'x_twitter',
    description: 'x.com/messages',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '#',
    iconClass: 'slack',
    description: 'app.slack.com',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    iconClass: 'discord',
    description: 'discord.com/channels',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    icon: '🟦',
    iconClass: 'teams',
    description: 'teams.microsoft.com',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '✉️',
    iconClass: 'gmail',
    description: 'mail.google.com',
  },
  {
    id: 'of',
    name: 'OF',
    icon: '🔒',
    iconClass: 'of',
    description: 'onlyfans.com/chats',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    icon: '📧',
    iconClass: 'outlook',
    description: 'outlook.office.com',
  },
];

const DEFAULTS = {
  agentEndpoint: '',
  enabled: false,
  replyDelay: 1500,
  maxHistoryLength: 20,
  systemPrompt: '',
  platforms: {
    whatsapp:  { enabled: false, triggerPrefix: '', allowedChats: '', blockedChats: '', autoReply: true },
    messenger: { enabled: false, triggerPrefix: '', allowedChats: '', blockedChats: '', autoReply: true },
    instagram: { enabled: false, triggerPrefix: '', allowedChats: '', blockedChats: '', autoReply: true },
    telegram:  { enabled: false, triggerPrefix: '', allowedChats: '', blockedChats: '', autoReply: true },
    linkedin:  { enabled: false, triggerPrefix: '', allowedChats: '', blockedChats: '', autoReply: true },
    x_twitter: { enabled: false, triggerPrefix: '', allowedChats: '', blockedChats: '', autoReply: true },
    slack:     { enabled: false, triggerPrefix: '', allowedChats: '', blockedChats: '', autoReply: true },
    discord:   { enabled: false, triggerPrefix: '', allowedChats: '', blockedChats: '', autoReply: true },
    teams:     { enabled: false, triggerPrefix: '', allowedChats: '', blockedChats: '', autoReply: true },
    gmail:     { enabled: false, triggerPrefix: '', allowedChats: '', blockedChats: '', autoReply: false },
    of:        { enabled: false, triggerPrefix: '', allowedChats: '', blockedChats: '', autoReply: true },
    outlook:   { enabled: false, triggerPrefix: '', allowedChats: '', blockedChats: '', autoReply: false },
  },
  automations: {
    instagram_post: { enabled: false, intervalHours: 24, prompt: '', lastRun: 0, nextRun: 0 },
    x_post:         { enabled: false, intervalHours: 24, prompt: '', lastRun: 0, nextRun: 0 },
    linkedin_post:  { enabled: false, intervalHours: 24, prompt: '', lastRun: 0, nextRun: 0 },
  },
};

let config = {};
let openAccordion = null;
let openAutoAccordion = null;

const AUTOMATIONS = [
  {
    id: 'instagram_post',
    name: 'Instagram Auto-Post',
    icon: '📸',
    iconClass: 'automation',
    description: 'Automatically create and publish Instagram posts',
    intervals: [
      { value: 1, label: 'Every 1 hour' },
      { value: 6, label: 'Every 6 hours' },
      { value: 12, label: 'Every 12 hours' },
      { value: 24, label: 'Every 24 hours' },
      { value: 48, label: 'Every 2 days' },
      { value: 72, label: 'Every 3 days' },
      { value: 168, label: 'Every 7 days' },
    ],
  },
  {
    id: 'x_post',
    name: 'X / Twitter Auto-Post',
    icon: '𝕏',
    iconClass: 'automation',
    description: 'Automatically create and publish posts on X',
    intervals: [
      { value: 1, label: 'Every 1 hour' },
      { value: 6, label: 'Every 6 hours' },
      { value: 12, label: 'Every 12 hours' },
      { value: 24, label: 'Every 24 hours' },
      { value: 48, label: 'Every 2 days' },
      { value: 72, label: 'Every 3 days' },
      { value: 168, label: 'Every 7 days' },
    ],
  },
  {
    id: 'linkedin_post',
    name: 'LinkedIn Auto-Post',
    icon: '💼',
    iconClass: 'automation',
    description: 'Automatically create and publish LinkedIn posts',
    intervals: [
      { value: 1, label: 'Every 1 hour' },
      { value: 6, label: 'Every 6 hours' },
      { value: 12, label: 'Every 12 hours' },
      { value: 24, label: 'Every 24 hours' },
      { value: 48, label: 'Every 2 days' },
      { value: 72, label: 'Every 3 days' },
      { value: 168, label: 'Every 7 days' },
    ],
  },
];

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  config = await loadConfig();
  renderUI();
  bindEvents();
  updateStatus();
});

async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get('airminalConfig', (result) => {
      resolve(deepMerge(DEFAULTS, result.airminalConfig || {}));
    });
  });
}

function saveConfig() {
  chrome.storage.local.set({ airminalConfig: config });
  chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', config });
}

// ── Render ──
function renderUI() {
  // Master toggle
  document.getElementById('enabledToggle').checked = config.enabled;
  updateMasterToggle();

  // Endpoint (always shows saved value!)
  document.getElementById('endpoint').value = config.agentEndpoint || '';

  // Platforms
  renderPlatforms();

  // Automations
  renderAutomations();
}

function renderPlatforms() {
  const container = document.getElementById('platformsContainer');
  container.innerHTML = '';

  for (const plat of PLATFORMS) {
    const pc = config.platforms[plat.id] || DEFAULTS.platforms[plat.id];
    const isEnabled = pc.enabled;
    const isOpen = openAccordion === plat.id;

    const card = document.createElement('div');
    card.className = `platform-card${isOpen ? ' open' : ''}${isEnabled ? ' platform-enabled' : ''}`;
    card.dataset.platform = plat.id;

    card.innerHTML = `
      <div class="platform-header" data-toggle="${plat.id}">
        <div class="platform-icon ${plat.iconClass}">${plat.icon}</div>
        <div class="platform-name">${plat.name}</div>
        <div class="platform-status">${isEnabled ? 'Active' : 'Off'}</div>
        <svg class="platform-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      <div class="platform-body">
        <div class="platform-content">
          <div class="field-row">
            <span class="field-row-label">Enabled</span>
            <label class="toggle">
              <input type="checkbox" data-field="enabled" data-plat="${plat.id}" ${isEnabled ? 'checked' : ''}>
              <div class="toggle-slider"></div>
            </label>
          </div>
          <div class="field-row">
            <span class="field-row-label">Auto-reply</span>
            <label class="toggle">
              <input type="checkbox" data-field="autoReply" data-plat="${plat.id}" ${pc.autoReply ? 'checked' : ''}>
              <div class="toggle-slider"></div>
            </label>
          </div>
          <div class="field">
            <div class="field-label">Trigger Prefix</div>
            <input type="text" data-field="triggerPrefix" data-plat="${plat.id}" value="${esc(pc.triggerPrefix)}" placeholder="Leave empty to reply to all">
            <div class="field-hint">Only respond when message starts with this</div>
          </div>
          <div class="field">
            <div class="field-label">Allowed Chats</div>
            <input type="text" data-field="allowedChats" data-plat="${plat.id}" value="${esc(pc.allowedChats)}" placeholder="Empty = all chats">
            <div class="field-hint">Comma-separated chat names (empty = all)</div>
          </div>
          <div class="field">
            <div class="field-label">Blocked Chats</div>
            <input type="text" data-field="blockedChats" data-plat="${plat.id}" value="${esc(pc.blockedChats)}" placeholder="Chat names to ignore">
            <div class="field-hint">Comma-separated chat names to skip</div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  }
}

// ── Automations Rendering ──
function renderAutomations() {
  const container = document.getElementById('automationsContainer');
  if (!container) return;
  container.innerHTML = '';

  for (const auto of AUTOMATIONS) {
    const ac = config.automations?.[auto.id] || DEFAULTS.automations[auto.id];
    const isEnabled = ac.enabled;
    const isOpen = openAutoAccordion === auto.id;
    const lastRun = ac.lastRun ? new Date(ac.lastRun).toLocaleString() : 'Never';
    const nextRun = ac.nextRun && ac.nextRun > Date.now() ? new Date(ac.nextRun).toLocaleString() : isEnabled ? 'Pending...' : '—';

    const card = document.createElement('div');
    card.className = `platform-card${isOpen ? ' open' : ''}${isEnabled ? ' platform-enabled' : ''}`;
    card.dataset.automation = auto.id;

    card.innerHTML = `
      <div class="platform-header" data-auto-toggle="${auto.id}">
        <div class="platform-icon ${auto.iconClass}">${auto.icon}</div>
        <div class="platform-name">${auto.name}</div>
        <div class="platform-status">${isEnabled ? 'Active' : 'Off'}</div>
        <svg class="platform-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      <div class="platform-body">
        <div class="platform-content">
          <div class="field-row">
            <span class="field-row-label">Enabled</span>
            <label class="toggle">
              <input type="checkbox" data-auto-field="enabled" data-auto-id="${auto.id}" ${isEnabled ? 'checked' : ''}>
              <div class="toggle-slider"></div>
            </label>
          </div>
          <div class="field">
            <div class="field-label">Interval</div>
            <select data-auto-field="intervalHours" data-auto-id="${auto.id}">
              ${auto.intervals.map(i => `<option value="${i.value}" ${ac.intervalHours === i.value ? 'selected' : ''}>${i.label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <div class="field-label">Prompt for Agent</div>
            <textarea rows="3" data-auto-field="prompt" data-auto-id="${auto.id}" placeholder="e.g. Give me an image URL and caption I can post on Instagram about tech trends">${esc(ac.prompt)}</textarea>
            <div class="field-hint">This instruction is sent to your agent on each scheduled run</div>
          </div>
          <div class="auto-trigger-row">
            <button class="btn btn-accent" data-auto-trigger="${auto.id}">Run Now</button>
          </div>
          <div class="auto-status ${ac.lastRun ? '' : 'idle'}" id="autoStatus_${auto.id}">
            Last: ${lastRun} · Next: ${nextRun}
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  }

  rebindAutomationFields();
}

function rebindAutomationFields() {
  const container = document.getElementById('automationsContainer');
  if (!container) return;

  // Accordion toggle
  container.querySelectorAll('.platform-header[data-auto-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      openAutoAccordion = openAutoAccordion === el.dataset.autoToggle ? null : el.dataset.autoToggle;
      renderAutomations();
    });
  });

  // Enabled toggle
  container.querySelectorAll('input[type="checkbox"][data-auto-id]').forEach(el => {
    el.addEventListener('change', () => {
      const autoId = el.dataset.autoId;
      if (!config.automations) config.automations = {};
      if (!config.automations[autoId]) config.automations[autoId] = { ...DEFAULTS.automations[autoId] };
      config.automations[autoId][el.dataset.autoField] = el.checked;
      if (el.checked) {
        config.automations[autoId].nextRun = Date.now() + (config.automations[autoId].intervalHours * 60 * 60 * 1000);
      }
      saveConfig();
      renderAutomations();
    });
  });

  // Select (interval)
  container.querySelectorAll('select[data-auto-id]').forEach(el => {
    el.addEventListener('change', () => {
      const autoId = el.dataset.autoId;
      if (!config.automations) config.automations = {};
      if (!config.automations[autoId]) config.automations[autoId] = { ...DEFAULTS.automations[autoId] };
      config.automations[autoId].intervalHours = parseInt(el.value);
      if (config.automations[autoId].enabled) {
        config.automations[autoId].nextRun = Date.now() + (parseInt(el.value) * 60 * 60 * 1000);
      }
      saveConfig();
    });
  });

  // Textarea (prompt) — auto-save
  container.querySelectorAll('textarea[data-auto-id]').forEach(el => {
    let timer = null;
    const save = () => {
      const autoId = el.dataset.autoId;
      if (!config.automations) config.automations = {};
      if (!config.automations[autoId]) config.automations[autoId] = { ...DEFAULTS.automations[autoId] };
      config.automations[autoId].prompt = el.value;
      saveConfig();
    };
    el.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(save, 400); });
    el.addEventListener('blur', () => { clearTimeout(timer); save(); });
  });

  // Run Now button
  container.querySelectorAll('[data-auto-trigger]').forEach(el => {
    el.addEventListener('click', async () => {
      const autoId = el.dataset.autoTrigger;
      el.textContent = 'Running…';
      el.disabled = true;
      const statusEl = document.getElementById('autoStatus_' + autoId);

      try {
        const res = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'TRIGGER_AUTOMATION', automationId: autoId }, (r) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(r);
          });
        });
        if (res.success) {
          statusEl.className = 'auto-status';
          statusEl.textContent = '✓ Posted at ' + new Date().toLocaleTimeString();
        } else {
          statusEl.className = 'auto-status';
          statusEl.style.color = '#f87171';
          statusEl.textContent = '✗ ' + (res.error || 'Failed');
        }
      } catch (err) {
        statusEl.className = 'auto-status';
        statusEl.style.color = '#f87171';
        statusEl.textContent = '✗ ' + err.message;
      }
      el.textContent = 'Run Now';
      el.disabled = false;
    });
  });
}

// ── Events ──
function bindEvents() {
  // Master toggle
  const masterToggle = document.getElementById('masterToggle');
  const enabledToggle = document.getElementById('enabledToggle');

  masterToggle.addEventListener('click', (e) => {
    if (e.target.closest('.toggle')) return;
    enabledToggle.checked = !enabledToggle.checked;
    enabledToggle.dispatchEvent(new Event('change'));
  });

  enabledToggle.addEventListener('change', () => {
    config.enabled = enabledToggle.checked;
    saveConfig();
    updateMasterToggle();
  });

  // Endpoint — auto-save on every change with debounce
  const endpoint = document.getElementById('endpoint');
  let endpointTimer = null;
  endpoint.addEventListener('input', () => {
    clearTimeout(endpointTimer);
    endpointTimer = setTimeout(() => {
      config.agentEndpoint = endpoint.value.trim();
      saveConfig();
      flashSaved('endpointSaved');
    }, 400);
  });
  // Also save on blur immediately
  endpoint.addEventListener('blur', () => {
    clearTimeout(endpointTimer);
    config.agentEndpoint = endpoint.value.trim();
    saveConfig();
  });

  // Test connection
  document.getElementById('testBtn').addEventListener('click', testConnection);

  // Accordion toggles (delegated)
  document.getElementById('platformsContainer').addEventListener('click', (e) => {
    const header = e.target.closest('.platform-header[data-toggle]');
    if (header) {
      const platId = header.dataset.toggle;
      openAccordion = openAccordion === platId ? null : platId;
      renderPlatforms();
      rebindPlatformFields();
      return;
    }
  });

  // Platform field changes (delegated)
  rebindPlatformFields();

  // Clear sessions
  document.getElementById('clearSessions').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_SESSIONS' });
    document.getElementById('sessionCount').textContent = '0';
  });
}

function rebindPlatformFields() {
  const container = document.getElementById('platformsContainer');

  // Toggles (enabled, autoReply)
  container.querySelectorAll('input[type="checkbox"][data-plat]').forEach(el => {
    el.addEventListener('change', () => {
      const plat = el.dataset.plat;
      const field = el.dataset.field;
      if (!config.platforms[plat]) config.platforms[plat] = { ...DEFAULTS.platforms[plat] };
      config.platforms[plat][field] = el.checked;
      saveConfig();

      // Update card appearance
      const card = el.closest('.platform-card');
      if (field === 'enabled') {
        card.classList.toggle('platform-enabled', el.checked);
        card.querySelector('.platform-status').textContent = el.checked ? 'Active' : 'Off';
      }
    });
  });

  // Text inputs (triggerPrefix, allowedChats, blockedChats)
  container.querySelectorAll('input[type="text"][data-plat]').forEach(el => {
    let timer = null;
    el.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const plat = el.dataset.plat;
        const field = el.dataset.field;
        if (!config.platforms[plat]) config.platforms[plat] = { ...DEFAULTS.platforms[plat] };
        config.platforms[plat][field] = el.value;
        saveConfig();
      }, 400);
    });
    el.addEventListener('blur', () => {
      clearTimeout(timer);
      const plat = el.dataset.plat;
      const field = el.dataset.field;
      if (!config.platforms[plat]) config.platforms[plat] = { ...DEFAULTS.platforms[plat] };
      config.platforms[plat][field] = el.value;
      saveConfig();
    });
  });
}

// ── Master toggle visuals ──
function updateMasterToggle() {
  const el = document.getElementById('masterToggle');
  const status = document.getElementById('masterStatus');
  if (config.enabled) {
    el.classList.add('active');
    status.textContent = 'ON';
  } else {
    el.classList.remove('active');
    status.textContent = 'OFF';
  }
}

// ── Test ──
async function testConnection() {
  const btn = document.getElementById('testBtn');
  const result = document.getElementById('testResult');
  btn.textContent = 'Testing…';
  btn.disabled = true;
  result.className = 'test-result';
  result.style.display = 'none';

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' }, (res) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(res);
      });
    });

    if (response.success) {
      result.className = 'test-result ok';
      result.textContent = '✓ Connected — ' + (response.reply || '').substring(0, 120);
    } else {
      result.className = 'test-result err';
      result.textContent = '✗ ' + (response.error || 'Failed');
    }
  } catch (err) {
    result.className = 'test-result err';
    result.textContent = '✗ ' + err.message;
  }

  btn.textContent = 'Test Connection';
  btn.disabled = false;
}

// ── Status ──
function updateStatus() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    if (res) document.getElementById('sessionCount').textContent = res.activeSessions || '0';
  });
}

// ── Saved flash ──
function flashSaved(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1500);
}

// ── Utils ──
function esc(str) { return (str || '').replace(/"/g, '&quot;'); }

function deepMerge(defaults, overrides) {
  const result = { ...defaults };
  for (const key of Object.keys(overrides || {})) {
    if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key]) && defaults[key]) {
      result[key] = deepMerge(defaults[key], overrides[key]);
    } else if (overrides[key] !== undefined) {
      result[key] = overrides[key];
    }
  }
  return result;
}
