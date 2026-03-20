/* ============================================================
   api.js — Gemini API calls (via Flask proxy)
   All requests go through /api/gemini to keep the key safe.
   ============================================================ */

"use strict";

/**
 * Call the Gemini API via the Flask proxy.
 * @param {string} prompt
 * @param {number} maxTokens
 * @returns {Promise<string>} raw text response
 */
async function callClaude(prompt, maxTokens = 1400) {
    const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: maxTokens })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Gemini API request failed");
    }
    const data = await res.json();
    return data.text;
}

/**
 * Build the Step 1 Discovery prompt — universal, topic-agnostic.
 * @param {string} claim
 * @returns {string}
 */
function buildDiscoveryPrompt(claim) {
    return [
        "You are the RRL Catalyst Deep Search Engine. Today is 2026.",
        "A student has highlighted this claim:",
        "",
        `STUDENT_CLAIM: "${claim}"`,
        "",
        "UNIVERSAL ACADEMIC PROTOCOL:",
        "1. Detect the academic field automatically (STEM, Nursing, Law, Social Sciences, Humanities, etc.).",
        "2. Extract 3-5 core semantic research variables from the claim.",
        "3. Simulate a broad search across open-access databases (PubMed, Frontiers, SSRN, arXiv, IMF, WHO, DOAJ, etc.).",
        "4. Apply the 5-YEAR RECENCY RULE: Current year is 2026. Prioritize 2021-2026. Flag before 2021 as outdated.",
        "5. For each source, calculate:",
        "   - recency_score (0-50): 50=2025-2026, 45=2023-2024, 35=2021-2022, 20=2018-2020, 0=before 2018",
        "   - relevance_score (0-50): how directly does the content match the claim variables",
        "   - credibility_score = recency_score + relevance_score",
        "",
        "ANTI-HALLUCINATION RULE:",
        "Only return sources that plausibly exist on real open-access repositories.",
        "Mark uncertain URLs with access: 'Verify on Google Scholar'.",
        "",
        "Return ONLY valid JSON, no markdown:",
        "{",
        '  "detected_field": "e.g. Nursing / AI & Workforce / Law / Public Health",',
        '  "semantic_variables": ["variable1", "variable2", "variable3"],',
        '  "discovery_phase": {',
        '    "suggested_sources": [',
        "      {",
        '        "title": "Full paper title",',
        '        "authors": "Last, F. A. & Last, F. B.",',
        '        "year": "2024",',
        '        "publisher": "Journal name, Publisher",',
        '        "url": "https://...",',
        '        "pdf_url": "https://... or null",',
        '        "access": "FREE on [source] / Verify on Google Scholar",',
        '        "recency_score": 45,',
        '        "relevance_score": 48,',
        '        "credibility_score": 93,',
        '        "recency_flag": "CURRENT",',
        '        "relevance": "One sentence on why this source matches the claim."',
        "      }",
        "    ]",
        "  }",
        "}"
    ].join("\n");
}

/**
 * Build the Step 3 Grounding prompt — 3-tier highlight + recency rule.
 * @param {string} claim
 * @param {string} sourceRef
 * @param {string} sourceYear
 * @param {string} truncatedText
 * @returns {string}
 */
function buildGroundingPrompt(claim, sourceRef, sourceYear, truncatedText) {
    const yearAge = sourceYear !== "unknown" ? (2026 - parseInt(sourceYear)) : null;
    const recencyContext = yearAge !== null
        ? (yearAge <= 5
            ? `Source is within the 5-year recency window (published ${sourceYear}).`
            : `Source is ${yearAge} years old — OUTSIDE the 5-year window. Append [OUTDATED] to status.`)
        : "Publication year unknown.";

    return [
        "You are the RRL Catalyst Engine — STEP 3: GROUNDING. Current year: 2026.",
        "",
        `CLAIM_TO_VERIFY: "${claim}"`,
        `SOURCE: "${sourceRef}"`,
        `PUBLICATION YEAR: ${sourceYear} — ${recencyContext}`,
        "",
        "SCRAPED_PAPER_CONTENT (word-for-word from real PDF):",
        truncatedText,
        "",
        "HIGHLIGHT PROTOCOL — MUST always provide a point_of_interest. Never leave source view empty:",
        "",
        'TIER 1 — EXACT MATCH: Copy sentences CHARACTER-FOR-CHARACTER into exact_quotes. Set highlight_tier to "exact".',
        'TIER 2 — SEMANTIC SUGGESTION: No verbatim match but related. Set highlight_tier to "semantic". Put sentences in point_of_interest.sentences.',
        'TIER 3 — CONTEXTUAL CRITIQUE: Source contradicts claim. Still highlight the most relevant passage. Set highlight_tier to "critique".',
        "",
        "RECENCY RULE: If source older than 5 years (before 2021), include [OUTDATED] in status.",
        "",
        "Return ONLY valid JSON, no markdown:",
        "{",
        '  "verification_phase": {',
        '    "status": "HIGHLY CREDIBLE or NEEDS REVIEW or CONFLICTING or OUTDATED",',
        '    "credibility_score": "88%",',
        '    "recency_flag": "CURRENT or DATED or OUTDATED",',
        '    "highlight_tier": "exact or semantic or critique",',
        '    "exact_quotes": ["verbatim sentence — only if tier is exact, else empty array"],',
        '    "point_of_interest": {',
        '      "sentences": ["sentence from source to highlight"],',
        '      "note": "Why this passage is the key point of interest.",',
        '      "contextual_critique": "Only if tier is critique."',
        "    },",
        '    "explanation": "Overall explanation of what was found and why it matters.",',
        '    "rrl_synthesis": "Professional academic sentence for the literature review.",',
        '    "apa_citation": "Author, A. (Year). Title. Journal, vol(issue), pages."',
        "  }",
        "}"
    ].join("\n");
}
