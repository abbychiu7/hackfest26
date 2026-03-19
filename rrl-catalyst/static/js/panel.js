/* ============================================================
   panel.js — Sidebar panel state & step indicator
   ============================================================ */

"use strict";

let panelOpen = false;
let appStep   = 0;  // 0=welcome, 1=discovery, 2=grounding, 3=results

/**
 * Toggle the side panel open or closed.
 */
function togglePanel() {
    panelOpen = !panelOpen;
    document.getElementById("side-panel").classList.toggle("open", panelOpen);
    document.getElementById("rrl-btn").classList.toggle("active", panelOpen);
}

/**
 * Show a specific view inside the panel body, hiding all others.
 * @param {"welcome"|"discovery"|"grounding"|"skeleton"|"results"} name
 */
function showView(name) {
    const views = ["welcome", "discovery", "grounding", "skeleton", "results"];
    views.forEach(v => {
        const el = document.getElementById("view-" + v);
        if (!el) return;
        el.style.display = (v === name) ? (v === "results" ? "flex" : "block") : "none";
    });
}

/**
 * Advance the step indicator and update circle/line states.
 * @param {number} n — 1, 2, or 3
 */
function setStep(n) {
    appStep = n;
    const bar = document.getElementById("step-bar");
    if (bar) bar.style.display = n > 0 ? "flex" : "none";

    const dot = document.getElementById("step-dot");
    if (dot) dot.classList.toggle("visible", n > 0 && n < 3);

    [1, 2, 3].forEach(i => {
        const circle = document.getElementById("sc" + i);
        const label  = document.getElementById("sl" + i);
        if (!circle || !label) return;

        circle.className = "step-circle" + (i < n ? " done" : i === n ? " active" : "");
        label.className  = "step-label"  + (i < n ? " done" : i === n ? " active" : "");
        circle.innerHTML = i < n ? "✓" : String(i);
    });

    const line1 = document.getElementById("line1");
    const line2 = document.getElementById("line2");
    if (line1) line1.className = "step-line" + (n > 1 ? " done" : "");
    if (line2) line2.className = "step-line" + (n > 2 ? " done" : "");
}

/**
 * Switch between Verification / Source View / Synthesis tabs.
 * @param {string} name — "verification", "sources", or "synthesis"
 * @param {HTMLElement} btn — the clicked tab button
 */
function switchTab(name, btn) {
    document.querySelectorAll(".tb").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tp").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + name).classList.add("active");
}

/**
 * Copy the APA citation to clipboard.
 */
function copyCitation() {
    const text = document.getElementById("r-citation").textContent;
    navigator.clipboard.writeText(text).then(() => showToast("Citation copied!"));
}
