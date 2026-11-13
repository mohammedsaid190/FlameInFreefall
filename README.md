# Flame in Freefall

Team Galaxy Exploration · NASA Space Apps Challenge 2026 · Port Said

A dashboard that **summarizes, ranks and interprets** NASA microgravity combustion research for fire safety on the Moon and Mars.

## Open it
Double-click `index.html`, or host the folder on GitHub Pages (Settings → Pages → deploy from branch).
No build step. Plain HTML, CSS and JavaScript.

## Files
| File | What it does |
|---|---|
| `index.html` | Page structure |
| `css/style.css` | Design and animations |
| `js/data.js` | **All NASA facts**: experiments, FlameBot Q&A, glossary, sources. Edit content here. |
| `js/main.js` | Starfield, scroll reveals, cards, filters, table sorting, risk meter |
| `js/bot.js` | FlameBot: keyword retrieval + Chrome built-in AI (Gemini Nano) |

## FlameBot
- Uses Chrome's on-device AI when it's available. The status under its name shows which mode is active.
- If the AI isn't available, keyword search over `data.js` still answers. The bot always responds.
- To add a question, add an entry to `QA` in `js/data.js` (question, answer, keywords, source).
- Console test: `FlameBot.retrieve("why is a flame round")`

## Before the demo
- [ ] Test on the demo laptop in **Google Chrome**, both opened as a file and hosted online
- [ ] Ask one question at home so the AI model downloads
- [ ] Turn Wi-Fi OFF and check the bot still answers
- [ ] Check all source links in an incognito window
