/* ============================================================
   render.js — Results rendering
   Handles: verification badge, POI banner, full-paper highlights,
            credibility rubric, synthesis & citation display.
   ============================================================ */

"use strict";

let hlNodes = [];
let curHL   = 0;

/**
 * Render all results panels after grounding analysis completes.
 * @param {Object} vp  — verification_phase object from API
 * @param {number} wc  — word count of pasted source text
 */
function renderResults(vp, wc) {
    showView("results");

    /* ── Claim pill ── */
    document.getElementById("r-claim").textContent = `"${CURRENT_CLAIM}"`;

    /* ── Status chip ── */
    const tier          = vp.highlight_tier || "exact";
    const tierLabel     = tier === "exact" ? "Exact match" : tier === "semantic" ? "Semantic suggestion" : "Contextual critique";
    const recencyFlag   = vp.recency_flag || "";
    const recencyStr    = recencyFlag === "OUTDATED" ? " · ⚠ OUTDATED" : recencyFlag === "DATED" ? " · ⚠ DATED" : "";
    document.getElementById("r-chip").textContent = (wc > 20 ? `${wc.toLocaleString()} words · ` : "") + tierLabel + recencyStr;

    /* ── Credibility badge ── */
    const rawStatus  = vp.status || "";
    const isOutdated = /OUTDATED/i.test(rawStatus) || recencyFlag === "OUTDATED";
    const statusMap  = {
        "HIGHLY CREDIBLE": "credible", "CREDIBLE": "credible",
        "CONFLICTING": "conflicting",
        "NEEDS REVIEW": "needs-review", "No direct evidence found": "needs-review"
    };
    const badgeClass = isOutdated ? "needs-review" : (statusMap[rawStatus.replace(/\[OUTDATED\]/i, "").trim()] || "needs-review");
    document.getElementById("r-badge").className = "sbadge " + badgeClass;
    document.getElementById("r-status").textContent = rawStatus;

    /* ── Credibility score bar ── */
    const score = parseInt(vp.credibility_score) || 0;
    setTimeout(() => {
        const fill = document.getElementById("r-score-fill");
        fill.style.width      = score + "%";
        fill.style.background = score >= 75 ? "#1e8e3e" : score >= 50 ? "#e37400" : "#d93025";
    }, 300);
    document.getElementById("r-score-val").textContent = vp.credibility_score;

    /* ── AI context note ── */
    document.getElementById("r-explanation").textContent = vp.explanation;

    /* ── POI Banner ── */
    const poi         = vp.point_of_interest || {};
    const poiSentences = poi.sentences || [];
    const bannerStyles = {
        exact:    { bg: "#e6f4ea", border: "#1e8e3e", icon: "✅", label: "Exact Match",          color: "#1e8e3e" },
        semantic: { bg: "#fef3e2", border: "#e37400", icon: "🔎", label: "Semantic Suggestion",   color: "#e37400" },
        critique: { bg: "#fce8e6", border: "#d93025", icon: "⚠️", label: "Contextual Critique", color: "#d93025" }
    };
    const bs     = bannerStyles[tier] || bannerStyles.exact;
    const banner = document.getElementById("poi-banner");
    banner.style.background     = bs.bg;
    banner.style.borderLeftColor = bs.border;
    banner.style.display        = "block";
    document.getElementById("poi-icon").textContent          = bs.icon;
    document.getElementById("poi-tier-label").textContent    = bs.label;
    document.getElementById("poi-tier-label").style.color    = bs.color;
    document.getElementById("poi-note").textContent          = (tier === "critique" && poi.contextual_critique) ? poi.contextual_critique : (poi.note || "");

    /* ── Full paper with highlights ── */
    const src         = REAL_SOURCE_TEXT.length > 20 ? REAL_SOURCE_TEXT : getDemoSourceText();
    const exactQuotes = tier === "exact" ? (vp.exact_quotes || []) : [];
    renderFullPaper(src, exactQuotes, poiSentences, tier);

    /* ── Synthesis & Citation ── */
    buildRubric(vp);
    document.getElementById("r-synthesis").textContent = vp.rrl_synthesis;
    document.getElementById("r-citation").textContent  = vp.apa_citation;

    const matchCount = tier === "exact" ? exactQuotes.length : poiSentences.length;
    setStatus(`${wc.toLocaleString()} words · ${matchCount} point(s) highlighted`, "ok");
}

/**
 * Render the full paper text with colour-coded highlights.
 * Tier 1 = yellow, Tier 2 = orange, Tier 3 = red.
 * Last-resort: highlights first sentence if nothing matched.
 *
 * @param {string}   fullText
 * @param {string[]} exactQuotes
 * @param {string[]} poiSentences
 * @param {string}   tier
 */
