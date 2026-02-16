/**
 * Airminal Agent Bridge — Discord Platform
 * 
 * Platform-specific selectors and hooks for discord.com/channels
 * Discord uses React with id prefixes and aria labels
 */

(function () {
  'use strict';

  AirminalPlatform.init({
    platform: 'discord',

    selectors: {
      chatPanel:       '[class*="chatContent"], [data-list-id="chat-messages"], main[class*="chatContent"]',
      messageRow:      '[id^="chat-messages-"], li[id^="chat-messages-"], [class*="messageListItem"]',
      messageText:     '[id^="message-content-"], [class*="messageContent"], div[class*="markup"]',
      messageIncoming: '',
      messageOutgoing: '',
      chatHeader:      'h1[class*="title"], [class*="channelName"], [data-text-variant="heading-lg/semibold"]',
      activeChat:      'section[class*="title"], header[class*="header"]',
      composer:        '[role="textbox"][data-slate-editor="true"], div[class*="slateTextArea"] [contenteditable="true"], [aria-label*="Message"]',
      sendButton:      '',  // Discord sends on Enter, no send button
      footer:          'form[class*="form"], [class*="channelTextArea"]',
    },

    hooks: {
      getMessageId(msgEl) {
        // Discord uses chat-messages-{snowflake} as IDs
        const id = msgEl.id || msgEl.closest('[id^="chat-messages-"]')?.id;
        if (id) return 'dc_' + id;

        const content = msgEl.querySelector('[id^="message-content-"]');
        if (content?.id) return 'dc_' + content.id;

        return 'dc_' + hashString(msgEl.textContent?.substring(0, 100) || '');
      },

      isIncoming(msgEl) {
        // Discord doesn't align messages left/right — all messages look the same
        // We detect "own" messages by matching the sender to current user
        const senderEl = msgEl.querySelector('[class*="username"], [id^="message-username-"]')
                      || msgEl.closest('[id^="chat-messages-"]')?.querySelector('[class*="username"]');

        if (!senderEl) {
          // Could be a grouped message (continuation) — check parent group
          const group = msgEl.closest('[class*="groupStart"]');
          if (group) {
            const groupSender = group.querySelector('[class*="username"]');
            if (groupSender) return !isCurrentUser(groupSender.textContent.trim());
          }
          return true; // Default incoming if can't determine
        }

        return !isCurrentUser(senderEl.textContent.trim());
      },

      extractText(msgEl) {
        const el = msgEl.querySelector('[id^="message-content-"]')
                || msgEl.querySelector('[class*="messageContent"]')
                || msgEl.querySelector('div[class*="markup"]');
        if (el) return el.textContent?.trim();
        return null;
      },

      extractSender(msgEl) {
        const el = msgEl.querySelector('[class*="username"], [id^="message-username-"]')
                || msgEl.closest('[id^="chat-messages-"]')?.querySelector('[class*="username"]');
        return el ? el.textContent.trim() : '';
      },

      getChatName() {
        const el = document.querySelector('h1[class*="title"]')
                || document.querySelector('[class*="channelName"]')
                || document.querySelector('[data-text-variant="heading-lg/semibold"]');
        return el ? el.textContent.trim() : 'Unknown';
      },

      getChatId() {
        // Discord URL: /channels/{guild}/{channel}
        const match = window.location.pathname.match(/\/channels\/(\d+|@me)\/(\d+)/);
        if (match) return 'dc_' + match[1] + '_' + match[2];
        return this.getChatName();
      },

      getComposer() {
        return document.querySelector('[role="textbox"][data-slate-editor="true"]')
            || document.querySelector('div[class*="slateTextArea"] [contenteditable="true"]')
            || document.querySelector('[aria-label*="Message"][contenteditable="true"]');
      },

      clickSend() {
        // Discord sends on Enter (not Shift+Enter)
        const composer = this.getComposer();
        if (composer) {
          composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        }
      },
    },
  });

  // ── Detect current Discord user ──
  function isCurrentUser(name) {
    // Try getting current username from the bottom-left user panel
    const panel = document.querySelector('[class*="nameTag"], [class*="panelTitleContainer"] [class*="username"]');
    if (panel) {
      const currentName = panel.textContent.trim().replace(/#\d+$/, '').trim();
      if (currentName && name.toLowerCase() === currentName.toLowerCase()) return true;
    }

    // Check aria label on user area
    const userArea = document.querySelector('section[aria-label*="User area"], [class*="panels"] [class*="container"]');
    if (userArea) {
      const uname = userArea.querySelector('[class*="username"]')?.textContent?.trim();
      if (uname && name.toLowerCase() === uname.toLowerCase()) return true;
    }

    return false;
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return Math.abs(hash).toString(36);
  }

})();
