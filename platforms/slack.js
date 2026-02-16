/**
 * Airminal Agent Bridge — Slack Platform
 * 
 * Platform-specific selectors and hooks for app.slack.com
 * Slack uses data-qa attributes and specific class patterns
 */

(function () {
  'use strict';

  AirminalPlatform.init({
    platform: 'slack',

    selectors: {
      chatPanel:       '.p-workspace__primary_view, [data-qa="message_pane"], .c-virtual_list__scroll_container',
      messageRow:      '[data-qa="virtual-list-item"], .c-message_kit__message, [data-qa="message_container"]',
      messageText:     '.c-message_kit__text [data-qa="message-text"], .p-rich_text_section, .c-message__body',
      messageIncoming: '',
      messageOutgoing: '',
      chatHeader:      '[data-qa="channel_header_title"], .p-channel_header__title button span, [data-qa="channel-header-channel-name"]',
      activeChat:      '.p-channel_header, [data-qa="channel_header"]',
      composer:        '[data-qa="message_input"] [contenteditable="true"], .ql-editor[contenteditable="true"], [data-qa="texty_composer_input"]',
      sendButton:      '[data-qa="texty_send_button"], [aria-label="Send message"], button.c-texty_input__button--send',
      footer:          '.p-message_input, [data-qa="message_input"], .c-texty_input',
    },

    hooks: {
      getMessageId(msgEl) {
        // Slack uses data-item-key or data-ts for message timestamps
        const ts = msgEl.getAttribute('data-item-key')
                || msgEl.getAttribute('data-ts')
                || msgEl.closest('[data-item-key]')?.getAttribute('data-item-key')
                || msgEl.closest('[data-ts]')?.getAttribute('data-ts');
        if (ts) return 'slack_' + ts;

        const text = msgEl.querySelector('.c-message_kit__text, .p-rich_text_section')?.textContent || '';
        return 'slack_' + hashString(text.substring(0, 100));
      },

      isIncoming(msgEl) {
        // Slack doesn't strongly differentiate incoming/outgoing visually in the same way
        // Check if the sender matches the current user
        const senderEl = msgEl.querySelector('[data-qa="message_sender_name"], .c-message__sender button');
        if (!senderEl) return true;

        // Get current user from the workspace header/profile
        const currentUser = document.querySelector('[data-qa="user-button"] span, .p-ia__sidebar_header__user__name')?.textContent?.trim();
        if (currentUser && senderEl.textContent.trim() === currentUser) return false;

        // Check for "you" indicators
        const sender = senderEl.textContent.trim().toLowerCase();
        if (sender === 'you') return false;

        return true;
      },

      extractText(msgEl) {
        const el = msgEl.querySelector('[data-qa="message-text"]')
                || msgEl.querySelector('.p-rich_text_section')
                || msgEl.querySelector('.c-message__body')
                || msgEl.querySelector('.c-message_kit__text');
        if (el) return el.textContent?.trim();

        // Fallback: concatenate all rich text blocks
        const blocks = msgEl.querySelectorAll('.p-rich_text_section, .p-rich_text_block');
        if (blocks.length) return [...blocks].map(b => b.textContent.trim()).join('\n');
        return null;
      },

      extractSender(msgEl) {
        const el = msgEl.querySelector('[data-qa="message_sender_name"]')
                || msgEl.querySelector('.c-message__sender button')
                || msgEl.querySelector('.c-message_kit__sender');
        return el ? el.textContent.trim() : '';
      },

      getChatName() {
        const el = document.querySelector('[data-qa="channel_header_title"]')
                || document.querySelector('.p-channel_header__title button span')
                || document.querySelector('[data-qa="channel-header-channel-name"]');
        return el ? el.textContent.trim() : 'Unknown';
      },

      getChatId() {
        // Slack URL contains channel ID: /client/TWORKSPACE/CCHANNEL
        const match = window.location.pathname.match(/\/([CDG][A-Z0-9]+)(?:\/|$)/);
        if (match) return 'slack_' + match[1];
        return this.getChatName();
      },

      getComposer() {
        return document.querySelector('[data-qa="message_input"] [contenteditable="true"]')
            || document.querySelector('.ql-editor[contenteditable="true"]')
            || document.querySelector('[data-qa="texty_composer_input"]')
            || document.querySelector('div[contenteditable="true"][role="textbox"]');
      },

      clickSend() {
        const btn = document.querySelector('[data-qa="texty_send_button"]')
                 || document.querySelector('[aria-label="Send message"]')
                 || document.querySelector('button.c-texty_input__button--send');
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
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return Math.abs(hash).toString(36);
  }

})();
