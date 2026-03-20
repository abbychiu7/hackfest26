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
async function callGemini(prompt, maxTokens = 1400) {
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
 * Build the Step 1 Analysis prompt.
 * Gemini detects the academic field and generates optimized search queries.
 * Actual papers are fetched from Semantic Scholar using these queries.
 * @param {string} claim
 * @returns {string}
 */
function buildDiscoveryPrompt(claim) {
    return [
        "You are an academic research assistant. Today's date is 2026-03-20.",
        "A student has selected this text as a claim they want to find related literature for:",
        "",
        `STUDENT_CLAIM: "${claim}"`,
        "",
        "Your job is to:",
        "1. Detect the academic field (e.g., Nursing, Social Sciences, AI & Workforce, Law, Public Health, STEM).",
        "2. Extract 3-5 core semantic research variables from the claim.",
        "3. Generate EXACTLY 2 short academic search query strings (5-8 words each).",
        "   - Use plain keyword phrases only. No boolean operators.",
        "   - Make them cover different aspects of the claim.",
        "",
        "Return ONLY valid JSON (no markdown, no extra text):",
        "{",
        '  "detected_field": "Social Sciences",',
        '  "semantic_variables": ["variable1", "variable2"],',
        '  "search_queries": ["first search query here", "second search query here"]',
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
        "You are the Verifai Engine — STEP 3: GROUNDING. Current year: 2026.",
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
