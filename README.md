# Airminal Extension

**Your AI agent inside every chat tab.**

A Chrome extension that injects your <a href='https://airminal.com'>airminal AI agent</a> directly into the messaging platforms you already use. Your agent reads incoming messages, generates replies, and types them back — all without leaving the browser tab.

[![Video](https://img.youtube.com/vi/LuypzB_vzPc/maxresdefault.jpg)](https://www.youtube.com/watch?v=LuypzB_vzPc)

## Supported Platforms

| Platform | Auto-Reply | Auto-Post |
|----------|-----------|-----------|
| WhatsApp Web | Yes | — |
| Facebook Messenger | Yes | — |
| Instagram DMs | Yes | Yes |
| Telegram Web | Yes | — |
| LinkedIn Messages | Yes | Yes |
| X / Twitter DMs | Yes | Yes |
| Slack | Yes | — |
| Discord | Yes | — |
| Microsoft Teams | Yes | — |
| Gmail | Yes | — |
| Outlook Web | Yes | — |
| OnlyFans | Yes | — |

**12 platforms, zero API tokens.** It works through your logged-in browser sessions using DOM injection — no bot accounts, no OAuth, no webhooks.

## How It Works

1. You provide an **agent endpoint** — any HTTP API that accepts a message and returns a reply
2. The extension injects a content script into each platform tab
3. When a new message arrives, the content script detects it and sends it to the background service worker
4. The service worker forwards it to your agent endpoint
5. The agent's reply is sent back and typed into the chat composer automatically

```
[WhatsApp Tab] ──→ [Content Script] ──→ [Background SW] ──→ [Your Agent API]
                                                          ←── reply
                   [Content Script] ←── type & send
```

## Install

1. Download or clone this repo
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select this folder
5. Click the extension icon in your toolbar
6. Enter your agent endpoint URL
7. Toggle on the master switch and enable your desired platforms
8. Open a supported platform tab — the agent badge appears in the bottom-right corner

## Features

- **Per-platform toggles** — enable/disable each platform independently
- **Per-platform endpoint overrides** — route different platforms to different agents
- **Allowed / blocked chat lists** — control exactly which conversations the agent responds to
- **Trigger prefix** — only respond to messages starting with a keyword (e.g. `/ai`)
- **Timestamp gate** — only processes messages that arrive after you enable the platform (no replying to old messages)
- **Session management** — maintains conversation history per chat
- **Auto-posting** — schedule automated posts on Instagram, LinkedIn, and X/Twitter
- **Typing indicator** — shows "Agent thinking..." while waiting for a reply
- **Status badge** — green dot when active, gray when idle

## Configuration

All settings are in the popup UI. Click the extension icon to access:

- **Agent Endpoint** — your API URL
- **Master Toggle** — on/off for the entire extension
- **Platform Toggles** — enable each platform individually
- **Reply Delay** — how long to wait before sending (feels more human)
- **System Prompt** — optional instructions sent with every request
- **Automations** — scheduled auto-posting with custom prompts and intervals

## File Structure

```
├── manifest.json            # Chrome extension manifest (V3)
├── background.js            # Service worker — sessions, API calls, scheduler
├── popup.html               # Settings UI
├── popup.js                 # Popup controller
├── platforms/
│   ├── platform-base.js     # Shared logic — message detection, reply injection
│   ├── whatsapp.js          # WhatsApp Web adapter
│   ├── messenger.js         # Facebook Messenger adapter
│   ├── instagram.js         # Instagram DMs adapter
│   ├── instagram-poster.js  # Instagram auto-poster
│   ├── telegram.js          # Telegram Web adapter
│   ├── linkedin.js          # LinkedIn Messages adapter
│   ├── linkedin-poster.js   # LinkedIn auto-poster
│   ├── x_twitter.js         # X/Twitter DMs adapter
│   ├── x-poster.js          # X/Twitter auto-poster
│   ├── slack.js             # Slack adapter
│   ├── discord.js           # Discord adapter
│   ├── teams.js             # Microsoft Teams adapter
│   ├── gmail.js             # Gmail adapter
│   ├── outlook.js           # Outlook Web adapter
│   └── of.js                # OnlyFans adapter
├── css/
│   └── overlay.css          # Injected styles (badge, typing indicator)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Limitations

- **DOM-dependent** — if a platform redesigns their UI, the selectors may break and need updating
- **Requires open tabs** — the agent only works on platforms you have open in Chrome
- **No background operation** — when Chrome is closed, nothing runs (see [Airminal Assistant](https://github.com/airminal/airminal-assistant) for a 24/7 standalone gateway)
- **Single browser** — works in one Chrome instance at a time

## Privacy

- All data stays in your browser — the extension only communicates with your own agent endpoint
- No analytics, no tracking, no data sent to third parties
- Conversation history is stored in Chrome's local storage and cleared when sessions expire

## License

MIT
