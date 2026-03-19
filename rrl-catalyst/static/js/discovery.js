/* ============================================================
   discovery.js — Step 1: Source Discovery
   ============================================================ */

"use strict";

let SELECTED_SOURCE = null;

/** Kick off the discovery search after a claim is locked. */
async function runDiscovery() {
    document.getElementById("disc-searching").style.display = "flex";
    document.getElementById("source-list").style.display   = "none";
    document.getElementById("btn-use-source").style.display = "none";
    SELECTED_SOURCE = null;

    let sources       = null;
    let detectedField = null;
    let semanticVars  = null;

    try {
        const prompt = buildDiscoveryPrompt(CURRENT_CLAIM);
        const raw    = await callClaude(prompt, 1400);
        const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
        sources       = parsed.discovery_phase.suggested_sources;
        detectedField = parsed.detected_field;
        semanticVars  = parsed.semantic_variables;
    } catch (e) {
        console.warn("Discovery API failed, using demo sources:", e);
        sources = getDemoSources();
    }

    renderSources(sources, detectedField, semanticVars);
}

/** Fallback demo sources (real, verified, open-access). */
function getDemoSources() {
    return [
        {
            title:    "Human augmentation, not replacement: A research agenda for AI and robotics in the industry",
            url:      "https://pmc.ncbi.nlm.nih.gov/articles/PMC9578547/",
            pdf_url:  "https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2022.997386/pdf",
            year:     "2022",
            authors:  "Dégallier-Rochat, S., Keller-Birrer, M., Etemi, N., & Yakimova, O.",
            publisher:"Frontiers in Robotics and AI (open access, peer-reviewed)",
            access:   "FREE — Full text on PubMed Central + PDF",
            recency_score: 35, relevance_score: 48, credibility_score: 83, recency_flag: "CURRENT",
            relevance:"Directly argues replacement is a myth; the real question is quality of human-machine augmentation."
        },
        {
            title:    "Understanding Human-AI Augmentation in the Workplace",
            url:      "https://link.springer.com/article/10.1007/s10796-025-10591-5",
            pdf_url:  "https://www.researchgate.net/publication/389560018",
            year:     "2025",
            authors:  "Information Systems Frontiers, Springer Nature",
            publisher:"Information Systems Frontiers, Springer Nature",
            access:   "FREE — Abstract on Springer; full text on ResearchGate",
            recency_score: 50, relevance_score: 46, credibility_score: 96, recency_flag: "CURRENT",
            relevance:"Systematic review of 35 papers on human-AI augmentation; covers how AI assists rather than replaces."
        },
        {
            title:    "Gen-AI: Artificial Intelligence and the Future of Work",
            url:      "https://www.imf.org/en/Publications/Staff-Discussion-Notes/Issues/2024/01/14/Gen-AI-Artificial-Intelligence-and-the-Future-of-Work-542379",
            pdf_url:  "https://www.imf.org/-/media/files/publications/sdn/2024/english/sdnea2024001.pdf",
            year:     "2024",
            authors:  "Cazzaniga, M., Jaumotte, F., Li, L., et al. (IMF)",
            publisher:"IMF Staff Discussion Note SDN2024/001",
            access:   "FREE — Full PDF on imf.org",
            recency_score: 45, relevance_score: 44, credibility_score: 89, recency_flag: "CURRENT",
            relevance:"IMF institutional research showing AI complements rather than replaces workers."
        },
        {
            title:    "Will AI Replace Human Jobs? A Literature Review",
            url:      "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5380481",
            pdf_url:  "https://papers.ssrn.com/sol3/Delivery.cfm/5380481.pdf?abstractid=5380481&mirid=1",
            year:     "2025",
            authors:  "Rion, A. H. & Any, M. M.",
            publisher:"SSRN (Social Science Research Network)",
            access:   "FREE — Full PDF on SSRN",
            recency_score: 50, relevance_score: 49, credibility_score: 99, recency_flag: "CURRENT",
            relevance:"Distinguishes automation AI (removes labor) from augmentation AI (enables labor)."
        }
    ];
}

/**
 * Render source cards into the discovery panel.
 * @param {Array} sources
 * @param {string|null} detectedField
 * @param {string[]|null} semanticVars
 */
