/**
 * Airminal Agent Bridge — Gmail Platform v2
 * 
 * Gmail DOM is heavily obfuscated. Uses multiple detection strategies:
 * 1. Row-based: tr.zA (inbox rows), .zE (unread flag)
 * 2. Aria-based: [aria-label] patterns on rows
 * 3. Bold-based: unread emails have bold sender/subject
 * 4. Font-weight computed style check
 */

(function () {
  'use strict';

  const processedEmails = new Set();
  let pollInterval = null;
  let isProcessing = false;

  function log(...args) { console.log('[Airminal Gmail]', ...args); }

  AirminalPlatform.init({
    platform: 'gmail',

    selectors: {
      chatPanel:       'div[role="main"]',
      messageRow:      'tr.zA',
      messageText:     '.a3s.aiL, .ii.gt div',
      messageIncoming: '',
      messageOutgoing: '',
      chatHeader:      'h2[data-thread-perm-id], .ha h2, .hP',
      activeChat:      '.nH .if',
      composer:        'div[role="textbox"][aria-label*="Body"], div[aria-label="Message Body"][contenteditable="true"], .Am.Al.editable, div[g_editable="true"]',
      sendButton:      'div[role="button"][aria-label*="Send"], div[data-tooltip*="Send"]',
      footer:          '.ip.iq',
    },

    hooks: {
      getMessageId(msgEl) {
        const dataId = msgEl.getAttribute('data-legacy-message-id')
                    || msgEl.closest('[data-legacy-message-id]')?.getAttribute('data-legacy-message-id');
        if (dataId) return 'gmail_' + dataId;
        const subject = getSubjectFromRow(msgEl);
        const sender = getSenderFromRow(msgEl);
        return 'gmail_' + hashString(subject + sender);
      },

      isIncoming(msgEl) {
        if (msgEl.matches?.('tr.zA')) return isUnreadRow(msgEl);
        const fromEl = msgEl.querySelector('.gD, [email]');
        if (fromEl) {
          const name = fromEl.getAttribute('name') || fromEl.textContent || '';
          if (name.toLowerCase() === 'me') return false;
        }
        return true;
      },

      extractText(msgEl) {
        if (msgEl.matches?.('tr.zA')) {
          const subject = getSubjectFromRow(msgEl);
          const snippet = getSnippetFromRow(msgEl);
          return subject + (snippet ? ' — ' + snippet : '');
        }
        const body = msgEl.querySelector('.a3s.aiL') || msgEl.querySelector('.ii.gt div');
        return body ? body.textContent?.trim() : null;
      },

      extractSender(msgEl) {
        if (msgEl.matches?.('tr.zA')) return getSenderFromRow(msgEl);
        const from = msgEl.querySelector('.gD, [email]');
        return from?.getAttribute('name') || from?.textContent?.trim() || '';
      },

      getChatName() {
        const el = document.querySelector('h2[data-thread-perm-id]')
                || document.querySelector('.ha h2')
                || document.querySelector('.hP');
        return el ? el.textContent.trim() : 'Inbox';
      },

      getChatId() {
        const match = window.location.hash.match(/#[^/]*\/([a-zA-Z0-9]+)$/);
        if (match) return 'gmail_thread_' + match[1];
        return 'gmail_inbox';
      },

      getComposer() {
        return document.querySelector('div[role="textbox"][aria-label*="Body"]')
            || document.querySelector('div[aria-label="Message Body"][contenteditable="true"]')
            || document.querySelector('.Am.Al.editable')
            || document.querySelector('div[g_editable="true"]');
      },

      clickSend() {
        const btn = document.querySelector('div[role="button"][aria-label*="Send"]:not([aria-disabled="true"])')
                 || document.querySelector('div[data-tooltip*="Send"]:not([aria-disabled="true"])')
                 || document.querySelector('.T-I.J-J5-Ji[aria-label*="Send"]');
        if (btn) { btn.click(); return; }
        const composer = this.getComposer();
        if (composer) {
          composer.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', code: 'Enter', keyCode: 13, ctrlKey: true, bubbles: true
          }));
        }
      },

      onInit() {
        log('Initializing...');
        detectGmailStructure();
        markExistingUnread();
        startInboxPoller();
      },
    },
  });

  // ═══════════════════════════════════════
  // DOM Structure Detection (debug)
  // ═══════════════════════════════════════

  function detectGmailStructure() {
    const tests = {
      'tr.zA (inbox rows)': document.querySelectorAll('tr.zA').length,
      'tr.zA.zE (unread)': document.querySelectorAll('tr.zA.zE').length,
      'div[role="main"]': document.querySelectorAll('div[role="main"]').length,
      'span.bog (subjects)': document.querySelectorAll('span.bog').length,
      'span.zF (senders)': document.querySelectorAll('span.zF').length,
      'span.yP (senders alt)': document.querySelectorAll('span.yP').length,
      'span.y2 (snippets)': document.querySelectorAll('span.y2').length,
      'span[name]': document.querySelectorAll('span[name]').length,
      '[email]': document.querySelectorAll('[email]').length,
    };

    log('=== DOM Structure Scan ===');
    for (const [sel, count] of Object.entries(tests)) {
      log(`  ${count > 0 ? '✓' : '✗'} ${sel}: ${count}`);
    }

    const sample = document.querySelector('tr.zA');
    if (sample) {
      log('Sample row — classes:', sample.className);
      log('Sample row — unread:', isUnreadRow(sample));
      log('Sample row — sender:', getSenderFromRow(sample));
      log('Sample row — subject:', getSubjectFromRow(sample));
      log('Sample row — snippet:', getSnippetFromRow(sample).substring(0, 80));
    } else {
      log('⚠ No tr.zA rows found!');
    }
    log('=========================');
  }

  // ═══════════════════════════════════════
  // Unread Detection
  // ═══════════════════════════════════════

  function isUnreadRow(row) {
    if (row.classList.contains('zE')) return true;
    const bold = row.querySelector('td .xT b, td .bog b, td b > span');
    if (bold) return true;
    const aria = row.getAttribute('aria-label') || '';
    if (aria.toLowerCase().includes('unread')) return true;
    const sender = row.querySelector('.zF, .yP, span[name]');
    if (sender) {
      const weight = window.getComputedStyle(sender).fontWeight;
      if (weight === 'bold' || weight === '700' || parseInt(weight) >= 700) return true;
    }
    return false;
  }

  function getUnreadRows() {
    const rows = document.querySelectorAll('tr.zA');
    const unread = [];
    for (const row of rows) {
      if (isUnreadRow(row)) unread.push(row);
    }
    return unread;
  }

  // ═══════════════════════════════════════
  // Inbox Polling
  // ═══════════════════════════════════════

  function markExistingUnread() {
    // Mark ALL visible rows (not just unread) to be safe
    const allRows = document.querySelectorAll('tr.zA');
    for (const row of allRows) {
      const sender = getSenderFromRow(row);
      const subject = getSubjectFromRow(row);
      const snippet = getSnippetFromRow(row);
      processedEmails.add(hashString(sender + subject + snippet));
    }
    log(`Marked ${processedEmails.size} existing emails as seen (from ${allRows.length} rows)`);
  }

  function startInboxPoller() {
    // Guard against double-start
    if (pollInterval) {
      log('Poller already running, skipping');
      return;
    }
    log('Poller started (10s interval)');
    pollInterval = setInterval(() => {
      if (isProcessing) return;
      scanForUnreadEmails();
    }, 10000);
    setTimeout(scanForUnreadEmails, 5000);
  }

  function scanForUnreadEmails() {
    const rows = getUnreadRows();

    // If no rows found and we're not in inbox view, navigate back
    if (document.querySelectorAll('tr.zA').length === 0) {
      const hash = window.location.hash || '';
      if (!hash.includes('inbox') && !hash.endsWith('#inbox')) {
        log('Not in inbox view, navigating back...');
        window.location.hash = '#inbox';
        return;
      }
    }

    let newCount = 0;

    for (const row of rows) {
      const sender = getSenderFromRow(row);
      const subject = getSubjectFromRow(row);
      const snippet = getSnippetFromRow(row);
      // Include snippet in hash so follow-ups in same thread are detected
      const emailKey = hashString(sender + subject + snippet);

      if (!processedEmails.has(emailKey)) {
        newCount++;
        processInboxRow(row, emailKey, sender, subject);
      }
    }
  }

  function processInboxRow(row, emailKey, sender, subject) {
    processedEmails.add(emailKey);
    const snippet = getSnippetFromRow(row);
    const fullText = `[Email from: ${sender}] [Subject: ${subject}] ${snippet}`;

    // Thread-level ID for session continuity (same thread = same conversation)
    const threadId = 'gmail_thread_' + hashString(sender + subject);

    log(`→ New email: "${subject}" from ${sender}`);

    isProcessing = true;

    chrome.runtime.sendMessage({
      type: 'NEW_MESSAGE',
      platform: 'gmail',
      chatId: threadId,
      chatName: subject || sender,
      text: fullText,
      senderName: sender,
      timestamp: Date.now(),
    }, (response) => {
      isProcessing = false;
      if (chrome.runtime.lastError) {
        log('✗ Error:', chrome.runtime.lastError.message);
        return;
      }
      if (!response) { log('✗ No response from background'); return; }
      log('← Response:', response.action, response.reason || response.reply?.substring(0, 60) || '');

      if (response.action === 'REPLY' && response.reply) {
        setTimeout(() => openAndReply(row, response.reply), response.delay || 2000);
      }
    });
  }

  // ═══════════════════════════════════════
  // Open email and compose reply
  // ═══════════════════════════════════════

  async function openAndReply(row, replyText) {
    log('Opening email...');
    row.click();
    await sleep(2000);

    log('Looking for Reply button...');
    const replyBtn = await waitForEl(
      '[data-tooltip="Reply"], [aria-label="Reply"], div[role="button"][data-tooltip="Reply"]',
      5000
    );

    if (!replyBtn) {
      log('✗ Reply button not found');
      // Fallback: scan all data-tooltip elements
      const tooltips = document.querySelectorAll('[data-tooltip]');
      let found = false;
      for (const el of tooltips) {
        if (el.getAttribute('data-tooltip')?.toLowerCase().includes('reply') &&
            !el.getAttribute('data-tooltip')?.toLowerCase().includes('all')) {
          el.click();
          found = true;
          log('Found via tooltip scan');
          break;
        }
      }
      if (!found) { goBackToInbox(); return; }
    } else {
      replyBtn.click();
    }

    await sleep(1500);

    log('Looking for composer...');
    const composer = await waitForEl(
      'div[role="textbox"][aria-label*="Body"], .Am.Al.editable, div[g_editable="true"]',
      5000
    );

    if (!composer) {
      log('✗ Composer not found');
      goBackToInbox();
      return;
    }

    log('Typing reply...');
    composer.focus();
    await sleep(200);

    const lines = replyText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        composer.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, shiftKey: true, bubbles: true
        }));
        await sleep(30);
      }
      document.execCommand('insertText', false, lines[i]);
      await sleep(20);
    }
    composer.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await sleep(500);

    const platConfig = await getPlatformConfig();

    if (platConfig.autoReply) {
      await sleep(500);
      const sendBtn = document.querySelector('div[role="button"][aria-label*="Send"]:not([aria-disabled="true"])')
                   || document.querySelector('div[data-tooltip*="Send"]:not([aria-disabled="true"])')
                   || document.querySelector('.T-I.J-J5-Ji[aria-label*="Send"]');
      if (sendBtn) {
        sendBtn.click();
        log('✓ Reply SENT');
        await sleep(2000);
      } else {
        log('Send button not found — draft saved');
      }
      // Always go back to inbox so the poller can detect new emails
      goBackToInbox();
    } else {
      log('Approval mode — draft ready');
      highlightDraft();
      // In approval mode, still go back after 5s so poller keeps working
      // The draft is auto-saved by Gmail
      await sleep(5000);
      goBackToInbox();
    }
  }

  function highlightDraft() {
    const composer = document.querySelector('div[role="textbox"][aria-label*="Body"], .Am.Al.editable');
    if (composer) {
      const el = document.createElement('div');
      el.style.cssText = 'padding:6px 12px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:6px;font-size:12px;color:#22c55e;margin-bottom:8px;font-family:sans-serif;';
      el.textContent = '✨ Agent draft — review and click Send';
      composer.parentElement.insertBefore(el, composer);
    }
  }

  function goBackToInbox() {
    log('Navigating back to inbox...');

    // Strategy 1: Click "Back to Inbox" button
    const backBtn = document.querySelector('[data-tooltip="Back to Inbox"]')
                 || document.querySelector('[aria-label="Back to Inbox"]')
                 || document.querySelector('[data-tooltip="Back to \u201cInbox\u201d"]')
                 || document.querySelector('.lS .ak');
    if (backBtn) {
      backBtn.click();
      log('Clicked Back to Inbox');
      return;
    }

    // Strategy 2: Click "Inbox" in sidebar
    const inboxLink = document.querySelector('a[href*="#inbox"]')
                   || document.querySelector('[data-tooltip="Inbox"]')
                   || document.querySelector('.aHS-bnq'); // Inbox link class
    if (inboxLink) {
      inboxLink.click();
      log('Clicked Inbox sidebar link');
      return;
    }

    // Strategy 3: Force navigate via URL hash
    log('Forcing navigation to inbox via URL');
    window.location.hash = '#inbox';
  }

  // ═══════════════════════════════════════
  // Row data extraction
  // ═══════════════════════════════════════

  function getSenderFromRow(row) {
    const named = row.querySelector('span[name]');
    if (named) return named.getAttribute('name') || named.textContent.trim();
    const zf = row.querySelector('.zF');
    if (zf) return zf.getAttribute('name') || zf.textContent.trim();
    const yp = row.querySelector('.yP');
    if (yp) return yp.getAttribute('name') || yp.textContent.trim();
    const emailEl = row.querySelector('[email]');
    if (emailEl) return emailEl.getAttribute('name') || emailEl.textContent.trim();
    return 'Unknown';
  }

  function getSubjectFromRow(row) {
    const bog = row.querySelector('span.bog');
    if (bog) return bog.textContent.trim();
    const bqe = row.querySelector('span.bqe');
    if (bqe) return bqe.textContent.trim();
    const xt = row.querySelector('.xT span');
    if (xt) return xt.textContent.trim();
    const y6 = row.querySelector('.y6 span');
    if (y6) return y6.textContent.trim();
    return 'No Subject';
  }

  function getSnippetFromRow(row) {
    const y2 = row.querySelector('span.y2');
    if (y2) return y2.textContent.trim().replace(/^\s*[-–—]\s*/, '');
    return '';
  }

  // ═══════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════

  function getPlatformConfig() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (res) => {
        resolve(res?.config?.platforms?.gmail || { autoReply: false });
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
