/**
 * Airminal Extension — Background Service Worker
 * Manages config, sessions, and API calls for all platforms.
 */

const CONFIG_DEFAULTS = {
  agentEndpoint: '',
  enabled: false,
  enabledAt: 0,
  replyDelay: 1500,
  maxHistoryLength: 20,
  systemPrompt: '',
  // Per-platform settings
  platforms: {
    whatsapp:  { enabled: false, enabledAt: 0, triggerPrefix: '', allowedChats: [], blockedChats: [], autoReply: true },
    messenger: { enabled: false, enabledAt: 0, triggerPrefix: '', allowedChats: [], blockedChats: [], autoReply: true },
    instagram: { enabled: false, enabledAt: 0, triggerPrefix: '', allowedChats: [], blockedChats: [], autoReply: true },
    telegram:  { enabled: false, enabledAt: 0, triggerPrefix: '', allowedChats: [], blockedChats: [], autoReply: true },
    linkedin:  { enabled: false, enabledAt: 0, triggerPrefix: '', allowedChats: [], blockedChats: [], autoReply: true },
    x_twitter: { enabled: false, enabledAt: 0, triggerPrefix: '', allowedChats: [], blockedChats: [], autoReply: true },
    slack:     { enabled: false, enabledAt: 0, triggerPrefix: '', allowedChats: [], blockedChats: [], autoReply: true },
    discord:   { enabled: false, enabledAt: 0, triggerPrefix: '', allowedChats: [], blockedChats: [], autoReply: true },
    teams:     { enabled: false, enabledAt: 0, triggerPrefix: '', allowedChats: [], blockedChats: [], autoReply: true },
    gmail:     { enabled: false, enabledAt: 0, triggerPrefix: '', allowedChats: [], blockedChats: [], autoReply: false },
    of:        { enabled: false, enabledAt: 0, triggerPrefix: '', allowedChats: [], blockedChats: [], autoReply: true },
    outlook:   { enabled: false, enabledAt: 0, triggerPrefix: '', allowedChats: [], blockedChats: [], autoReply: false },
  },
  // Scheduled automations
  automations: {
    instagram_post: {
      enabled: false,
      intervalHours: 24,
      prompt: '',
      lastRun: 0,
      nextRun: 0,
    },
    x_post: {
      enabled: false,
      intervalHours: 24,
      prompt: '',
      lastRun: 0,
      nextRun: 0,
    },
    linkedin_post: {
      enabled: false,
      intervalHours: 24,
      prompt: '',
      lastRun: 0,
      nextRun: 0,
    },
  }
};

const sessions = new Map();
let config = { ...CONFIG_DEFAULTS };

// ── Load config on startup ──
chrome.storage.local.get('airminalConfig', (result) => {
  if (result.airminalConfig) {
    config = deepMerge(CONFIG_DEFAULTS, result.airminalConfig);
  }
  console.log('[BG] Config loaded:', config.enabled ? 'ON' : 'OFF', '| Endpoint:', config.agentEndpoint || 'NONE');
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.airminalConfig) {
    config = deepMerge(CONFIG_DEFAULTS, changes.airminalConfig.newValue);
    broadcast({ type: 'CONFIG_UPDATED', config });
  }
});

