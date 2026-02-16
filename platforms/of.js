/**
 * Airminal Agent Bridge — OF Platform
 * 
 * Platform-specific selectors and hooks for onlyfans.com messaging
 * OF uses Angular/custom framework with specific class patterns
 */

(function () {
  'use strict';

  AirminalPlatform.init({
    platform: 'of',

    selectors: {
      chatPanel:       '.b-chat__messages-wrapper, .b-chats__conversations-content, [class*="chat-messages"]',
      messageRow:      '.b-chat__message, .m-chat-message, [class*="chat-message"]',
      messageText:     '.b-chat__message__text, .m-chat-message__text, [class*="message__text"]',
      messageIncoming: '',
      messageOutgoing: '',
      chatHeader:      '.b-chat__header__name, .g-user-name, [class*="chat-header"] .g-user-name',
      activeChat:      '.b-chat__header, [class*="chat-header"]',
      composer:        '.b-chat__input textarea, .b-chat__input [contenteditable="true"], [class*="chat-input"] textarea, [class*="chat-input"] [contenteditable="true"]',
      sendButton:      '.b-chat__btn-submit, .b-chat__send-btn, [class*="chat-input"] button[type="submit"], button.g-btn.m-rounded[type="submit"]',
      footer:          '.b-chat__input, .b-chat__footer, [class*="chat-input"]',
    },

    hooks: {
      getMessageId(msgEl) {
        const id = msgEl.getAttribute('data-id')
                || msgEl.getAttribute('data-message-id')
                || msgEl.closest('[data-id]')?.getAttribute('data-id');
        if (id) return 'of_' + id;

        // Fallback: hash content + timestamp
        const text = msgEl.querySelector('.b-chat__message__text, [class*="message__text"]')?.textContent || '';
        const time = msgEl.querySelector('.b-chat__message__time, [class*="message__time"], time')?.textContent || '';
        return 'of_' + hashString(text.substring(0, 80) + time);
      },

      isIncoming(msgEl) {
        // OF marks outgoing with specific classes
        const msg = msgEl.closest('.b-chat__message') || msgEl;

        // Outgoing messages typically have "m-from-me" or "from-me" class
        if (msg.classList.contains('m-from-me')) return false;
        if (msg.classList.contains('from-me')) return false;

        const cls = msg.className || '';
        if (cls.includes('from-me') || cls.includes('fromMe') || cls.includes('outgoing') || cls.includes('is-mine')) return false;

        // Check alignment — outgoing usually on the right
        const style = window.getComputedStyle(msg);
        if (style.marginLeft === 'auto' || style.alignSelf === 'flex-end') return false;

        // Check for specific data attributes
        const isOwn = msg.getAttribute('data-is-own') || msg.getAttribute('data-from-me');
        if (isOwn === 'true' || isOwn === '1') return false;

        return true;
      },

      extractText(msgEl) {
        const el = msgEl.querySelector('.b-chat__message__text')
                || msgEl.querySelector('.m-chat-message__text')
                || msgEl.querySelector('[class*="message__text"]');
        if (el) return el.textContent?.trim();

        // Fallback: look for text content in message bubble
        const bubble = msgEl.querySelector('[class*="bubble"], [class*="content"]');
        if (bubble) {
          // Skip media-only messages (images, videos)
          const hasMedia = bubble.querySelector('img, video, [class*="media"], [class*="photo"]');
          if (hasMedia && !bubble.textContent?.trim()) return null;
          return bubble.textContent?.trim();
        }

        return null;
      },

      extractSender(msgEl) {
        const el = msgEl.querySelector('.b-chat__message__user-name, [class*="message__username"], .g-user-name');
        return el ? el.textContent.trim() : '';
      },

      getChatName() {
        const el = document.querySelector('.b-chat__header__name')
                || document.querySelector('.b-chat__header .g-user-name')
                || document.querySelector('[class*="chat-header"] .g-user-name')
                || document.querySelector('[class*="chat-header"] a[href*="/"]');
        return el ? el.textContent.trim() : 'Unknown';
      },

      getChatId() {
        // Try URL for chat/user ID
        const match = window.location.pathname.match(/\/my\/chats\/chat\/(\d+)/)
                   || window.location.pathname.match(/\/messages\/(\d+)/);
        if (match) return 'of_' + match[1];

        // Try from DOM
        const chatEl = document.querySelector('[data-chat-id], [data-conversation-id]');
        const chatId = chatEl?.getAttribute('data-chat-id') || chatEl?.getAttribute('data-conversation-id');
        if (chatId) return 'of_' + chatId;

        return this.getChatName();
      },

      getComposer() {
        return document.querySelector('.b-chat__input textarea')
            || document.querySelector('.b-chat__input [contenteditable="true"]')
            || document.querySelector('[class*="chat-input"] textarea')
            || document.querySelector('[class*="chat-input"] [contenteditable="true"]');
      },

      clickSend() {
        const btn = document.querySelector('.b-chat__btn-submit:not([disabled])')
                 || document.querySelector('.b-chat__send-btn:not([disabled])')
                 || document.querySelector('[class*="chat-input"] button[type="submit"]')
                 || document.querySelector('button.g-btn.m-rounded[type="submit"]');
        if (btn && !btn.disabled) { btn.click(); return; }

        // Fallback: press Enter
        const composer = this.getComposer();
        if (composer) {
          if (composer.tagName === 'TEXTAREA') {
            // For textarea, Enter sends (Shift+Enter for newline)
            composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          } else {
            composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          }
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
