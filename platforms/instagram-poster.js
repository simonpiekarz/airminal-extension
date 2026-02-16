/**
 * Airminal Agent Bridge — Instagram Auto-Poster
 * 
 * Handles automated posting on instagram.com
 * This script is injected on all instagram.com pages (not just /direct/).
 * 
 * Flow:
 *   1. Background sends SCHEDULED_POST message with { caption, imageUrl }
 *   2. This script clicks "Create" → uploads image → adds caption → posts
 * 
 * Instagram Web posting flow (desktop):
 *   - Click "+" or "Create" in the sidebar
 *   - "Create new post" modal opens
 *   - Drag/drop or select image
 *   - Click Next → Next → Add caption → Share
 */

(function () {
  'use strict';

  function log(...args) { console.log('[Airminal IG-Poster]', ...args); }

  // Listen for posting commands from background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SCHEDULED_POST' && msg.platform === 'instagram_post') {
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

  // ═══════════════════════════════════════
  // Main posting flow
  // ═══════════════════════════════════════

  async function handleScheduledPost(msg) {
    const { caption, imageUrl } = msg;

    if (!caption && !imageUrl) {
      return { success: false, error: 'No caption or image provided' };
    }

    try {
      // Step 1: Download image if URL provided
      let imageBlob = null;
      if (imageUrl) {
        log('Downloading image:', imageUrl);
        imageBlob = await downloadImage(imageUrl);
        if (!imageBlob) {
          return { success: false, error: 'Failed to download image' };
        }
        log('Image downloaded, size:', imageBlob.size);
      }

      // Step 2: Open the Create Post modal
      log('Opening Create Post modal...');
      const createOpened = await openCreatePostModal();
      if (!createOpened) {
        return { success: false, error: 'Could not open Create Post modal' };
      }

      // Step 3: Upload image
      if (imageBlob) {
        log('Uploading image...');
        const uploaded = await uploadImage(imageBlob);
        if (!uploaded) {
          return { success: false, error: 'Failed to upload image' };
        }
        log('Image uploaded');
      }

      // Step 4: Navigate through the "Next" steps
      log('Navigating through steps...');
      await clickNextButtons();

      // Step 5: Add caption
      if (caption) {
        log('Adding caption...');
        const captioned = await addCaption(caption);
        if (!captioned) {
          log('Caption field not found, trying alternate method...');
        }
      }

      // Step 6: Click Share/Post
      log('Sharing post...');
      const shared = await clickShare();
      if (!shared) {
        return { success: false, error: 'Could not find Share button' };
      }

      // Wait for posting to complete
      await sleep(3000);

      log('✓ Post published!');
      return { success: true, message: 'Post published' };

    } catch (err) {
      log('✗ Error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ═══════════════════════════════════════
  // Step 1: Download image from URL
  // ═══════════════════════════════════════

  async function downloadImage(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      // Ensure it's an image type
      if (!blob.type.startsWith('image/')) {
        log('Warning: downloaded file is not an image:', blob.type);
      }
      return blob;
    } catch (err) {
      log('Image download failed:', err.message);
      // Try via background fetch as fallback
      return null;
    }
  }

  // ═══════════════════════════════════════
  // Step 2: Open Create Post modal
  // ═══════════════════════════════════════

  async function openCreatePostModal() {
    // Strategy 1: Click "Create" or "+" button in sidebar
    const createSelectors = [
      // New post button in sidebar (various Instagram versions)
      'svg[aria-label="New post"]',
      '[aria-label="New post"]',
      'a[href="/create/style/"]',
      'a[href="/create/select/"]',
      // The "+" icon or "Create" text link
      'span:has(svg[aria-label="New post"])',
      '[role="link"][tabindex="0"] svg[aria-label="New post"]',
      // Sidebar navigation items
      'a[href*="create"]',
    ];

    for (const sel of createSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const clickTarget = el.closest('a') || el.closest('[role="link"]') || el.closest('[role="button"]') || el;
        clickTarget.click();
        log('Clicked create button via:', sel);
        await sleep(2000);

        // Check if modal opened
        const modal = await waitForEl(
          '[role="dialog"], [class*="modal"], [class*="creation"]',
          5000
        );
        if (modal) {
          log('Create modal opened');
          return true;
        }
      }
    }

    // Strategy 2: Navigate directly to create URL
    log('Trying direct navigation to /create/select/');
    window.location.href = 'https://www.instagram.com/create/select/';
    await sleep(3000);

    const modal = await waitForEl('[role="dialog"], [class*="modal"]', 5000);
    return !!modal;
  }

  // ═══════════════════════════════════════
  // Step 3: Upload image to the modal
  // ═══════════════════════════════════════

  async function uploadImage(blob) {
    // Instagram's create modal has a hidden file input
    // Strategy 1: Find existing file input
    let fileInput = document.querySelector('input[type="file"][accept*="image"]')
                 || document.querySelector('input[type="file"]');

    if (!fileInput) {
      // Strategy 2: Click "Select from computer" button which reveals the input
      const selectBtn = await findByText('Select from computer')
                     || await findByText('Select From Computer')
                     || await findByText('Select from device')
                     || document.querySelector('button:has(+ input[type="file"])')
                     || document.querySelector('[role="dialog"] button');

      if (selectBtn) {
        log('Clicking "Select from computer"');
        selectBtn.click();
        await sleep(1000);
        fileInput = document.querySelector('input[type="file"][accept*="image"]')
                 || document.querySelector('input[type="file"]');
      }
    }

    if (!fileInput) {
      // Strategy 3: Create our own file input and inject
      log('Creating synthetic file input');
      fileInput = document.querySelector('form input[type="file"]');
    }

    if (!fileInput) {
      log('✗ No file input found anywhere');
      return false;
    }

    // Create a File object from the blob
    const fileName = 'airminal_post_' + Date.now() + '.jpg';
    const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

    // Set files on the input using DataTransfer
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    // Dispatch change event
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));

    log('File set on input, waiting for processing...');
    await sleep(3000);

    return true;
  }

  // ═══════════════════════════════════════
  // Step 4: Click Next buttons
  // ═══════════════════════════════════════

  async function clickNextButtons() {
    // Instagram's create flow: Select → Filter/Edit (Next) → Caption (Next)
    // We need to click "Next" twice to get to the caption screen

    for (let i = 0; i < 3; i++) {
      await sleep(1500);

      const nextBtn = await findByText('Next')
                   || document.querySelector('[role="dialog"] button:last-child')
                   || document.querySelector('div[role="button"]:has(div:only-child)');

      if (nextBtn) {
        log(`Clicking Next (step ${i + 1})`);
        nextBtn.click();
        await sleep(1500);
      } else {
        log(`No "Next" found at step ${i + 1}, might already be at caption`);
        break;
      }

      // Check if we've reached the caption screen
      const captionArea = document.querySelector(
        'textarea[aria-label*="caption"], ' +
        'textarea[aria-label*="Write a caption"], ' +
        'div[aria-label*="Write a caption"][contenteditable="true"], ' +
        '[role="dialog"] textarea, ' +
        '[role="dialog"] [contenteditable="true"][role="textbox"]'
      );
      if (captionArea) {
        log('Caption screen reached');
        break;
      }
    }
  }

  // ═══════════════════════════════════════
  // Step 5: Add caption
  // ═══════════════════════════════════════

  async function addCaption(caption) {
    const captionSelectors = [
      'textarea[aria-label*="caption"]',
      'textarea[aria-label*="Write a caption"]',
      'div[aria-label*="Write a caption"][contenteditable="true"]',
      '[role="dialog"] textarea',
      '[role="dialog"] [contenteditable="true"][role="textbox"]',
      '[role="dialog"] div[contenteditable="true"]',
    ];

    let captionEl = null;
    for (const sel of captionSelectors) {
      captionEl = document.querySelector(sel);
      if (captionEl) {
        log('Caption field found via:', sel);
        break;
      }
    }

    if (!captionEl) {
      // Wait a bit more for it to appear
      captionEl = await waitForEl(captionSelectors.join(', '), 5000);
    }

    if (!captionEl) {
      log('✗ Caption field not found');
      return false;
    }

    captionEl.focus();
    await sleep(200);

    if (captionEl.tagName === 'TEXTAREA') {
      // For textarea elements
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ).set;
      nativeSetter.call(captionEl, caption);
      captionEl.dispatchEvent(new Event('input', { bubbles: true }));
      captionEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // For contenteditable divs
      captionEl.textContent = '';
      document.execCommand('insertText', false, caption);
      captionEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: caption }));
    }

    await sleep(500);
    log('Caption added:', caption.substring(0, 60) + '...');
    return true;
  }

  // ═══════════════════════════════════════
  // Step 6: Click Share
  // ═══════════════════════════════════════

  async function clickShare() {
    const shareBtn = await findByText('Share')
                  || await findByText('Post')
                  || await findByText('Publish');

    if (shareBtn) {
      log('Clicking Share/Post');
      shareBtn.click();
      await sleep(2000);

      // Check for success indicators
      const success = await waitForEl(
        '[aria-label="Your post has been shared"], ' +
        '[class*="success"], ' +
        '[role="dialog"]:has(svg[aria-label*="checkmark"])',
        10000
      );

      if (success) {
        log('✓ Post confirmed shared');
      } else {
        log('Share clicked, waiting for completion...');
        await sleep(5000);
      }

      return true;
    }

    log('✗ Share/Post button not found');
    return false;
  }

  // ═══════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════

  async function findByText(text) {
    // Search all buttons and clickable elements for matching text
    const candidates = [
      ...document.querySelectorAll('button'),
      ...document.querySelectorAll('[role="button"]'),
      ...document.querySelectorAll('div[tabindex="0"]'),
    ];

    for (const el of candidates) {
      const elText = el.textContent?.trim();
      if (elText === text) return el;
    }

    // Also check within dialogs
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      const innerCandidates = [
        ...dialog.querySelectorAll('button'),
        ...dialog.querySelectorAll('[role="button"]'),
        ...dialog.querySelectorAll('div[tabindex="0"]'),
      ];
      for (const el of innerCandidates) {
        if (el.textContent?.trim() === text) return el;
      }
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
