/**
 * Airminal Agent Bridge — X/Twitter Auto-Poster
 * 
 * Handles automated posting on x.com
 * Injected on all x.com pages.
 * 
 * Flow:
 *   1. Background sends SCHEDULED_POST with { caption, imageUrl }
 *   2. This script opens compose, types text, optionally uploads image, clicks Post
 */

(function () {
  'use strict';

  function log(...args) { console.log('[Airminal X-Poster]', ...args); }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SCHEDULED_POST' && msg.platform === 'x_post') {
      log('Received post command:', msg);
      handleScheduledPost(msg).then(sendResponse);
      return true;
    }
    if (msg.type === 'SCHEDULED_POST_STATUS') {
      sendResponse({ ready: true, url: window.location.href });
      return false;
    }
  });

  log('Auto-poster loaded on', window.location.href);

  async function handleScheduledPost(msg) {
    const { caption, imageUrl } = msg;

    if (!caption && !imageUrl) {
      return { success: false, error: 'No caption or image provided' };
    }

    try {
      // Step 1: Open compose modal
      log('Opening compose...');
      const opened = await openCompose();
      if (!opened) {
        return { success: false, error: 'Could not open compose modal' };
      }

      // Step 2: Upload image if provided
      if (imageUrl) {
        log('Downloading image...');
        const blob = await downloadImage(imageUrl);
        if (blob) {
          log('Uploading image...');
          await uploadImage(blob);
        } else {
          log('Image download failed, posting text only');
        }
      }

      // Step 3: Type the caption/tweet text
      if (caption) {
        log('Typing text...');
        await typeText(caption);
      }

      // Step 4: Click Post
      log('Clicking Post...');
      await sleep(1000);
      const posted = await clickPost();
      if (!posted) {
        return { success: false, error: 'Could not find Post button' };
      }

      await sleep(3000);
      log('✓ Posted!');
      return { success: true, message: 'Posted to X' };

    } catch (err) {
      log('✗ Error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async function openCompose() {
    // Strategy 1: Click the compose/post button
    const composeSelectors = [
      'a[href="/compose/post"]',
      'a[href="/compose/tweet"]',
      '[data-testid="SideNav_NewTweet_Button"]',
      '[aria-label="Post"]',
      '[aria-label="Compose post"]',
      '[aria-label="Tweet"]',
    ];

    for (const sel of composeSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        el.click();
        log('Clicked compose via:', sel);
        await sleep(2000);
        const editor = await waitForEl(
          '[data-testid="tweetTextarea_0"], [role="textbox"][data-testid="tweetTextarea_0"], div[contenteditable="true"][role="textbox"]',
          5000
        );
        if (editor) return true;
      }
    }

    // Strategy 2: Navigate to compose URL
    log('Navigating to /compose/post');
    window.location.href = 'https://x.com/compose/post';
    await sleep(3000);
    const editor = await waitForEl('[data-testid="tweetTextarea_0"], div[contenteditable="true"][role="textbox"]', 5000);
    return !!editor;
  }

  async function typeText(text) {
    const editor = document.querySelector('[data-testid="tweetTextarea_0"]')
                || document.querySelector('div[contenteditable="true"][role="textbox"]')
                || document.querySelector('[data-testid="tweetTextarea_0"] [contenteditable="true"]');

    if (!editor) {
      log('✗ Editor not found');
      return false;
    }

    editor.focus();
    await sleep(200);

    // Clear any placeholder
    editor.textContent = '';
    await sleep(100);

    // Type using execCommand for React compatibility
    document.execCommand('insertText', false, text);
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    await sleep(300);

    log('Text typed:', text.substring(0, 60) + '...');
    return true;
  }

  async function uploadImage(blob) {
    // X has a file input for media uploads
    let fileInput = document.querySelector('input[type="file"][accept*="image"]')
                 || document.querySelector('input[type="file"][data-testid="fileInput"]')
                 || document.querySelector('input[type="file"]');

    if (!fileInput) {
      // Click media button to reveal file input
      const mediaBtn = document.querySelector('[data-testid="fileInput"]')?.closest('div')
                    || document.querySelector('[aria-label="Add photos or video"]')
                    || document.querySelector('[data-testid="attachments"]');
      if (mediaBtn) {
        mediaBtn.click();
        await sleep(1000);
        fileInput = document.querySelector('input[type="file"]');
      }
    }

    if (!fileInput) {
      log('✗ File input not found');
      return false;
    }

    const file = new File([blob], 'post_' + Date.now() + '.jpg', { type: blob.type || 'image/jpeg' });
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));

    log('Image uploaded');
    await sleep(3000);
    return true;
  }

  async function clickPost() {
    const postBtn = document.querySelector('[data-testid="tweetButton"]')
                 || document.querySelector('[data-testid="tweetButtonInline"]')
                 || await findByText('Post')
                 || await findByText('Tweet');

    if (postBtn && !postBtn.disabled && !postBtn.getAttribute('aria-disabled')) {
      postBtn.click();
      return true;
    }

    log('✗ Post button not found or disabled');
    return false;
  }

  async function downloadImage(url) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.blob();
    } catch (err) {
      log('Image download failed:', err.message);
      return null;
    }
  }

  async function findByText(text) {
    const els = [...document.querySelectorAll('button, [role="button"], span')];
    for (const el of els) {
      if (el.textContent?.trim() === text) return el.closest('button') || el.closest('[role="button"]') || el;
    }
    return null;
  }

  function waitForEl(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const sels = selector.split(',').map(s => s.trim());
      const check = () => { for (const s of sels) { const el = document.querySelector(s); if (el) return el; } return null; };
      const existing = check();
      if (existing) return resolve(existing);
      const obs = new MutationObserver(() => { const el = check(); if (el) { obs.disconnect(); resolve(el); } });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(check()); }, timeout);
    });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

})();
