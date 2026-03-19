# RRL Catalyst — Google Docs Extension Prototype

## Project Structure

```
rrl-catalyst/
├── app.py                  ← Flask entry point (run this in PyCharm)
├── requirements.txt        ← Python dependencies
├── README.md
├── templates/
│   └── index.html          ← Main HTML template
└── static/
    ├── css/
    │   └── style.css       ← All styles (Google Docs aesthetic)
    └── js/
        ├── api.js          ← Anthropic API calls (discovery + grounding)
        ├── discovery.js    ← Step 1: source search & render
        ├── grounding.js    ← Step 3: paste & analyze
        ├── panel.js        ← Sidebar panel state & step indicator
        ├── highlight.js    ← Float button, claim lock, doc marks
        ├── render.js       ← Results rendering (badges, scores, POI)
        └── utils.js        ← Shared helpers (escHtml, showToast, etc.)
```

## Setup in PyCharm

1. Open PyCharm → **File → Open** → select the `rrl-catalyst` folder
2. Open terminal inside PyCharm and run:
   ```
   pip install -r requirements.txt
   ```
3. Right-click `app.py` → **Run 'app'**
4. Open browser at `http://127.0.0.1:5000`

## How to Use

1. **Highlight** any sentence in the document
2. Click **"Verify with RRL Catalyst"** floating button
3. **Browse** the discovered sources (real open-access papers)
4. **Select** a source → click "Use Selected Source"
5. Open the PDF link → **Ctrl+A → Copy → Paste** the text
6. Click **▶ Analyze**
7. Review **Verification**, **Source View** (highlighted), and **Synthesis** tabs

## Notes

- The Anthropic API key is handled by the browser (no key stored in Python)
- All source links are real, open-access academic papers
- The 5-Year Recency Rule (2021–2026) is enforced in the credibility score
- Works for ANY academic field — AI, Nursing, Law, STEM, Humanities
