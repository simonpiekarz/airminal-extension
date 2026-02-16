/**
 * Airminal Extension — Outlook Web Platform
 * 
 * Platform-specific selectors and hooks for outlook.office.com / outlook.live.com
 * Outlook uses React with data-* attributes and aria labels
 * Same approach as Gmail: polls for unread, opens email, clicks reply, types response
 */

(function () {
  'use strict';

  const processedEmails = new Set();
  let pollInterval = null;
  let isProcessing = false;

  AirminalPlatform.init({
    platform: 'outlook',

    selectors: {
      chatPanel:       '[role="main"], .customScrollBar, [data-app-section="ConversationContainer"]',
      messageRow:      'div[data-convid], [aria-label*="Unread"], tr[aria-label]',
      messageText:     'div[aria-label="Message body"], [role="document"] div, .wide-content-host',
      messageIncoming: '',
      messageOutgoing: '',
      chatHeader:      '[role="heading"][aria-level="2"], .allowTextSelection span, [data-app-section="SubjectLine"]',
      activeChat:      '[data-app-section="ReadingPaneHeader"]',
      composer:        'div[role="textbox"][aria-label*="Message body"], div[aria-label="Message body"][contenteditable="true"], div.dFCbN[contenteditable="true"]',
      sendButton:      'button[aria-label="Send"], button[title="Send"], [data-icon-name="Send"]',
      footer:          '[data-app-section="ComposeAction"], .dFCbN',
    },

    hooks: {
      getMessageId(msgEl) {
        const convId = msgEl.getAttribute('data-convid')
                    || msgEl.closest('[data-convid]')?.getAttribute('data-convid');
        if (convId) return 'ol_' + convId;

        const itemId = msgEl.getAttribute('data-item-id')
                    || msgEl.closest('[data-item-id]')?.getAttribute('data-item-id');
        if (itemId) return 'ol_' + itemId;

        const aria = msgEl.getAttribute('aria-label') || '';
        return 'ol_' + hashString(aria.substring(0, 120));
      },

      isIncoming(msgEl) {
        // In list view: check for unread indicator
        const aria = msgEl.getAttribute('aria-label') || '';
        if (aria.toLowerCase().includes('unread')) return true;

        // In reading pane: check sender vs current user
        const senderEl = msgEl.querySelector('[data-testid="SenderPersona"], .lpc-hoverTarget, [aria-label*="From"]');
        if (senderEl) {
          const sender = senderEl.textContent?.trim().toLowerCase() || '';
          if (sender === 'me' || sender === 'you') return false;
        }

        return true;
      },

      extractText(msgEl) {
        // From list row: aria-label contains subject + snippet
        const aria = msgEl.getAttribute('aria-label') || '';
        if (aria && aria.length > 10) {
          return aria;
        }

        // From reading pane
        const body = msgEl.querySelector('div[aria-label="Message body"]')
                  || msgEl.querySelector('[role="document"] div')
                  || msgEl.querySelector('.wide-content-host');
        return body ? body.textContent?.trim() : null;
      },

      extractSender(msgEl) {
        const el = msgEl.querySelector('[data-testid="SenderPersona"]')
                || msgEl.querySelector('.lpc-hoverTarget')
                || msgEl.querySelector('[class*="senderName"]');
        if (el) return el.textContent.trim();

        // Parse from aria-label
        const aria = msgEl.getAttribute('aria-label') || '';
        const match = aria.match(/from\s+([^,]+)/i);
        return match ? match[1].trim() : '';
      },

      getChatName() {
        const el = document.querySelector('[role="heading"][aria-level="2"]')
                || document.querySelector('.allowTextSelection span')
                || document.querySelector('[data-app-section="SubjectLine"]');
        return el ? el.textContent.trim() : 'Inbox';
      },

      getChatId() {
        const convEl = document.querySelector('[data-convid]');
        if (convEl) return 'ol_' + convEl.getAttribute('data-convid');

        const match = window.location.href.match(/id=([^&]+)/);
        if (match) return 'ol_' + match[1];

        return 'ol_inbox';
      },

      getComposer() {
        return document.querySelector('div[role="textbox"][aria-label*="Message body"]')
            || document.querySelector('div[aria-label="Message body"][contenteditable="true"]')
            || document.querySelector('div.dFCbN[contenteditable="true"]');
      },

      clickSend() {
        const btn = document.querySelector('button[aria-label="Send"]')
                 || document.querySelector('button[title="Send"]')
                 || document.querySelector('[data-icon-name="Send"]')?.closest('button');
        if (btn && !btn.disabled) { btn.click(); return; }

        // Fallback: Ctrl+Enter
        const composer = this.getComposer();
        if (composer) {
          composer.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', code: 'Enter', keyCode: 13,
            ctrlKey: true, bubbles: true
          }));
        }
      },

      onInit() {
        console.log('[Airminal Outlook] Starting inbox poller');
        markExistingUnread();
        startInboxPoller();
      },
    },
  });

  // ═══════════════════════════════════════
  // Outlook inbox polling (same pattern as Gmail)
  // ═══════════════════════════════════════

  function markExistingUnread() {
    const rows = document.querySelectorAll(
      'div[data-convid][aria-label*="Unread"], ' +
      'tr[aria-label*="Unread"], ' +
      '[class*="listItem"][aria-label*="Unread"]'
    );
    for (const row of rows) {
      const aria = row.getAttribute('aria-label') || '';
      const emailKey = hashString(aria.substring(0, 150));
      processedEmails.add(emailKey);
    }
    console.log(`[Airminal Outlook] Marked ${processedEmails.size} existing unread emails as seen`);
  }

  function startInboxPoller() {
    if (pollInterval) return;
    pollInterval = setInterval(() => {
      if (isProcessing) return;
      scanForUnreadEmails();
    }, 10000);
    setTimeout(scanForUnreadEmails, 3000);
  }

  function scanForUnreadEmails() {
    // Look for unread items in the message list
    const rows = document.querySelectorAll(
      'div[data-convid][aria-label*="Unread"], ' +
      'tr[aria-label*="Unread"], ' +
      '[class*="listItem"][aria-label*="Unread"]'
    );
    if (!rows.length) return;

    for (const row of rows) {
      processInboxRow(row);
    }
  }

  function processInboxRow(row) {
    const aria = row.getAttribute('aria-label') || '';
    const emailKey = hashString(aria.substring(0, 150));

    if (processedEmails.has(emailKey)) return;
    processedEmails.add(emailKey);

    // Parse sender and subject from aria-label
    // Outlook format: "SenderName, Subject, Preview text, Received time, Unread"
    const parts = aria.split(',').map(s => s.trim());
    const sender = parts[0] || 'Unknown';
    const subject = parts[1] || 'No Subject';
    const snippet = parts.slice(2, -2).join(', ');

    const fullText = `[Email from: ${sender}] [Subject: ${subject}] ${snippet}`;

    console.log(`[Airminal Outlook] New unread: "${subject}" from ${sender}`);

    isProcessing = true;

    chrome.runtime.sendMessage({
      type: 'NEW_MESSAGE',
      platform: 'outlook',
      chatId: 'ol_' + emailKey,
      chatName: subject || sender,
      text: fullText,
      senderName: sender,
      timestamp: Date.now(),
    }, (response) => {
      isProcessing = false;
      if (chrome.runtime.lastError || !response) return;

      if (response.action === 'REPLY' && response.reply) {
        setTimeout(() => {
          openAndReply(row, response.reply);
        }, response.delay || 2000);
      }
    });
  }

  async function openAndReply(row, replyText) {
    // Step 1: Click the email
    row.click();
    await sleep(2000);

    // Step 2: Click Reply
    const replyBtn = await waitForEl(
      'button[aria-label="Reply"], ' +
      'button[title="Reply"], ' +
      '[data-icon-name="Reply"]',
      5000
    );

    if (replyBtn) {
      replyBtn.click?.() || replyBtn.closest('button')?.click();
    } else {
      console.error('[Airminal Outlook] Reply button not found');
      return;
    }

    await sleep(1500);

    // Step 3: Find composer
    const composer = await waitForEl(
      'div[role="textbox"][aria-label*="Message body"], ' +
      'div[aria-label="Message body"][contenteditable="true"], ' +
      'div.dFCbN[contenteditable="true"]',
      5000
    );

    if (!composer) {
      console.error('[Airminal Outlook] Composer not found');
      return;
    }

    // Step 4: Type reply
    composer.focus();
    await sleep(200);

    const lines = replyText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        composer.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13,
          shiftKey: true, bubbles: true
        }));
        await sleep(30);
      }
      document.execCommand('insertText', false, lines[i]);
      await sleep(20);
    }

    composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: replyText }));
    await sleep(500);

    // Step 5: Check auto-reply setting
    const platConfig = await getPlatformConfig();

    if (platConfig.autoReply) {
      await sleep(500);
      const sendBtn = document.querySelector('button[aria-label="Send"]')
                   || document.querySelector('button[title="Send"]');
      if (sendBtn && !sendBtn.disabled) {
        sendBtn.click();
        console.log('[Airminal Outlook] Reply sent');
      } else {
        highlightDraft();
      }
    } else {
      console.log('[Airminal Outlook] Reply drafted (approval mode)');
      highlightDraft();
    }
  }

  function highlightDraft() {
    const composer = document.querySelector('div[role="textbox"][aria-label*="Message body"], div.dFCbN[contenteditable="true"]');
    if (composer) {
      const indicator = document.createElement('div');
      indicator.style.cssText = 'padding:6px 12px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:6px;font-size:12px;color:#22c55e;margin-bottom:8px;font-family:sans-serif;';
      indicator.textContent = '✨ Agent draft — review and click Send';
      composer.parentElement.insertBefore(indicator, composer);
    }
  }

  function getPlatformConfig() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (res) => {
        resolve(res?.config?.platforms?.outlook || { autoReply: false });
      });
    });
  }

  function waitForEl(selector, timeout = 5000) {
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

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return Math.abs(hash).toString(36);
  }

  window.addEventListener('beforeunload', () => { if (pollInterval) clearInterval(pollInterval); });

})();
