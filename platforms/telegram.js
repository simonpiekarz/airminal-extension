/**
 * Airminal Agent Bridge — Telegram Web Platform
 * 
 * Platform-specific selectors and hooks for web.telegram.org (K/A versions)
 * Telegram Web uses custom elements and data attributes
 */

(function () {
  'use strict';

  AirminalPlatform.init({
    platform: 'telegram',

    selectors: {
      chatPanel:       '#column-center .chat, .chat-container, #MiddleColumn',
      messageRow:      '.message, .Message, [data-mid]',
      messageText:     '.text-content, .message-text, .text-entity, [data-entity-type] span',
      messageIncoming: '',
      messageOutgoing: '.is-out, .own',
      chatHeader:      '.chat-info .user-title, .top-bar .peer-title, .ChatInfo .title',
      activeChat:      '#column-center .chat-header, .MiddleHeader',
      composer:        '#editable-message-text, .composer-input, [contenteditable="true"].input-message-input, div.input-field-input[contenteditable="true"]',
      sendButton:      '.send-btn:not(.hide), .Button.send, button.send-btn, .main-button.send',
      footer:          '.chat-input, .Composer, .composer-wrapper',
    },

    hooks: {
      getMessageId(msgEl) {
        // Telegram K uses data-mid, A uses data-message-id
        return msgEl.getAttribute('data-mid')
            || msgEl.getAttribute('data-message-id')
            || msgEl.getAttribute('data-msg-id')
            || 'tg_' + hashString(msgEl.textContent?.substring(0, 100) || '');
      },

      isIncoming(msgEl) {
        // Telegram marks outgoing with .is-out (K) or .own (A)
        if (msgEl.classList?.contains('is-out')) return false;
        if (msgEl.classList?.contains('own')) return false;
        if (msgEl.closest('.is-out') || msgEl.closest('.own')) return false;

        // Check for "Message.out" class pattern
        const cls = msgEl.className || '';
        if (cls.includes('out') && cls.includes('message')) return false;

        return true;
      },

      extractText(msgEl) {
        const el = msgEl.querySelector('.text-content')
                || msgEl.querySelector('.message-text')
                || msgEl.querySelector('.text-entity')
                || msgEl.querySelector('[data-entity-type]');
        if (el) return el.textContent?.trim();

        // Fallback: look for the text span directly
        const spans = msgEl.querySelectorAll('span');
        for (const s of spans) {
          const text = s.textContent?.trim();
          if (text && text.length > 1 && !s.closest('.time') && !s.closest('.message-time')) {
            return text;
          }
        }
        return null;
      },

      extractSender(msgEl) {
        const nameEl = msgEl.querySelector('.name-content, .peer-title, .message-author');
        return nameEl ? nameEl.textContent.trim() : '';
      },

      getChatName() {
        const el = document.querySelector('.chat-info .user-title')
                || document.querySelector('.top-bar .peer-title')
                || document.querySelector('.ChatInfo .title')
                || document.querySelector('#column-center .chat-header .content .title span');
        return el ? el.textContent.trim() : 'Unknown';
      },

      getChatId() {
        // Try URL hash for chat ID (Telegram K uses #chatId)
        const hash = window.location.hash;
        const match = hash.match(/#(-?\d+)/) || hash.match(/@(\w+)/);
        if (match) return 'tg_' + match[1];
        return this.getChatName();
      },

      getComposer() {
        return document.getElementById('editable-message-text')
            || document.querySelector('.input-message-input[contenteditable="true"]')
            || document.querySelector('div.input-field-input[contenteditable="true"]')
            || document.querySelector('[contenteditable="true"].composer-input');
      },

      clickSend() {
        const btn = document.querySelector('.send-btn:not(.hide)')
                 || document.querySelector('.Button.send')
                 || document.querySelector('button.send-btn')
                 || document.querySelector('.main-button.send');
        if (btn) { btn.click(); return; }

        // Fallback: press Enter
        const composer = this.getComposer();
        if (composer) {
          composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        }
      },
    },
  });

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

})();
