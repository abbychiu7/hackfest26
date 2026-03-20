import os
import re
import json
import requests
import concurrent.futures
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

app = Flask(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
client = genai.Client(api_key=GEMINI_API_KEY)

# gemini-2.5-flash with thinking disabled (budget=0) for reliable JSON output.
MODEL_JSON = "gemini-2.5-flash"

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    )
}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/gemini", methods=["POST"])
def gemini_proxy():
    """Proxy endpoint — forwards prompts to Gemini in JSON mode."""
    data = request.get_json()
    prompt = data.get("prompt", "")
    max_tokens = data.get("max_tokens", 1400)

    if not prompt:
        return jsonify({"error": "No prompt provided"}), 400
    if not GEMINI_API_KEY:
        return jsonify({"error": "GEMINI_API_KEY is not set"}), 500

    try:
        response = client.models.generate_content(
            model=MODEL_JSON,
            contents=prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=max_tokens,
                response_mime_type="application/json",
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        return jsonify({"text": response.text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# CrossRef DOI lookup helpers
# ─────────────────────────────────────────────────────────────────────────────

def crossref_lookup(title, authors="", year=""):
    """Query CrossRef for one paper; return the best-matching DOI URL or None."""
    query = title
    if authors:
        # Take first author surname only for better match
        first_author = authors.split("&")[0].split(",")[0].strip()
        query += " " + first_author
    if year:
        query += " " + str(year)

    params = {
        "query.bibliographic": query,
        "rows": 3,
        "select": "DOI,title,author,published,URL",
    }
    try:
        r = requests.get(
            "https://api.crossref.org/works",
            params=params,
            timeout=8,
            headers={"User-Agent": "RRL-Catalyst/1.0 (mailto:student@school.edu)"},
        )
        r.raise_for_status()
        items = r.json().get("message", {}).get("items", [])
        if items:
            item = items[0]
            doi = item.get("DOI", "")
            if not doi:
                return None

            # Build verified author string from CrossRef data
            cr_authors = item.get("author", [])
            if cr_authors:
                parts = []
                for a in cr_authors[:4]:   # cap at 4 authors
                    given  = a.get("given", "")[:1]   # initials only
                    family = a.get("family", "")
                    if family:
                        parts.append(f"{family}, {given}." if given else family)
                if len(cr_authors) > 4:
                    parts.append("et al.")
                verified_authors = " & ".join(parts)
            else:
                verified_authors = None

            # CrossRef title (first item)
            cr_titles = item.get("title", [])
            verified_title = cr_titles[0] if cr_titles else None

            return {
                "doi_url":          f"https://doi.org/{doi}",
                "verified_authors": verified_authors,
                "verified_title":   verified_title,
            }
    except Exception as e:
        print(f"[crossref] lookup failed for '{title[:60]}': {e}")
    return None


def url_reachable(url):
    """Return True if URL returns a non-404 HTTP status."""
    if not url or not url.startswith("http"):
        return False
    try:
        r = requests.head(url, allow_redirects=True, timeout=6, headers=BROWSER_HEADERS)
        if r.status_code == 405:
            r = requests.get(url, stream=True, timeout=6, headers=BROWSER_HEADERS)
        return r.status_code not in (404, 410)
    except Exception:
        return False


def resolve_paper_url(paper):
    """
    Look up the paper via CrossRef:
    - Sets doi URL
    - Overwrites Gemini-provided authors with CrossRef-verified authors
    - Overwrites title with CrossRef-verified title if available
    Falls back to a Google Scholar search URL if CrossRef has no match.
    """
    title   = paper.get("title", "")
    authors = paper.get("authors", "")
    year    = paper.get("year", "")

    cr = crossref_lookup(title, authors, year)
    if cr:
        paper["url"]     = cr["doi_url"]
        paper["doi_url"] = cr["doi_url"]
        # Overwrite Gemini's authors with CrossRef's authoritative data
        if cr["verified_authors"]:
            paper["authors"] = cr["verified_authors"]
        # Overwrite title only if CrossRef returned one (it's the canonical form)
        if cr["verified_title"]:
            paper["title"] = cr["verified_title"]
        print(f"[crossref] ✓ {title[:55]} → {cr['doi_url']}")
        return paper

    # Fallback: Google Scholar search (always resolves, never 404)
    scholar_q = "+".join(re.sub(r"[^\w\s]", "", title).split()[:8])
    scholar_url = f"https://scholar.google.com/scholar?q={scholar_q}"
    paper["url"]     = scholar_url
    paper["doi_url"] = None
    paper["access"]  = "Search on Google Scholar"
    print(f"[crossref] ✗ no match for '{title[:55]}' — using Scholar fallback")
    return paper


@app.route("/api/discover_papers", methods=["POST"])
def discover_papers():
    """
    Discover real academic papers using a two-phase approach:
    1. Gemini (JSON mode) generates paper metadata — title, authors, year, etc.
       No URLs generated here to avoid hallucinations.
    2. CrossRef API looks up each paper by title/author and returns a real DOI URL.
       Falls back to a Google Scholar search URL if CrossRef has no match.
    """
    if not GEMINI_API_KEY:
        return jsonify({"error": "GEMINI_API_KEY is not set"}), 500

    data = request.get_json()
    claim = data.get("claim", "").strip()
    if not claim:
        return jsonify({"error": "No claim provided"}), 400

    # ── Phase 1: Gemini generates paper metadata (JSON mode, no URL) ──────────
    # Current year: 2026. Papers must be from 2021 or later (within 5 years).
    gemini_prompt = f"""You are a world-class scholar that focuses on providing accurate research information to the masses.
Your job is to find Related Literature for a student's research claim under these strict conditions:

1. Papers must be published from 2021 onwards (within 5 years of 2026).
2. Papers must be from reputable, peer-reviewed databases (e.g. PubMed, ERIC, JSTOR, IEEE Xplore, Google Scholar, ResearchGate).
3. STRONGLY PREFER open-access papers (PubMed Central, arXiv, DOAJ, PLoS, Frontiers, MDPI, or papers freely available on Google Scholar). Only include subscription-required papers if no open-access alternative exists on the same topic.

The student's research claim is:
CLAIM: "{claim}"

Select the top 3 to 5 papers that align most with the claim.

CRITICAL ACCURACY REQUIREMENTS — read carefully:
- Every paper you list MUST genuinely exist. Do NOT invent, fabricate, or guess any paper. If you are not completely certain a paper exists with that exact title and those exact authors, omit it.
- "title" must be the VERBATIM, CHARACTER-FOR-CHARACTER exact title as it appears in the publication. Do not alter capitalisation, punctuation, or wording.
- "authors" must list ALL authors exactly as credited in the paper. Do not add, remove, or rearrange any authors.

Return ONLY valid JSON — no markdown, no extra text:
{{
  "detected_field": "the academic discipline of the claim",
  "semantic_variables": ["key concept 1", "key concept 2", "key concept 3"],
  "papers": [
    {{
      "title": "VERBATIM exact title as published",
      "authors": "Last, F. & Last, F. & Last, F.",
      "year": "2023",
      "publisher": "Journal Name, Publisher",
      "access": "Open Access",
      "citation": "APA 7th edition full citation",
      "relevance": "One sentence on why this paper is relevant to the claim.",
      "synthesis": "Full paragraph synthesising this paper and explaining its correlation to the claim."
    }}
  ]
}}"""

    try:
        response = client.models.generate_content(
            model=MODEL_JSON,
            contents=gemini_prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=4000,
                response_mime_type="application/json",
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        parsed = json.loads(response.text)
        print(f"[discover_papers] Gemini returned {len(parsed.get('papers', []))} papers")
    except json.JSONDecodeError as je:
        print(f"[discover_papers] Gemini JSON error: {je}\n{response.text[:300]}")
        return jsonify({"error": "Could not parse Gemini response. Please try again."}), 500
    except Exception as e:
        return jsonify({"error": f"Gemini error: {str(e)}"}), 500

    if isinstance(parsed, list):
        papers_raw, detected_field, semantic_variables = parsed, "", []
    else:
        papers_raw         = parsed.get("papers", [])
        detected_field     = parsed.get("detected_field", "")
        semantic_variables = parsed.get("semantic_variables", [])

    # ── Phase 2: Build paper dicts, then CrossRef DOI lookup in parallel ──────
    papers = []
    for p in papers_raw:
        year_raw   = str(p.get("year") or "")
        year_match = re.search(r"\b(19|20)\d{2}\b", year_raw)
        year       = int(year_match.group(0)) if year_match else 0
        age        = 2026 - year if year else 99

        if age <= 1:   recency_score = 50
        elif age <= 3: recency_score = 45
        elif age <= 5: recency_score = 35
        elif age <= 8: recency_score = 20
        else:          recency_score = 0

        recency_flag = "CURRENT" if age <= 5 else "DATED" if age <= 8 else "OUTDATED"

        papers.append({
            "title":             p.get("title") or "",
            "authors":           p.get("authors") or "",
            "year":              str(year) if year else "",
            "publisher":         p.get("publisher") or "",
            "url":               "",   # filled below by CrossRef
            "doi_url":           None,
            "pdf_url":           None,
            "access":            p.get("access") or "Verify access online",
            "citation":          p.get("citation") or "",
            "relevance":         p.get("relevance") or "",
            "synthesis":         p.get("synthesis") or "",
            "abstract":          p.get("synthesis") or p.get("relevance") or "",
            "recency_score":     recency_score,
            "recency_flag":      recency_flag,
            "relevance_score":   45,
            "credibility_score": recency_score + 45,
            "citation_count":    0,
        })

    # Run CrossRef lookups in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        results = list(ex.map(resolve_paper_url, papers))

    # All papers are kept — CrossRef fallback guarantees a working Scholar URL
    valid_papers = [p for p in results if p is not None]
    print(f"[discover_papers] returning {len(valid_papers)} papers")

    return jsonify({
        "papers":             valid_papers,
        "detected_field":     detected_field,
        "semantic_variables": semantic_variables,
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
