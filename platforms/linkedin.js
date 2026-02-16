/**
 * Airminal Extension — LinkedIn Messaging Platform
 * 
 * Platform-specific selectors and hooks for www.linkedin.com/messaging
 * LinkedIn uses Ember/React with specific class patterns and data attributes
 */

(function () {
  'use strict';

  AirminalPlatform.init({
    platform: 'linkedin',

    selectors: {
      chatPanel:       '.msg-conversation-card__content, .msg-thread, [data-test-id="conversation-thread"]',
      messageRow:      '.msg-s-event-listitem, .msg-s-message-list__event, [data-test-id="message-event"]',
      messageText:     '.msg-s-event-listitem__body, .msg-s-event-body-content p, [data-test-id="message-body"]',
      messageIncoming: '',
      messageOutgoing: '',
      chatHeader:      '.msg-conversation-card__participant-names, .msg-thread__link-to-profile h2, [data-test-id="conversation-header"] span',
      activeChat:      '.msg-thread__topcard, .msg-conversation-card__header',
      composer:        '.msg-form__contenteditable [contenteditable="true"], .msg-form__msg-content-container [contenteditable="true"], div[role="textbox"][contenteditable="true"]',
      sendButton:      '.msg-form__send-button, button[type="submit"].msg-form__send-btn, .msg-form__send-toggle button',
      footer:          '.msg-form, .msg-form__footer',
    },

    hooks: {
      getMessageId(msgEl) {
        // LinkedIn uses data attributes or unique class-based IDs
        const urn = msgEl.getAttribute('data-event-urn')
                 || msgEl.getAttribute('data-id')
                 || msgEl.getAttribute('id');
        if (urn) return 'li_' + urn;

        // Fallback: hash content + timestamp
        const text = msgEl.querySelector('.msg-s-event-listitem__body, .msg-s-event-body-content p')?.textContent || '';
        const time = msgEl.querySelector('time')?.getAttribute('datetime') || '';
        return 'li_' + hashString(text + time);
      },

      isIncoming(msgEl) {
        // LinkedIn marks your messages with specific classes
        // "msg-s-message-group--is-sender" on the parent group
        const group = msgEl.closest('.msg-s-message-group');
        if (group?.classList.contains('msg-s-message-group--is-sender')) return false;

        // Check for "You" or current user name in the sender area
        const sender = msgEl.closest('.msg-s-message-group')?.querySelector('.msg-s-message-group__name');
        if (sender) {
          const name = sender.textContent.trim().toLowerCase();
          if (name === 'you') return false;
        }

        // Check data attributes
        const isSelf = msgEl.getAttribute('data-is-from-self')
                    || msgEl.closest('[data-is-from-self]')?.getAttribute('data-is-from-self');
        if (isSelf === 'true') return false;

        return true;
      },

      extractText(msgEl) {
        const el = msgEl.querySelector('.msg-s-event-listitem__body')
                || msgEl.querySelector('.msg-s-event-body-content p')
                || msgEl.querySelector('[data-test-id="message-body"]');
        if (el) return el.textContent?.trim();

        // Fallback: get all paragraph text
        const ps = msgEl.querySelectorAll('p');
        const texts = [];
        for (const p of ps) {
          const t = p.textContent?.trim();
          if (t) texts.push(t);
        }
        return texts.join('\n') || null;
      },

      extractSender(msgEl) {
        const group = msgEl.closest('.msg-s-message-group');
        const nameEl = group?.querySelector('.msg-s-message-group__name')
                    || group?.querySelector('.msg-s-message-group__profile-link');
        return nameEl ? nameEl.textContent.trim() : '';
      },

      getChatName() {
        const el = document.querySelector('.msg-conversation-card__participant-names')
                || document.querySelector('.msg-thread__link-to-profile h2')
                || document.querySelector('[data-test-id="conversation-header"] span')
                || document.querySelector('.msg-overlay-bubble-header__title');
        return el ? el.textContent.trim() : 'Unknown';
      },

      getChatId() {
        // Try URL for thread ID
        const match = window.location.pathname.match(/\/messaging\/thread\/(\d+)/);
        if (match) return 'li_' + match[1];

        // Try from conversation card data
        const card = document.querySelector('.msg-conversation-card--active, .msg-thread');
        const urn = card?.getAttribute('data-thread-urn') || card?.getAttribute('data-conversation-id');
        if (urn) return 'li_' + urn;

        return this.getChatName();
      },

      getComposer() {
        return document.querySelector('.msg-form__contenteditable [contenteditable="true"]')
            || document.querySelector('.msg-form__msg-content-container [contenteditable="true"]')
            || document.querySelector('div[role="textbox"][contenteditable="true"]');
      },

      clickSend() {
        const btn = document.querySelector('.msg-form__send-button:not([disabled])')
                 || document.querySelector('button[type="submit"].msg-form__send-btn')
                 || document.querySelector('.msg-form__send-toggle button');
        if (btn && !btn.disabled) { btn.click(); return; }

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
