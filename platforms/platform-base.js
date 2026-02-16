/**
 * Airminal Extension — Platform Base
 * 
 * Shared logic for all messaging platforms.
 * Each platform file (whatsapp.js, messenger.js, instagram.js) extends this.
 * 
 * Lifecycle:
 *   1. Platform file defines SELECTORS and overrides
 *   2. Calls AirminalPlatform.init({ platform, selectors, ... })
 *   3. Base handles: observer, message detection, reply injection, badge
 */

window.AirminalPlatform = (function () {
  'use strict';

  let enabled = false;
  let config = {};
  let platform = 'unknown';
  let selectors = {};
  let observer = null;
  let processedMessages = new Set();
  let isTypingReply = false;
  let currentChatName = '';
  let enabledAt = 0;          // timestamp when this platform was activated
  let initialScanDone = false; // flag to mark all pre-existing messages as seen

  // Platform-specific overrides (set by each platform)
  let hooks = {
    isIncoming: null,         // (msgEl) => bool
    extractText: null,        // (msgEl) => string
    extractSender: null,      // (msgEl) => string
    getMessageId: null,       // (msgEl) => string
    getChatName: null,        // () => string
    getChatId: null,          // () => string
    getComposer: null,        // () => Element
    clickSend: null,          // () => void
    onInit: null,             // () => void (extra platform-specific setup)
  };

  // ── Initialize ──
  async function init(opts) {
    platform = opts.platform;
    selectors = opts.selectors || {};
    Object.assign(hooks, opts.hooks || {});

    console.log(`[Airminal ${platform}] Content script loaded`);

    chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (res) => {
      if (res?.config) {
        config = res.config;
        enabled = config.enabled && config.platforms?.[platform]?.enabled;
        enabledAt = Math.max(config.enabledAt || 0, config.platforms?.[platform]?.enabledAt || 0);
      }
    });

    createBadge();

    // Wait for the main chat panel to appear
    await waitForElement(selectors.chatPanel || 'body', 30000);
    console.log(`[Airminal ${platform}] Page loaded`);

    // ── Mark all currently visible messages as "seen" ──
    // This prevents processing old messages when the extension first loads
    markExistingMessages();

    startObserving();
    watchChatSwitches();

    if (hooks.onInit) hooks.onInit();
  }

  // ── Mark all existing messages as seen on load ──
  // Prevents the agent from replying to old messages when first activated
  function markExistingMessages() {
    const msgSelector = selectors.messageRow || '[data-id]';
    const existing = document.querySelectorAll(msgSelector);
    let count = 0;
    for (const el of existing) {
      const msgId = hooks.getMessageId ? hooks.getMessageId(el) : el.getAttribute('data-id');
      if (msgId) {
        processedMessages.add(msgId);
        count++;
      }
    }
    initialScanDone = true;
    console.log(`[Airminal ${platform}] Marked ${count} existing messages as seen — only new messages will be processed`);
  }

  // ── Badge ──
  function createBadge() {
    const badge = document.createElement('div');
    badge.id = 'airminal-status';
    badge.innerHTML = `<div class="airminal-badge" id="airminal-badge">
      <div class="airminal-badge-dot"></div>
      <span class="airminal-badge-text">Agent</span>
    </div>`;
    document.body.appendChild(badge);
    updateBadge();
  }

  function updateBadge() {
    const badge = document.getElementById('airminal-badge');
    if (!badge) return;
    const dot = badge.querySelector('.airminal-badge-dot');
    const text = badge.querySelector('.airminal-badge-text');

    const masterOn = config.enabled;
    const platformOn = config.platforms?.[platform]?.enabled;
    const hasEndpoint = !!config.agentEndpoint;

    if (masterOn && platformOn && hasEndpoint) {
      // Fully active
      dot.style.background = '#22c55e';
      dot.style.boxShadow = '0 0 6px rgba(34,197,94,0.6)';
      text.textContent = 'Agent Active';
      badge.style.opacity = '1';
    } else if (masterOn && platformOn && !hasEndpoint) {
      // On but no endpoint
      dot.style.background = '#f59e0b';
      dot.style.boxShadow = '0 0 6px rgba(245,158,11,0.6)';
      text.textContent = 'No Endpoint';
      badge.style.opacity = '1';
    } else if (!masterOn && platformOn) {
      // Platform enabled but master is off
      dot.style.background = '#f59e0b';
      dot.style.boxShadow = '0 0 6px rgba(245,158,11,0.6)';
      text.textContent = 'Master Off';
      badge.style.opacity = '0.8';
    } else if (masterOn && !platformOn) {
      // Master on but this platform is off
      dot.style.background = '#6b7280';
      dot.style.boxShadow = 'none';
      text.textContent = 'Platform Off';
      badge.style.opacity = '0.5';
    } else {
      // Everything off
      dot.style.background = '#6b7280';
      dot.style.boxShadow = 'none';
      text.textContent = 'Agent Off';
      badge.style.opacity = '0.5';
    }
  }

  // ── DOM Observer ──
  function startObserving() {
    const target = document.querySelector('#app') || document.querySelector('[role="application"]') || document.body;
    observer = new MutationObserver((mutations) => {
      if (!enabled || isTypingReply || !initialScanDone) return;
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType === 1) processNode(node);
        }
      }
    });
    observer.observe(target, { childList: true, subtree: true });
  }

  function processNode(node) {
    const msgSelector = selectors.messageRow || '[data-id]';
    const msgs = [];
    if (node.matches?.(msgSelector)) msgs.push(node);
    if (node.querySelectorAll) msgs.push(...node.querySelectorAll(msgSelector));
    for (const el of msgs) handleMessage(el);
  }

  function handleMessage(msgEl) {
    // Get unique ID
    const msgId = hooks.getMessageId ? hooks.getMessageId(msgEl) : msgEl.getAttribute('data-id');
    if (!msgId || processedMessages.has(msgId)) return;

    // Must be incoming
    const isIncoming = hooks.isIncoming ? hooks.isIncoming(msgEl) : !msgEl.querySelector(selectors.messageOutgoing);
    if (!isIncoming) return;

    // Extract text
    const text = hooks.extractText ? hooks.extractText(msgEl) : (() => {
      const el = msgEl.querySelector(selectors.messageText);
      return el ? el.textContent?.trim() : null;
    })();
    if (!text) return;

    processedMessages.add(msgId);

    const chatName = hooks.getChatName ? hooks.getChatName() : currentChatName;
    const chatId = hooks.getChatId ? hooks.getChatId() : chatName;
    const senderName = hooks.extractSender ? hooks.extractSender(msgEl) : '';

    console.log(`[Airminal ${platform}] New: "${text.substring(0, 60)}..." in "${chatName}"`);
    showTyping(true);

    chrome.runtime.sendMessage({
      type: 'NEW_MESSAGE',
      platform, chatId, chatName, text, senderName, timestamp: Date.now(),
    }, (response) => {
      showTyping(false);
      if (chrome.runtime.lastError || !response) return;
      if (response.action === 'REPLY' && response.reply) {
        const currentId = hooks.getChatId ? hooks.getChatId() : (hooks.getChatName ? hooks.getChatName() : '');
        if (currentId === chatId) {
          setTimeout(() => typeAndSend(response.reply), response.delay || 1500);
        }
      } else if (response.action === 'ERROR') {
        flashError();
      }
    });
  }

  // ── Type and send reply ──
  async function typeAndSend(text) {
    isTypingReply = true;
    try {
      let composer;
      if (hooks.getComposer) {
        composer = hooks.getComposer();
      } else {
        composer = await waitForElement(selectors.composer, 3000);
      }
      if (!composer) { console.error(`[Airminal ${platform}] Composer not found`); return; }

      composer.focus();
      await sleep(100);
      composer.textContent = '';

      // Type text with line breaks
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, shiftKey: true, bubbles: true }));
          await sleep(50);
        }
        document.execCommand('insertText', false, lines[i]);
        await sleep(30);
      }

      composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      await sleep(300);

      // Send
      if (hooks.clickSend) {
        hooks.clickSend();
      } else {
        const sendBtn = document.querySelector(selectors.sendButton);
        if (sendBtn) sendBtn.click();
        else composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      }
      console.log(`[Airminal ${platform}] Reply sent`);
    } catch (err) {
      console.error(`[Airminal ${platform}] Send failed:`, err);
    } finally {
      isTypingReply = false;
    }
  }

  // ── Chat switch watcher ──
  function watchChatSwitches() {
    const headerSel = selectors.chatHeader || selectors.activeChat;
    if (!headerSel) return;
    const headerArea = document.querySelector(headerSel)?.closest('header') || document.querySelector('#main header');
    if (!headerArea) return;
    new MutationObserver(() => {
      const name = hooks.getChatName ? hooks.getChatName() : '';
      if (name && name !== currentChatName) currentChatName = name;
    }).observe(headerArea, { childList: true, subtree: true, characterData: true });
  }

  // ── Typing indicator ──
  function showTyping(show) {
    let el = document.getElementById('airminal-typing');
    if (show && !el) {
      el = document.createElement('div');
      el.id = 'airminal-typing';
      el.className = 'airminal-typing';
      el.innerHTML = `<div class="airminal-typing-inner">
        <span class="airminal-typing-dot"></span><span class="airminal-typing-dot"></span><span class="airminal-typing-dot"></span>
        <span class="airminal-typing-label">Agent thinking…</span>
      </div>`;
      const footer = document.querySelector(selectors.footer || '#main footer');
      if (footer) footer.parentNode.insertBefore(el, footer);
    } else if (!show && el) {
      el.remove();
    }
  }

  function flashError() {
    const dot = document.querySelector('#airminal-badge .airminal-badge-dot');
    if (dot) { dot.style.background = '#ef4444'; setTimeout(updateBadge, 3000); }
  }

  // ── Listen for config updates ──
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'CONFIG_UPDATED') {
      const wasEnabled = enabled;
      config = msg.config;
      enabled = config.enabled && config.platforms?.[platform]?.enabled;
      enabledAt = Math.max(config.enabledAt || 0, config.platforms?.[platform]?.enabledAt || 0);

      // If just turned ON, mark all current messages as seen
      // and re-run platform init hooks (e.g. start pollers)
      if (enabled && !wasEnabled) {
        markExistingMessages();
        if (hooks.onInit) {
          console.log(`[Airminal ${platform}] Re-running onInit (freshly enabled)`);
          hooks.onInit();
        }
        console.log(`[Airminal ${platform}] Enabled — only new messages from now`);
      }

      updateBadge();
    }
  });

  // ── Utils ──
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      const sels = selector.split(',').map(s => s.trim());
      const check = () => { for (const s of sels) { const el = document.querySelector(s); if (el) return el; } return null; };
      const existing = check();
      if (existing) return resolve(existing);
      const obs = new MutationObserver(() => { const el = check(); if (el) { obs.disconnect(); resolve(el); } });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(check()); }, timeout);
    });
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Periodic cleanup of processed IDs
  setInterval(() => { if (processedMessages.size > 500) processedMessages = new Set([...processedMessages].slice(-200)); }, 5 * 60 * 1000);

  return { init, updateBadge };
})();
