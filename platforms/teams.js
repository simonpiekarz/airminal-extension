/**
 * Airminal Extension — Microsoft Teams Platform
 * 
 * Platform-specific selectors and hooks for teams.microsoft.com
 * Teams uses React with data-tid (test ID) attributes
 */

(function () {
  'use strict';

  AirminalPlatform.init({
    platform: 'teams',

    selectors: {
      chatPanel:       '[data-tid="message-pane-list"], .ts-message-list-container, [data-tid="chat-pane"]',
      messageRow:      '[data-tid="chat-pane-message"], .ts-message, [data-tid^="message-"]',
      messageText:     '[data-tid="chat-pane-message"] .message-body-content, .ts-message-list-item .message-body div[role="document"], div[data-tid="messageBodyContent"]',
      messageIncoming: '',
      messageOutgoing: '',
      chatHeader:      '[data-tid="chat-header-title"], .ts-channel-header-title, [data-tid="conversation-title"]',
      activeChat:      '[data-tid="chat-header"], .ts-channel-header',
      composer:        '[data-tid="ckeditor"] [contenteditable="true"], div[role="textbox"][contenteditable="true"][data-tid="newMessageEditor"], [data-tid="messageEditor"] [contenteditable="true"]',
      sendButton:      '[data-tid="newMessageCommands-send"], button[name="send"], [data-tid="sendMessageButton"]',
      footer:          '[data-tid="messageEditor"], .ts-new-message, [data-tid="bottom-compose"]',
    },

    hooks: {
      getMessageId(msgEl) {
        const tid = msgEl.getAttribute('data-tid')
                 || msgEl.getAttribute('data-mid')
                 || msgEl.closest('[data-tid^="message-"]')?.getAttribute('data-tid');
        if (tid) return 'teams_' + tid;

        // Fallback: use message timestamp
        const time = msgEl.querySelector('time, [data-tid="messageTimeStamp"]');
        const ts = time?.getAttribute('datetime') || time?.textContent || '';
        const text = msgEl.querySelector('.message-body-content, div[data-tid="messageBodyContent"]')?.textContent || '';
        return 'teams_' + hashString(ts + text.substring(0, 80));
      },

      isIncoming(msgEl) {
        // Teams marks own messages with specific classes or data attributes
        const msg = msgEl.closest('[data-tid="chat-pane-message"]') || msgEl;

        // Check data-is-self or similar attributes
        const isSelf = msg.getAttribute('data-is-from-me')
                    || msg.getAttribute('data-from-me');
        if (isSelf === 'true') return false;

        // Check for "currentUser" class patterns
        const cls = msg.className || '';
        if (cls.includes('from-me') || cls.includes('currentUser') || cls.includes('is-from-me')) return false;

        // Check sender name against current user
        const senderEl = msg.querySelector('[data-tid="message-author-name"], .ts-message-list-item__header .name');
        if (senderEl) {
          const currentUser = getCurrentUserName();
          if (currentUser && senderEl.textContent.trim().toLowerCase() === currentUser.toLowerCase()) return false;
        }

        return true;
      },

      extractText(msgEl) {
        const el = msgEl.querySelector('.message-body-content')
                || msgEl.querySelector('div[data-tid="messageBodyContent"]')
                || msgEl.querySelector('div[role="document"]')
                || msgEl.querySelector('.message-body div p');
        if (el) return el.textContent?.trim();

        // Fallback: get all paragraphs in message body
        const body = msgEl.querySelector('.message-body, [data-tid="messageBody"]');
        if (body) {
          const ps = body.querySelectorAll('p, div[role="document"]');
          return [...ps].map(p => p.textContent.trim()).filter(Boolean).join('\n') || null;
        }
        return null;
      },

      extractSender(msgEl) {
        const el = msgEl.querySelector('[data-tid="message-author-name"]')
                || msgEl.querySelector('.ts-message-list-item__header .name')
                || msgEl.querySelector('.message-author');
        return el ? el.textContent.trim() : '';
      },

      getChatName() {
        const el = document.querySelector('[data-tid="chat-header-title"]')
                || document.querySelector('.ts-channel-header-title')
                || document.querySelector('[data-tid="conversation-title"]');
        return el ? el.textContent.trim() : 'Unknown';
      },

      getChatId() {
        // Teams URL sometimes contains thread/conversation ID
        const match = window.location.href.match(/conversations\/([^?&/]+)/);
        if (match) return 'teams_' + match[1];

        const threadId = document.querySelector('[data-tid="chat-pane"]')?.getAttribute('data-convid')
                      || document.querySelector('[data-tid="message-pane-list"]')?.getAttribute('data-convid');
        if (threadId) return 'teams_' + threadId;

        return this.getChatName();
      },

      getComposer() {
        return document.querySelector('[data-tid="ckeditor"] [contenteditable="true"]')
            || document.querySelector('div[role="textbox"][contenteditable="true"][data-tid="newMessageEditor"]')
            || document.querySelector('[data-tid="messageEditor"] [contenteditable="true"]')
            || document.querySelector('div[contenteditable="true"][aria-label*="message"]');
      },

      clickSend() {
        const btn = document.querySelector('[data-tid="newMessageCommands-send"]')
                 || document.querySelector('button[name="send"]')
                 || document.querySelector('[data-tid="sendMessageButton"]');
        if (btn && !btn.disabled) { btn.click(); return; }

        // Teams also supports Ctrl+Enter or Enter depending on settings
        const composer = this.getComposer();
        if (composer) {
          composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        }
      },
    },
  });

  function getCurrentUserName() {
    // Try getting from the profile/me button
    const me = document.querySelector('[data-tid="me-control"] span, #personDropdown span, [data-tid="app-header-profile"] span');
    return me ? me.textContent.trim() : null;
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return Math.abs(hash).toString(36);
  }

})();