// ── Message handler ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {

    case 'NEW_MESSAGE':
      handleNewMessage(msg).then(sendResponse);
      return true;

    case 'GET_CONFIG':
      sendResponse({ config });
      return false;

    case 'SAVE_CONFIG':
      const newCfg = msg.config;
      // Stamp enabledAt when master toggle turns ON
      if (newCfg.enabled && !config.enabled) {
        newCfg.enabledAt = Date.now();
      }
      // Stamp enabledAt for each platform that just got turned ON
      if (newCfg.platforms) {
        for (const [platId, platCfg] of Object.entries(newCfg.platforms)) {
          const oldPlat = config.platforms?.[platId];
          if (platCfg.enabled && (!oldPlat || !oldPlat.enabled)) {
            platCfg.enabledAt = Date.now();
          }
        }
      }
      config = deepMerge(CONFIG_DEFAULTS, newCfg);
      chrome.storage.local.set({ airminalConfig: config });
      broadcast({ type: 'CONFIG_UPDATED', config });
      // Re-setup scheduled alarms
      if (config.automations) setupAlarms(config.automations);
      sendResponse({ success: true });
      return false;

    case 'GET_STATUS':
      sendResponse({
        enabled: config.enabled,
        activeSessions: sessions.size,
        hasEndpoint: !!config.agentEndpoint,
      });
      return false;

    case 'CLEAR_SESSIONS':
      sessions.clear();
      sendResponse({ success: true });
      return false;

    case 'TEST_CONNECTION':
      testConnection().then(sendResponse);
      return true;

    case 'TRIGGER_AUTOMATION':
      triggerAutomation(msg.automationId).then(sendResponse);
      return true;

    case 'GET_AUTOMATION_STATUS':
      sendResponse({ automations: config.automations });
      return false;

    default:
      return false;
  }
});

// ── Alarm handler (for scheduled automations) ──
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('[BG] Alarm fired:', alarm.name);
  if (alarm.name.startsWith('automation_')) {
    const automationId = alarm.name.replace('automation_', '');
    triggerAutomation(automationId);
  }
});

// ── Setup alarms on startup ──
chrome.storage.local.get('airminalConfig', (result) => {
  if (result.airminalConfig?.automations) {
    setupAlarms(result.airminalConfig.automations);
  }
});

// ── Handle incoming message from any platform ──
async function handleNewMessage(msg) {
  const { platform, chatId, chatName, text, senderName, timestamp } = msg;

  if (!config.enabled || !config.agentEndpoint || !text?.trim()) {
    return { action: 'SKIP', reason: !config.enabled ? 'Disabled' : !config.agentEndpoint ? 'No endpoint' : 'Empty' };
  }

  // Check platform-specific settings
  const platCfg = config.platforms?.[platform];
  if (!platCfg || !platCfg.enabled) {
    return { action: 'SKIP', reason: `${platform} disabled` };
  }
  if (!platCfg.autoReply) {
    return { action: 'SKIP', reason: 'Auto-reply off' };
  }

  // ── TIMESTAMP GATE ──
  // Only process messages that arrived AFTER the platform was enabled.
  // This prevents processing thousands of old messages on first enable.
  const msgTime = timestamp || Date.now();
  const masterEnabledAt = config.enabledAt || 0;
  const platformEnabledAt = platCfg.enabledAt || 0;
  const gateTime = Math.max(masterEnabledAt, platformEnabledAt);

  if (gateTime > 0 && msgTime < gateTime) {
    return { action: 'SKIP', reason: 'Message predates enable time' };
  }

  // Blocked/allowed lists
  if (platCfg.blockedChats?.length > 0 && platCfg.blockedChats.some(n => chatName.toLowerCase().includes(n.toLowerCase()))) {
    return { action: 'SKIP', reason: 'Chat blocked' };
  }
  if (platCfg.allowedChats?.length > 0 && !platCfg.allowedChats.some(n => chatName.toLowerCase().includes(n.toLowerCase()))) {
    return { action: 'SKIP', reason: 'Not in allowed list' };
  }

  // Trigger prefix
  if (platCfg.triggerPrefix && !text.startsWith(platCfg.triggerPrefix)) {
    return { action: 'SKIP', reason: 'Missing prefix' };
  }

  // Session management
  const sessKey = `${platform}:${chatId}`;
  let session = sessions.get(sessKey);
  if (!session) {
    session = { conversationId: genId(), history: [], lastActivity: Date.now() };
    sessions.set(sessKey, session);
  }

  session.history.push({ role: 'user', content: text, name: senderName, ts: Date.now() });
  if (session.history.length > config.maxHistoryLength) {
    session.history = session.history.slice(-config.maxHistoryLength);
  }
  session.lastActivity = Date.now();

  try {
    const reply = await callAgent(text, session, chatName, platform);
    if (reply) {
      session.history.push({ role: 'assistant', content: reply, ts: Date.now() });
      return { action: 'REPLY', reply, delay: config.replyDelay };
    }
    return { action: 'SKIP', reason: 'Empty response' };
  } catch (err) {
    console.error('[BG] Agent error:', err);
    return { action: 'ERROR', reason: err.message };
  }
}

