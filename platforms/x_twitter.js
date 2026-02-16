/**
 * Airminal Agent Bridge — X (Twitter) DM Platform
 * 
 * Platform-specific selectors and hooks for x.com/messages
 * X uses React with data-testid attributes extensively
 */

(function () {
  'use strict';

  AirminalPlatform.init({
    platform: 'x_twitter',

    selectors: {
      chatPanel:       '[data-testid="DmActivityContainer"], [data-testid="DMDrawer"], section[role="region"]',
      messageRow:      '[data-testid="messageEntry"], [data-testid="tweetText"], div[data-message-id]',
      messageText:     '[data-testid="tweetText"], [data-testid="messageText"], div[lang] span',
      messageIncoming: '',
      messageOutgoing: '',
      chatHeader:      '[data-testid="DMDrawerHeader"] span, [data-testid="conversation-header"] span, h2[role="heading"]',
      activeChat:      '[data-testid="DMDrawerHeader"], [data-testid="conversation-header"]',
      composer:        '[data-testid="dmComposerTextInput"], [data-testid="DMComposer_TextInput"] [contenteditable="true"], div[data-testid="dmComposerTextInput"][contenteditable="true"]',
      sendButton:      '[data-testid="dmComposerSendButton"], [data-testid="DMComposer_SendButton"]',
      footer:          '[data-testid="DMComposer"], [data-testid="dmComposer"]',
    },

    hooks: {
      getMessageId(msgEl) {
        const mid = msgEl.getAttribute('data-message-id')
                 || msgEl.closest('[data-message-id]')?.getAttribute('data-message-id');
        if (mid) return 'x_' + mid;

        const testId = msgEl.getAttribute('data-testid') || '';
        const text = msgEl.querySelector('[data-testid="tweetText"]')?.textContent || msgEl.textContent || '';
        return 'x_' + hashString(testId + text.substring(0, 80));
      },

      isIncoming(msgEl) {
        // X DMs: outgoing messages are typically on the right side
        // The message container often has a blue/colored background for sent messages
        const entry = msgEl.closest('[data-testid="messageEntry"]') || msgEl;
        const style = window.getComputedStyle(entry);

        // Check alignment — outgoing usually flex-end or margin-left auto
        if (style.justifyContent === 'flex-end') return false;
        if (style.marginLeft === 'auto') return false;

        // Check for blue bubble (outgoing indicator on X)
        const bubbles = entry.querySelectorAll('div[style*="background"]');
        for (const b of bubbles) {
          const bg = window.getComputedStyle(b).backgroundColor;
          if (bg && (bg.includes('29, 155, 240') || bg.includes('29,155,240'))) return false; // X blue
        }

        // Check parent container alignment
        const parent = entry.parentElement;
        if (parent) {
          const pStyle = window.getComputedStyle(parent);
          if (pStyle.alignItems === 'flex-end' || pStyle.justifyContent === 'flex-end') return false;
        }

        return true;
      },

      extractText(msgEl) {
        const el = msgEl.querySelector('[data-testid="tweetText"]')
                || msgEl.querySelector('[data-testid="messageText"]')
                || msgEl.querySelector('div[lang] span');
        return el ? el.textContent?.trim() : null;
      },

      extractSender(msgEl) {
        const nameEl = msgEl.querySelector('[data-testid="User-Name"]')
                    || msgEl.closest('[data-testid="messageEntry"]')?.querySelector('span[dir="ltr"]');
        return nameEl ? nameEl.textContent.trim() : '';
      },

      getChatName() {
        const el = document.querySelector('[data-testid="DMDrawerHeader"] span')
                || document.querySelector('[data-testid="conversation-header"] span')
                || document.querySelector('h2[role="heading"]');
        return el ? el.textContent.trim() : 'Unknown';
      },

      getChatId() {
        const match = window.location.pathname.match(/\/messages\/(\d+)/);
        if (match) return 'x_' + match[1];
        return this.getChatName();
      },

      getComposer() {
        return document.querySelector('[data-testid="dmComposerTextInput"]')
            || document.querySelector('[data-testid="DMComposer_TextInput"] [contenteditable="true"]')
            || document.querySelector('div[data-testid="dmComposerTextInput"][contenteditable="true"]');
      },

      clickSend() {
        const btn = document.querySelector('[data-testid="dmComposerSendButton"]')
                 || document.querySelector('[data-testid="DMComposer_SendButton"]');
        if (btn) { btn.click(); return; }

        const composer = this.getComposer();
        if (composer) {
          composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        }
      },
    },
  });

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return Math.abs(hash).toString(36);
  }

})();
