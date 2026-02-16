/**
 * Airminal Extension — LinkedIn Auto-Poster
 * 
 * Handles automated posting on linkedin.com
 * Injected on all linkedin.com pages.
 * 
 * Flow:
 *   1. Background sends SCHEDULED_POST with { caption, imageUrl }
 *   2. This script clicks "Start a post", types text, optionally uploads image, clicks Post
 */

(function () {
  'use strict';

  function log(...args) { console.log('[Airminal LI-Poster]', ...args); }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SCHEDULED_POST' && msg.platform === 'linkedin_post') {
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
      // Step 1: Open the post composer
      log('Opening composer...');
      const opened = await openComposer();
      if (!opened) {
        return { success: false, error: 'Could not open post composer' };
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

      // Step 3: Type the caption
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
      log('✓ Posted to LinkedIn!');
      return { success: true, message: 'Posted to LinkedIn' };

    } catch (err) {
      log('✗ Error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async function openComposer() {
    // Strategy 1: Click "Start a post" button on feed
    const startPostSelectors = [
      'button.share-box-feed-entry__trigger',
      '.share-box-feed-entry__trigger',
      'button[aria-label="Start a post"]',
      '[data-control-name="share.share_box_feed"]',
      // The "Start a post" input/button area at top of feed
      '.share-box__open',
      '.share-box-feed-entry__top-bar',
    ];

    for (const sel of startPostSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        el.click();
        log('Clicked start post via:', sel);
        await sleep(2000);

        const editor = await waitForEl(
          '.ql-editor[contenteditable="true"], ' +
          '[role="textbox"][aria-label*="post"], ' +
          '[role="textbox"][contenteditable="true"], ' +
          'div[data-placeholder="What do you want to talk about?"]',
          5000
        );
        if (editor) return true;
      }
    }

    // Strategy 2: Click on the text area directly
    const placeholder = document.querySelector('[data-placeholder="What do you want to talk about?"]')
                     || document.querySelector('.share-box-feed-entry__trigger--content');
    if (placeholder) {
      placeholder.click();
      await sleep(2000);
      const editor = await waitForEl('.ql-editor[contenteditable="true"], [role="textbox"][contenteditable="true"]', 5000);
      if (editor) return true;
    }

    // Strategy 3: Navigate to feed first
    if (!window.location.pathname.startsWith('/feed')) {
      log('Navigating to feed...');
      window.location.href = 'https://www.linkedin.com/feed/';
      await sleep(3000);
      // Try again
      const btn = document.querySelector('button.share-box-feed-entry__trigger, [aria-label="Start a post"]');
      if (btn) {
        btn.click();
        await sleep(2000);
        const editor = await waitForEl('.ql-editor[contenteditable="true"], [role="textbox"][contenteditable="true"]', 5000);
        return !!editor;
      }
    }

    return false;
  }

  async function typeText(text) {
    const editor = document.querySelector('.ql-editor[contenteditable="true"]')
                || document.querySelector('[role="textbox"][contenteditable="true"]')
                || document.querySelector('[role="textbox"][aria-label*="post"]')
                || document.querySelector('div[data-placeholder="What do you want to talk about?"]');

    if (!editor) {
      log('✗ Editor not found');
      return false;
    }

    editor.focus();
    await sleep(200);

    // Clear placeholder content
    if (editor.querySelector('.ql-placeholder, p[data-placeholder]')) {
      editor.innerHTML = '<p><br></p>';
    }
    editor.textContent = '';
    await sleep(100);

    // Type using execCommand for framework compatibility
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        document.execCommand('insertLineBreak', false, null);
        // Fallback
        if (!editor.innerHTML.includes('<br>')) {
          editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        }
        await sleep(30);
      }
      document.execCommand('insertText', false, lines[i]);
      await sleep(20);
    }

    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    await sleep(300);

    log('Text typed:', text.substring(0, 60) + '...');
    return true;
  }

  async function uploadImage(blob) {
    // LinkedIn has a media/image button that reveals a file input
    const mediaBtn = document.querySelector('[aria-label="Add a photo"]')
                  || document.querySelector('[aria-label="Add media"]')
                  || document.querySelector('button.image-sharing-detour-button')
                  || document.querySelector('.share-creation-state__detour-btn--image');

    if (mediaBtn) {
      mediaBtn.click();
      await sleep(1500);
    }

    let fileInput = document.querySelector('input[type="file"][accept*="image"]')
                 || document.querySelector('input[type="file"]');

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

    // Click "Done" or "Next" if image cropper appears
    const doneBtn = await findByText('Done') || await findByText('Next');
    if (doneBtn) {
      doneBtn.click();
      await sleep(1000);
    }

    return true;
  }

  async function clickPost() {
    const postBtn = document.querySelector('button.share-actions__primary-action')
                 || document.querySelector('[data-control-name="share.post"]')
                 || await findByText('Post')
                 || await findByText('Publish');

    if (postBtn && !postBtn.disabled) {
      postBtn.click();
      return true;
    }

    // Fallback: any primary button in the share dialog
    const primary = document.querySelector('.share-box_actions button.artdeco-button--primary:not([disabled])');
    if (primary) {
      primary.click();
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
