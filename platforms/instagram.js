/**
 * Airminal Agent Bridge — Instagram DM Platform
 * 
 * Platform-specific selectors and hooks for www.instagram.com/direct/
 * Instagram DMs use React with similar patterns to Messenger
 */

(function () {
  'use strict';

  AirminalPlatform.init({
    platform: 'instagram',

    selectors: {
      chatPanel:       'main, [role="main"]',
      messageRow:      'div[role="row"], div[class*="message"]',
      messageText:     'div[dir="auto"] span, div[dir="auto"]',
      messageIncoming: '',
      messageOutgoing: '',
      chatHeader:      'main header a[href*="/"] span, main header div[role="button"] span',
      activeChat:      'main header',
      composer:        'div[role="textbox"][contenteditable="true"], textarea[placeholder*="Message"], div[aria-label*="Message"][contenteditable="true"]',
      sendButton:      'button[type="submit"], div[role="button"]:has(svg)',
      footer:          'main footer, form, section:last-child',
    },

    hooks: {
      getMessageId(msgEl) {
        const text = msgEl.querySelector('div[dir="auto"]')?.textContent || '';
        const parent = msgEl.closest('[class]')?.className || '';
        return 'ig_' + hashString(text + parent);
      },

      isIncoming(msgEl) {
        // Instagram DMs: outgoing messages are typically on the right, with specific styling
        const row = msgEl.closest('div[role="row"]') || msgEl;
        const style = window.getComputedStyle(row);
        
        // Check flex direction / alignment
        if (style.justifyContent === 'flex-end') return false;
        if (style.flexDirection === 'row-reverse') return false;

        // Check if the message container has a colored (blue) background = outgoing
        const bubbles = msgEl.querySelectorAll('div[style*="background"]');
        for (const b of bubbles) {
          const bg = window.getComputedStyle(b).backgroundColor;
          // Instagram blue for outgoing: rgb(0, 149, 246) or similar
          if (bg && bg.includes('0, 149, 246') || bg.includes('0,149,246')) return false;
          if (bg && bg.includes('59, 130, 246') || bg.includes('59,130,246')) return false;
        }

        // Check aria-label
        const aria = msgEl.getAttribute('aria-label') || msgEl.closest('[aria-label]')?.getAttribute('aria-label') || '';
        if (aria.toLowerCase().includes('you sent') || aria.toLowerCase().includes('your message')) return false;

        return true;
      },

      extractText(msgEl) {
        // Instagram wraps text in nested spans inside dir="auto" divs
        const el = msgEl.querySelector('div[dir="auto"] span')
                || msgEl.querySelector('div[dir="auto"]')
                || msgEl.querySelector('span[dir="auto"]');
        return el ? el.textContent?.trim() : null;
      },

      extractSender(msgEl) {
        // Instagram shows sender avatars/names in group chats
        const nameEl = msgEl.querySelector('span[dir="auto"]');
        return nameEl ? nameEl.textContent.trim() : '';
      },

      getChatName() {
        // Instagram shows the other person's name in the header
        const el = document.querySelector('main header a[href*="/"] span')
                || document.querySelector('main header div[role="button"] span')
                || document.querySelector('main header span');
        return el ? el.textContent.trim() : 'Unknown';
      },

      getChatId() {
        // Try to get thread ID from URL
        const match = window.location.pathname.match(/\/direct\/t\/(\d+)/);
        if (match) return 'ig_' + match[1];
        return this.getChatName();
      },

      getComposer() {
        return document.querySelector('div[role="textbox"][contenteditable="true"]')
            || document.querySelector('textarea[placeholder*="Message"]')
            || document.querySelector('div[aria-label*="Message"][contenteditable="true"]');
      },

      clickSend() {
        // Instagram's send button is often a div[role="button"] or button[type="submit"]
        const btn = document.querySelector('button[type="submit"]');
        if (btn && !btn.disabled) { btn.click(); return; }
        
        // Fallback: press Enter
        const composer = document.querySelector('div[role="textbox"][contenteditable="true"]');
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
