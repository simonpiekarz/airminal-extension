/**
 * Airminal Extension — Facebook Messenger Platform
 * 
 * Platform-specific selectors and hooks for www.messenger.com
 * Messenger uses React with data-testid attributes
 */

(function () {
  'use strict';

  AirminalPlatform.init({
    platform: 'messenger',

    selectors: {
      chatPanel:       '[role="main"]',
      messageRow:      '[data-testid="incoming_group"], [data-testid="message-container"], div[class*="message"]',
      messageText:     'div[dir="auto"], [data-testid="message-text"]',
      messageIncoming: '',   // Handled via hook
      messageOutgoing: '',   // Handled via hook
      chatHeader:      'h2, [data-testid="conversation-title"], [role="main"] header span',
      activeChat:      '[role="main"] header',
      composer:        '[role="textbox"][contenteditable="true"], [data-testid="message-input"] [contenteditable="true"]',
      sendButton:      '[data-testid="send-button"], [aria-label="Send"], [aria-label="Press enter to send"]',
      footer:          '[role="main"] footer, form',
    },

    hooks: {
      getMessageId(msgEl) {
        // Messenger doesn't have simple data-id — use a composite key
        const text = msgEl.querySelector('div[dir="auto"]')?.textContent || '';
        const time = msgEl.closest('[data-testid]')?.getAttribute('data-testid') || '';
        return 'msg_' + hashString(text + time + msgEl.className);
      },

      isIncoming(msgEl) {
        // Messenger typically marks outgoing messages with specific styles/classes
        // Outgoing messages are usually on the right side with a colored background
        const row = msgEl.closest('[class*="__"]') || msgEl;
        const style = window.getComputedStyle(row);
        
        // Check if message row is aligned to the right (outgoing)
        if (style.marginLeft === 'auto' || style.justifyContent === 'flex-end') return false;
        
        // Check data-testid patterns
        const testId = msgEl.getAttribute('data-testid') || msgEl.closest('[data-testid]')?.getAttribute('data-testid') || '';
        if (testId.includes('outgoing')) return false;
        if (testId.includes('incoming')) return true;

        // Check aria-label for "You sent" patterns
        const ariaLabel = msgEl.getAttribute('aria-label') || msgEl.closest('[aria-label]')?.getAttribute('aria-label') || '';
        if (ariaLabel.toLowerCase().startsWith('you sent') || ariaLabel.toLowerCase().startsWith('you ')) return false;

        // Default: treat as incoming if it doesn't look outgoing
        return true;
      },

      extractText(msgEl) {
        const el = msgEl.querySelector('div[dir="auto"]')
                || msgEl.querySelector('[data-testid="message-text"]')
                || msgEl.querySelector('span[dir="auto"]');
        return el ? el.textContent?.trim() : null;
      },

      extractSender(msgEl) {
        const nameEl = msgEl.querySelector('[data-testid="message-sender"]')
                    || msgEl.closest('[data-testid]')?.querySelector('h4, h5');
        return nameEl ? nameEl.textContent.trim() : '';
      },

      getChatName() {
        const el = document.querySelector('[data-testid="conversation-title"]')
                || document.querySelector('[role="main"] header h2')
                || document.querySelector('[role="main"] header span');
        return el ? el.textContent.trim() : 'Unknown';
      },

      getChatId() {
        // Try URL path for chat ID
        const match = window.location.pathname.match(/\/t\/(\d+)/);
        if (match) return 'messenger_' + match[1];
        return this.getChatName();
      },

      getComposer() {
        return document.querySelector('[role="textbox"][contenteditable="true"]')
            || document.querySelector('[data-testid="message-input"] [contenteditable="true"]')
            || document.querySelector('div[contenteditable="true"][aria-label*="message"]');
      },

      clickSend() {
        const btn = document.querySelector('[data-testid="send-button"]')
                 || document.querySelector('[aria-label="Send"]')
                 || document.querySelector('[aria-label="Press enter to send"]');
        if (btn) btn.click();
      },
    },
  });

  // ── Utility ──
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

})();