function renderFullPaper(fullText, exactQuotes, poiSentences, tier) {
    const container = document.getElementById("paper-body");

    const hlStyle = {
        exact:    "background:#fff59d;border-bottom:2px solid #f9a825;",
        semantic: "background:#fef3e2;border-bottom:2px solid #e37400;",
        critique: "background:#fce8e6;border-bottom:2px solid #d93025;"
    };
    const outlineColor = { exact: "#f9a825", semantic: "#e37400", critique: "#d93025" };

    const primaryQuotes   = tier === "exact" ? exactQuotes   : [];
    const secondaryQuotes = poiSentences;

    /* Build and de-overlap ranges */
    const ranges = [];
    const addRanges = (quotes, t) => {
        [...quotes].sort((a, b) => b.length - a.length).forEach(q => {
            if (!q) return;
            let i = 0;
            while (true) {
                const p = fullText.indexOf(q, i);
                if (p === -1) break;
                ranges.push({ start: p, end: p + q.length, tier: t });
                i = p + 1;
            }
        });
    };
    addRanges(primaryQuotes,   "exact");
    addRanges(secondaryQuotes, tier === "exact" ? "poi-secondary" : tier);

    ranges.sort((a, b) => a.start - b.start);
    const merged = [];
    ranges.forEach(r => {
        if (merged.length && r.start < merged[merged.length - 1].end) return;
        merged.push(r);
    });

    /* Last-resort: always highlight something */
    if (merged.length === 0) {
        const firstDot = fullText.indexOf(".");
        const end      = firstDot > 0 ? firstDot + 1 : Math.min(120, fullText.length);
        merged.push({ start: 0, end, tier: "critique" });
    }

    /* Build HTML */
    const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let html = "", cursor = 0;
    merged.forEach((r, i) => {
        if (r.start > cursor) html += esc(fullText.slice(cursor, r.start));
        const t     = r.tier === "poi-secondary" ? tier : r.tier;
        const style = hlStyle[t] || hlStyle.exact;
        html += `<mark id="hl-${i}" data-tier="${t}" style="${style}border-radius:2px;padding:0 2px;cursor:pointer" onclick="gotoHL(${i})">${esc(fullText.slice(r.start, r.end))}</mark>`;
        cursor = r.end;
    });
    if (cursor < fullText.length) html += esc(fullText.slice(cursor));
    container.innerHTML = html;

    const count    = merged.length;
    const tierWord = tier === "exact" ? "exact match" : tier === "semantic" ? "semantic match" : "point of interest";
    document.getElementById("hl-count").textContent     = count > 0 ? `${count} ${tierWord}${count > 1 ? "es" : ""}` : "";
    document.getElementById("next-hl").style.display    = count > 0 ? "inline-block" : "none";
    hlNodes = Array.from(container.querySelectorAll("mark"));
    window._hlOutlineColor = outlineColor[tier] || "#f9a825";
    curHL = 0;
    if (hlNodes.length) setTimeout(() => gotoHL(0), 120);
}