// ── Call agent API ──
async function callAgent(message, session, chatName, platform) {
  const payload = {
    message,
    conversation_id: session.conversationId,
    history: session.history.slice(-10),
    metadata: { platform, chat_name: chatName, timestamp: Date.now() },
  };
  if (config.systemPrompt) payload.system_prompt = config.systemPrompt;

  const res = await fetch(config.agentEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  const data = await res.json();

  return data.response || data.reply || data.text || data.message || data.content
    || data.choices?.[0]?.message?.content || (typeof data.output === 'string' ? data.output : null) || null;
}

// ── Test connection ──
async function testConnection() {
  if (!config.agentEndpoint) return { success: false, error: 'No endpoint' };
  try {
    const reply = await callAgent('Hello, test from extension.', { conversationId: 'test-' + Date.now(), history: [] }, 'Test', 'test');
    return { success: true, reply: reply || '(empty)' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Utils ──
function broadcast(msg) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, msg).catch(() => {}));
  });
}
function genId() { return 'conv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }

// ═══════════════════════════════════════
// SCHEDULER ENGINE
// ═══════════════════════════════════════

function setupAlarms(automations) {
  // Clear all existing automation alarms
  chrome.alarms.getAll((alarms) => {
    for (const a of alarms) {
      if (a.name.startsWith('automation_')) chrome.alarms.clear(a.name);
    }

    // Create new alarms for enabled automations
    for (const [id, auto] of Object.entries(automations || {})) {
      if (auto.enabled && auto.intervalHours > 0) {
        const intervalMinutes = auto.intervalHours * 60;
        // If nextRun is set and in the future, use delayInMinutes
        let delayMinutes = intervalMinutes;
        if (auto.nextRun && auto.nextRun > Date.now()) {
          delayMinutes = Math.max(1, Math.round((auto.nextRun - Date.now()) / 60000));
        }
        chrome.alarms.create('automation_' + id, {
          delayInMinutes: delayMinutes,
          periodInMinutes: intervalMinutes,
        });
        console.log(`[BG] Alarm set: ${id} — first in ${delayMinutes}min, then every ${intervalMinutes}min`);
      }
    }
  });
}

async function triggerAutomation(automationId) {
  console.log(`[BG] Triggering automation: ${automationId}`);

  if (!config.enabled || !config.agentEndpoint) {
    return { success: false, error: 'Agent not enabled or no endpoint' };
  }

  const auto = config.automations?.[automationId];
  if (!auto || !auto.enabled) {
    return { success: false, error: 'Automation not enabled' };
  }

  if (!auto.prompt) {
    return { success: false, error: 'No prompt configured' };
  }

  try {
    // Step 1: Ask the agent for content
    console.log(`[BG] Asking agent: "${auto.prompt.substring(0, 60)}..."`);
    const session = { conversationId: 'auto_' + automationId + '_' + Date.now(), history: [] };
    const agentResponse = await callAgent(auto.prompt, session, 'Automation: ' + automationId, 'automation');

    if (!agentResponse) {
      return { success: false, error: 'Agent returned empty response' };
    }

    console.log(`[BG] Agent response: "${agentResponse.substring(0, 100)}..."`);

    // Step 2: Parse the response for caption and image URL
    const parsed = parseAgentContentResponse(agentResponse);
    console.log('[BG] Parsed content:', { caption: parsed.caption?.substring(0, 60), imageUrl: parsed.imageUrl?.substring(0, 80) });

    // Step 3: Execute platform-specific posting
    let result;
    if (automationId === 'instagram_post') {
      result = await executePostOnPlatform(parsed, 'instagram_post', 'https://www.instagram.com/');
    } else if (automationId === 'x_post') {
      result = await executePostOnPlatform(parsed, 'x_post', 'https://x.com/home');
    } else if (automationId === 'linkedin_post') {
      result = await executePostOnPlatform(parsed, 'linkedin_post', 'https://www.linkedin.com/feed/');
    } else {
      result = { success: false, error: 'Unknown automation: ' + automationId };
    }

    // Step 4: Update last run time
    if (result.success) {
      config.automations[automationId].lastRun = Date.now();
      config.automations[automationId].nextRun = Date.now() + (auto.intervalHours * 60 * 60 * 1000);
      chrome.storage.local.set({ airminalConfig: config });
    }

    return result;

  } catch (err) {
    console.error('[BG] Automation error:', err);
    return { success: false, error: err.message };
  }
}

function parseAgentContentResponse(response) {
  let caption = response;
  let imageUrl = null;

  // Try to extract image URL from the response
  // Patterns: [IMAGE:url], {image_url: "..."}, plain URL ending in image extension, markdown ![](url)
  const urlPatterns = [
    /\[IMAGE:\s*(https?:\/\/[^\]\s]+)\]/i,
    /\{?\s*"?image_?url"?\s*:\s*"?(https?:\/\/[^"}\s]+)"?\s*\}?/i,
    /!\[.*?\]\((https?:\/\/[^\)]+)\)/,
    /(https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s<>"]*)?)/i,
  ];

  for (const pattern of urlPatterns) {
    const match = response.match(pattern);
    if (match) {
      imageUrl = match[1];
      // Remove the image reference from the caption
      caption = response.replace(match[0], '').trim();
      break;
    }
  }

  // Clean up caption — remove any JSON-like wrappers
  caption = caption
    .replace(/^\s*\{[\s\S]*"caption"\s*:\s*"/, '')
    .replace(/"\s*,?\s*"image[\s\S]*$/, '')
    .replace(/^\s*\{?\s*"?text"?\s*:\s*"?/, '')
    .replace(/"?\s*\}?\s*$/, '')
    .replace(/\\n/g, '\n')
    .trim();

  // If the entire response looks like JSON, try to parse it
  try {
    if (response.trim().startsWith('{')) {
      const json = JSON.parse(response);
      caption = json.caption || json.text || json.content || json.post || caption;
      imageUrl = json.image_url || json.imageUrl || json.image || imageUrl;
    }
  } catch (e) { /* not JSON */ }

  return { caption, imageUrl };
}

async function executePostOnPlatform({ caption, imageUrl }, platformId, defaultUrl) {
  console.log(`[BG] Executing post on ${platformId}...`);

  // Map platform IDs to URL match patterns
  const urlPatterns = {
    instagram_post: 'https://www.instagram.com/*',
    x_post: 'https://x.com/*',
    linkedin_post: 'https://www.linkedin.com/*',
  };

  const pattern = urlPatterns[platformId] || defaultUrl + '*';

  // Find an existing tab or open a new one
  const tabs = await chrome.tabs.query({ url: pattern });
  let tab;

  if (tabs.length > 0) {
    tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true });
    console.log(`[BG] Using existing tab for ${platformId}:`, tab.id);
  } else {
    tab = await chrome.tabs.create({ url: defaultUrl, active: true });
    console.log(`[BG] Opened new tab for ${platformId}:`, tab.id);
    await new Promise((resolve) => {
      const listener = (tabId, info) => {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
    await new Promise(r => setTimeout(r, 3000));
  }

  // Send the post command to the content script
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SCHEDULED_POST',
      platform: platformId,
      caption,
      imageUrl,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`[BG] ${platformId} content script error:`, chrome.runtime.lastError.message);
        resolve({ success: false, error: 'Content script not responding — is the page loaded?' });
      } else {
        resolve(response || { success: false, error: 'No response from poster' });
      }
    });
  });
}
function deepMerge(defaults, overrides) {
  const result = { ...defaults };
  for (const key of Object.keys(overrides)) {
    if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key]) && defaults[key]) {
      result[key] = deepMerge(defaults[key], overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

// Cleanup stale sessions every 30 min
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [k, s] of sessions) { if (s.lastActivity < cutoff) sessions.delete(k); }
}, 30 * 60 * 1000);

console.log('[BG] Service worker ready');
