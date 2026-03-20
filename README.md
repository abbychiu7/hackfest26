# RRL Catalyst API Integration

## Project Structure

```
rrl-catalyst/
├── app.py                  ← Flask entry point (server-side proxy for Gemini API)
├── requirements.txt        ← Python dependencies
├── README.md               ← This file
├── .env.example            ← Template for local environment variables
├── .gitignore              ← Excludes sensitive files (e.g., .env)
├── .vscode/
│   └── settings.json       ← VS Code workspace settings (loads .env in terminals)
├── templates/
│   └── index.html          ← Main HTML template
└── static/
    ├── css/
    │   └── style.css       ← All styles (Google Docs aesthetic)
    └── js/
        ├── api.js          ← API routing (sends requests to Flask proxy)
        ├── discovery.js    ← Step 1: source search & render
        ├── grounding.js    ← Step 3: paste & analyze
        ├── panel.js        ← Sidebar panel state & step indicator
        ├── highlight.js    ← Float button, claim lock, doc marks
        ├── render.js       ← Results rendering (badges, scores, POI)
        └── utils.js        ← Shared helpers (escHtml, showToast, etc.)
```

## Setup & API Integration

This project uses the **Google Gemini API** for semantic search and claim verification. To keep your API key secure, it is stored locally in a `.env` file and processed server-side through Flask.

### 1. Configure the API Key

1. Get your free API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Inside the `rrl-catalyst` folder, create a new file named `.env`.
   *(You can also copy `.env.example` and rename it to `.env`)*.
3. Add your Gemini API key to the `.env` file:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```
   *Note: `app.py` reads this file using `python-dotenv`. Because `.env` is listed in `.gitignore`, your API key will **never** be committed to Git.*

### 2. Run the Application Local

1. Open your terminal (or VS Code / PyCharm terminal) inside the `rrl-catalyst` folder.
2. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the Flask server:
   ```bash
   python app.py
   # OR on some systems: py app.py
   ```
4. Open your web browser and navigate to `http://127.0.0.1:5000`.

## Notes

- **API Security**: The frontend (`api.js`) sends prompts to the Flask backend (`/api/gemini`), which then securely communicates with the Gemini API. Your API key is never exposed to the browser.
- **Model Used**: Currently using `gemini-2.5-flash` for high-speed semantic variable extraction and citation analysis.
- The 5-Year Recency Rule (2021–2026) is enforced in the credibility score.
- Works for ANY academic field — AI, Nursing, Law, STEM, Humanities.
