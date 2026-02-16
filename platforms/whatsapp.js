/**
 * Airminal Agent Bridge — WhatsApp Web Platform
 * 
 * Platform-specific selectors and hooks for web.whatsapp.com
 * Uses stable selectors: data-* attributes, aria roles, structural patterns
 */

(function () {
  'use strict';

  AirminalPlatform.init({
    platform: 'whatsapp',

    selectors: {
      chatPanel:       '#main',
      messageRow:      '[data-id]',
      messageText:     '.copyable-text [class*="selectable-text"], .copyable-text span[dir], ._ao3e',
      messageIncoming: '.message-in',
      messageOutgoing: '.message-out',
      chatHeader:      '#main header span[title]',
      activeChat:      '#main header',
      composer:        '#main footer [contenteditable="true"][data-tab="10"], #main footer [contenteditable="true"]',
      sendButton:      '#main footer [data-icon="send"], #main footer [data-testid="send"]',
      footer:          '#main footer',
    },

    hooks: {
      getMessageId(msgEl) {
        return msgEl.getAttribute('data-id');
      },

      isIncoming(msgEl) {
        // WhatsApp marks outgoing with .message-out or data-id starting with "true_"
        if (msgEl.querySelector('.message-out') || msgEl.closest('.message-out')) return false;
        if (msgEl.classList?.contains('message-out')) return false;
        const id = msgEl.getAttribute('data-id') || '';
        if (id.startsWith('true_')) return false;
        // Must have .message-in somewhere
        return !!(msgEl.querySelector('.message-in') || msgEl.closest('.message-in') || msgEl.classList?.contains('message-in'));
      },

      extractText(msgEl) {
        const el = msgEl.querySelector('.copyable-text [class*="selectable-text"], .copyable-text span[dir], ._ao3e, .message-text');
        return el ? el.textContent?.trim() : null;
      },

      extractSender(msgEl) {
        const pre = msgEl.querySelector('[data-pre-plain-text]');
        if (pre) {
          const match = (pre.getAttribute('data-pre-plain-text') || '').match(/\]\s*(.+?):/);
          return match ? match[1] : '';
        }
        return '';
      },

      getChatName() {
        const el = document.querySelector('#main header span[title]');
        return el ? el.textContent.trim() : 'Unknown';
      },

      getChatId() {
        // Use chat name as fallback ID
        const el = document.querySelector('#main header span[title]');
        return el ? el.textContent.trim() : 'unknown';
      },

      getComposer() {
        return document.querySelector('#main footer [contenteditable="true"][data-tab="10"]')
            || document.querySelector('#main footer [contenteditable="true"]');
      },

      clickSend() {
        const btn = document.querySelector('#main footer [data-icon="send"]')
                 || document.querySelector('#main footer [data-testid="send"]')
                 || document.querySelector('#main footer button[aria-label="Send"]');
        if (btn) btn.click();
      },
    },
  });

})();