/** Scroll to highlight by index and outline it. */
function gotoHL(idx) {
    if (!hlNodes.length) return;
    hlNodes.forEach(n => n.style.outline = "none");
    curHL = ((idx % hlNodes.length) + hlNodes.length) % hlNodes.length;
    hlNodes[curHL].style.outline = `2px solid ${window._hlOutlineColor || "#f9a825"}`;
    hlNodes[curHL].scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Advance to next highlight. */
function nextHL() { gotoHL(curHL + 1); }

/**
 * Build and render the credibility rubric scorecard.
 * @param {Object} vp — verification_phase
 */
function buildRubric(vp) {
    const src         = SELECTED_SOURCE || {};
    const year        = parseInt(src.year) || 0;
    const age         = year > 0 ? 2026 - year : 99;
    const recency     = calcRecency(year);

    const relScore = typeof src.relevance_score === "number"
        ? src.relevance_score
        : (vp.highlight_tier === "exact" ? 48 : vp.highlight_tier === "semantic" ? 32 : 15);
    const relPass = relScore >= 30;

    const isPeerReviewed = /frontiers|springer|journal|imf|who|elsevier|wiley|pubmed|pmc|doi|mdpi|lancet|bmj|nejm|ssrn|arxiv|doaj/i
        .test((src.publisher || "") + " " + (src.url || ""));
    const isOpenAccess = /free|open access|pmc|pubmed|ssrn|arxiv|doaj|who\.int|imf\.org|frontiersin|mdpi/i
        .test((src.access || "") + " " + (src.url || ""));
    const hasAuthors = !!(src.authors && src.authors.replace(/et al/gi, "").trim().length > 4);

    const totalScore    = recency.score + relScore;
    const overallStatus = totalScore >= 80 ? "HIGHLY CREDIBLE" : totalScore >= 60 ? "CREDIBLE" : totalScore >= 40 ? "NEEDS REVIEW" : "LOW CREDIBILITY";
    const oCol          = totalScore >= 80 ? "#1e8e3e" : totalScore >= 60 ? "#1a73e8" : totalScore >= 40 ? "#e37400" : "#d93025";
    const rPass         = recency.flag === "CURRENT";
    const rBannerBg     = rPass ? "#e6f4ea" : "#fce8e6";
    const rBannerCol    = rPass ? "#1e8e3e" : "#d93025";
    const rBannerLbl    = rPass
        ? "✓ 5-YEAR RULE PASSED"
        : `✕ 5-YEAR RULE FAILED — SOURCE FLAGGED AS ${age > 8 ? "[OUTDATED]" : "[DATED]"}`;

    let html = `
      <div style="background:var(--s2);border-radius:6px;padding:9px 10px;margin-bottom:8px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:10px;font-weight:600;color:var(--ink)">Credibility Score</span>
          <span style="font-size:14px;font-weight:700;color:${oCol}">${totalScore}<span style="font-size:10px;font-weight:400;color:var(--ink3)">/100</span></span>
        </div>
        <div style="display:grid;grid-template-columns:60px 1fr 36px;gap:4px;align-items:center;margin-bottom:3px">
          <span style="font-size:9px;color:var(--ink3)">Recency 50%</span>
          <div style="height:5px;background:#eee;border-radius:3px"><div style="height:100%;width:${(recency.score / 50) * 100}%;background:${rBannerCol};border-radius:3px"></div></div>
          <span style="font-size:9px;font-weight:600;color:${rBannerCol}">${recency.score}/50</span>
        </div>
        <div style="display:grid;grid-template-columns:60px 1fr 36px;gap:4px;align-items:center">
          <span style="font-size:9px;color:var(--ink3)">Relevance 50%</span>
          <div style="height:5px;background:#eee;border-radius:3px"><div style="height:100%;width:${(relScore / 50) * 100}%;background:var(--blue);border-radius:3px"></div></div>
          <span style="font-size:9px;font-weight:600;color:var(--blue)">${relScore}/50</span>
        </div>
      </div>
      <div style="background:${rBannerBg};border-radius:5px;padding:6px 9px;margin-bottom:8px;border-left:3px solid ${rBannerCol}">
        <div style="font-size:9px;font-weight:700;color:${rBannerCol};letter-spacing:.5px">${rBannerLbl}</div>
        <div style="font-size:10px;color:var(--ink2);margin-top:2px">${escHtml(recency.label)}</div>
      </div>`;

    const criteria = [
        { label: "Recency (5-year window: 2021–2026)",    pass: rPass,          note: recency.label },
        { label: "Relevance match to claim variables",     pass: relPass,        note: `${relScore}/50 — ${relPass ? "semantically aligned" : "low alignment, consider another source"}` },
        { label: "Peer-reviewed or institutional source",  pass: isPeerReviewed, note: isPeerReviewed ? (src.publisher || "Recognized academic publisher") : "Unconfirmed — verify independently" },
        { label: "Open access (verifiable by student)",    pass: isOpenAccess,   note: isOpenAccess ? "Full text freely accessible" : "May require library access" },
        { label: "Named author(s) with attribution",       pass: hasAuthors,     note: hasAuthors ? (src.authors || "Authors listed") : "Authorship unclear — reduces accountability" }
    ];

    criteria.forEach(c => {
        const col = c.pass ? "#1e8e3e" : "#d93025";
        html += `
          <div class="rubric-row">
            <div class="rubric-dot" style="background:${col}"></div>
            <div class="rubric-criterion">${escHtml(c.label)}</div>
            <div class="rubric-value" style="color:${col}">${escHtml(c.note)}</div>
          </div>`;
    });

    html += `
      <div style="margin-top:8px;padding:6px 9px;background:${oCol}18;border-radius:5px;border:1px solid ${oCol}44">
        <span style="font-size:10px;font-weight:700;color:${oCol}">VERDICT: ${overallStatus}</span>
        ${totalScore < 60 ? `<div style="font-size:10px;color:var(--ink2);margin-top:2px">Consider a more recent or relevant source for stronger academic support.</div>` : ""}
      </div>`;

    document.getElementById("rubric-rows").innerHTML = html;
}