function renderSources(sources, detectedField, semanticVars) {
    document.getElementById("disc-searching").style.display = "none";
    const list = document.getElementById("source-list");
    list.style.display = "block";

    /* Field detection header */
    let fieldHtml = "";
    if (detectedField) {
        fieldHtml = `
          <div style="background:var(--blue-light);border-radius:6px;padding:8px 10px;margin-bottom:10px">
            <div style="font-size:9px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:var(--blue);margin-bottom:3px">Field detected</div>
            <div style="font-size:12px;font-weight:500;color:var(--blue-dark)">${escHtml(detectedField)}</div>
            ${semanticVars && semanticVars.length
                ? `<div style="font-size:10px;color:var(--ink2);margin-top:3px">Search variables: ${escHtml(semanticVars.join(" · "))}</div>`
                : ""}
          </div>`;
    }

    const cardsHtml = sources.map((s, i) => {
        const year  = parseInt(s.year) || 0;
        const age   = 2026 - year;

        const rFlag = s.recency_flag || (age <= 5 ? "CURRENT" : age <= 8 ? "DATED" : "OUTDATED");
        const rCol  = rFlag === "CURRENT" ? "#1e8e3e" : rFlag === "DATED" ? "#e37400" : "#d93025";
        const rBg   = rFlag === "CURRENT" ? "#e6f4ea"  : rFlag === "DATED" ? "#fef3e2"  : "#fce8e6";
        const rLbl  = rFlag === "CURRENT"
            ? `✓ Within 5-year window (${year || "?"})`
            : rFlag === "DATED"
                ? `⚠ ${age} yrs old — use with caution`
                : `✕ OUTDATED — ${age} yrs old (before 2021)`;

        const rec  = typeof s.recency_score   === "number" ? s.recency_score   : Math.max(0, 50 - age * 5);
        const rel  = typeof s.relevance_score === "number" ? s.relevance_score : 40;
        const cred = typeof s.credibility_score === "number" ? s.credibility_score : rec + rel;
        const cCol = cred >= 80 ? "#1e8e3e" : cred >= 60 ? "#e37400" : "#d93025";

        const aCol = (s.access || "").toLowerCase().startsWith("free") ? "#1e8e3e" : "#e37400";
        const aBg  = (s.access || "").toLowerCase().startsWith("free") ? "#e6f4ea"  : "#fef3e2";

        return `
          <div class="source-card" id="sc-${i}" onclick="selectSource(${i})">
            <div style="display:flex;align-items:flex-start;gap:6px">
              <div style="flex:1">
                <div class="sc-title">${escHtml(s.title)}</div>
                <div class="sc-meta">${escHtml(s.authors || "")}${s.year ? " · " + escHtml(s.year) : ""}</div>
                <div class="sc-meta" style="color:var(--ink2);margin-bottom:4px">${escHtml(s.publisher || "")}</div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:5px">
                  <span style="font-size:9px;font-weight:600;padding:2px 7px;border-radius:3px;background:${rBg};color:${rCol}">${rLbl}</span>
                  <span style="font-size:9px;font-weight:600;padding:2px 7px;border-radius:3px;background:${aBg};color:${aCol}">${escHtml(s.access || "")}</span>
                </div>
                <div style="display:grid;grid-template-columns:60px 1fr 28px;align-items:center;gap:4px;margin-bottom:3px">
                  <span style="font-size:9px;color:var(--ink3)">Recency</span>
                  <div style="height:4px;background:#eee;border-radius:2px"><div style="height:100%;width:${(rec / 50) * 100}%;background:${rCol};border-radius:2px"></div></div>
                  <span style="font-size:9px;font-weight:600;color:${rCol}">${rec}/50</span>
                </div>
                <div style="display:grid;grid-template-columns:60px 1fr 28px;align-items:center;gap:4px;margin-bottom:4px">
                  <span style="font-size:9px;color:var(--ink3)">Relevance</span>
                  <div style="height:4px;background:#eee;border-radius:2px"><div style="height:100%;width:${(rel / 50) * 100}%;background:var(--blue);border-radius:2px"></div></div>
                  <span style="font-size:9px;font-weight:600;color:var(--blue)">${rel}/50</span>
                </div>
                <div style="font-size:10px;font-weight:600;color:${cCol};margin-bottom:5px">Credibility: ${cred}%</div>
                <div class="sc-relevance">${escHtml(s.relevance)}</div>
                <div style="display:flex;gap:8px;margin-top:5px">
                  <a href="${escHtml(s.url || "#")}" target="_blank" style="font-size:10px;color:var(--blue);text-decoration:none" onclick="event.stopPropagation()">🔗 View paper</a>
                  ${s.pdf_url && s.pdf_url !== "null"
                    ? `<a href="${escHtml(s.pdf_url)}" target="_blank" style="font-size:10px;color:var(--red);text-decoration:none;font-weight:500" onclick="event.stopPropagation()">📄 Download PDF</a>`
                    : ""}
                </div>
              </div>
              <div class="sc-check" id="chk-${i}">
                <svg style="width:9px;height:9px;display:none" id="chksvg-${i}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
          </div>`;
    }).join("");

    list.innerHTML = fieldHtml + cardsHtml;
    window._sources = sources;
}

/**
 * Mark a source card as selected.
 * @param {number} i
 */
function selectSource(i) {
    document.querySelectorAll(".source-card").forEach(c => c.classList.remove("selected"));
    document.querySelectorAll("[id^='chksvg-']").forEach(s => s.style.display = "none");
    document.getElementById("sc-" + i).classList.add("selected");
    document.getElementById("chksvg-" + i).style.display = "block";
    SELECTED_SOURCE = window._sources[i];
    document.getElementById("btn-use-source").style.display = "block";
}

/** Advance to grounding step with the selected source. */
function goToGrounding() {
    if (!SELECTED_SOURCE) { showToast("Select a source first"); return; }
    setStep(2);
    showView("grounding");
    document.getElementById("sel-source-title").textContent = SELECTED_SOURCE.title;
}

/** Go back to discovery from grounding. */
function goBack() {
    setStep(1);
    showView("discovery");
}
