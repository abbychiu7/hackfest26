# Verifai - Google Docs RRL Plugin

## Project Structure

```
verifai/
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

## Tech Stack

### Backend
| Component | Technology |
|-----------|-----------|
| Web framework | **Flask** 3.0.3 (Python) |
| LLM | **Google Gemini 2.5 Flash** (`gemini-2.5-flash`) via `google-genai` 1.47.0 |
| Paper metadata & DOI lookup | **CrossRef API** (`api.crossref.org/works`) |
| Fallback paper search | **Google Scholar** (URL-based search) |
| Environment variables | `python-dotenv` 1.1.1 |
| HTTP requests | Python `requests` |
| Parallelism | `concurrent.futures.ThreadPoolExecutor` |

### Frontend
| Component | Technology |
|-----------|-----------|
| UI shell | **Vanilla HTML + CSS + JavaScript** (no frameworks) |
| Typography | **Google Fonts** — Google Sans, Poppins, Google Sans Mono |
| Design language | **Google Material Design 3** / Google Docs aesthetic |
| JS modules | `api.js`, `discovery.js`, `grounding.js`, `panel.js`, `highlight.js`, `render.js`, `utils.js` |

### APIs & External Services
| Service | Purpose |
|---------|---------|
| **Gemini API** (Google AI Studio) | JSON-mode paper discovery + claim verification/grounding |
| **CrossRef API** | Authoritative DOI resolution, verified author lists, canonical titles |
| **Google Scholar** (fallback) | Search URL fallback when CrossRef has no DOI match |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Language | **Python 3** |
| Server | Flask dev server (local), WSGI-compatible for production |
| API key management | `.env` file + `.gitignore` (key never exposed to the browser) |
| IDE config | VS Code (`.vscode/settings.json` auto-loads `.env` into terminal) |

## Setup & API Integration

This project uses the **Google Gemini API** for semantic search and claim verification. To keep your API key secure, it is stored locally in a `.env` file and processed server-side through Flask.

### 1. Configure the API Key

1. Get your free API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Inside the `verifai` folder, create a new file named `.env`.
   *(You can also copy `.env.example` and rename it to `.env`)*.
3. Add your Gemini API key to the `.env` file:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```
   *Note: `app.py` reads this file using `python-dotenv`. Because `.env` is listed in `.gitignore`, your API key will **never** be committed to Git.*

### 2. Run the Application Local

1. Open your terminal (or VS Code / PyCharm terminal) inside the `verifai` folder.
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

## Notes & Search Protocol

- **API Security**: The frontend (`api.js`) sends prompts to the Flask backend (`/api/gemini`), which then securely communicates with the Gemini API. Your API key is never exposed to the browser.
- **Model Used**: Currently using `gemini-2.5-flash` with internal reasoning (thinking budget) disabled to guarantee maximum output tokens for strict JSON extraction.
- **Source Verification**: Papers hallucinated by the LLM are discarded. Verifai queries the **CrossRef API** (`api.crossref.org/works`) in parallel to fetch authoritative DOIs, verify titles, and overwrite any confabulated author lists with official publication metadata.

**Strict Search Conditions Enforced:**
1. **Recency**: Only papers published from 2021 onwards (within 5 years of the 2026 current year).
2. **Reputable Databases**: Only peer-reviewed sources (e.g. PubMed, ERIC, JSTOR, IEEE Xplore, Google Scholar, ResearchGate).
3. **Open Access Preferred**: Strong priority given to open-access papers (PubMed Central, arXiv, DOAJ, PLoS, Frontiers, MDPI) unless only a subscription article exists for the niche topic.
4. **Verbatim Metadata**: LLM is instructed to strictly copy the character-for-character title as published, supplemented by CrossRef validation.
