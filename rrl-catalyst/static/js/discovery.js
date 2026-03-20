/* ============================================================
   discovery.js — Step 1: Source Discovery
   ============================================================ */

"use strict";

let SELECTED_SOURCE = null;

/** Kick off the discovery search after a claim is locked. */
async function runDiscovery() {
  document.getElementById("disc-searching").style.display = "flex";
  document.getElementById("source-list").style.display = "none";
  document.getElementById("btn-use-source").style.display = "none";
  SELECTED_SOURCE = null;

  let sources = null;
  let detectedField = null;
  let semanticVars = null;

  try {
    const prompt = buildDiscoveryPrompt(CURRENT_CLAIM);
    const raw = await callClaude(prompt, 4000);
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    sources = parsed.discovery_phase.suggested_sources;
    detectedField = parsed.detected_field;
    semanticVars = parsed.semantic_variables;
  } catch (e) {
    console.error("Discovery API failed:", e);
    document.getElementById("disc-searching").style.display = "none";
    const list = document.getElementById("source-list");
    list.style.display = "block";
    list.innerHTML = `<div style="padding:16px;text-align:center;color:#d93025;font-size:13px;">
      <strong>Discovery failed</strong><br>${escHtml(e.message)}</div>`;
    return;
  }

  renderSources(sources, detectedField, semanticVars);
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
    const year = parseInt(s.year) || 0;
    const age = 2026 - year;

    const rFlag = s.recency_flag || (age <= 5 ? "CURRENT" : age <= 8 ? "DATED" : "OUTDATED");
    const rCol = rFlag === "CURRENT" ? "#1e8e3e" : rFlag === "DATED" ? "#e37400" : "#d93025";
    const rBg = rFlag === "CURRENT" ? "#e6f4ea" : rFlag === "DATED" ? "#fef3e2" : "#fce8e6";
    const rLbl = rFlag === "CURRENT"
      ? `✓ Within 5-year window (${year || "?"})`
      : rFlag === "DATED"
        ? `⚠ ${age} yrs old — use with caution`
        : `✕ OUTDATED — ${age} yrs old (before 2021)`;

    const rec = typeof s.recency_score === "number" ? s.recency_score : Math.max(0, 50 - age * 5);
    const rel = typeof s.relevance_score === "number" ? s.relevance_score : 40;
    const cred = typeof s.credibility_score === "number" ? s.credibility_score : rec + rel;
    const cCol = cred >= 80 ? "#1e8e3e" : cred >= 60 ? "#e37400" : "#d93025";

    const aCol = (s.access || "").toLowerCase().startsWith("free") ? "#1e8e3e" : "#e37400";
    const aBg = (s.access || "").toLowerCase().startsWith("free") ? "#e6f4ea" : "#fef3e2";

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
