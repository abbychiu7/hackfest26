/* ============================================================
   highlight.js — Float button, claim lock, document marks
   ============================================================ */

"use strict";

let CURRENT_CLAIM = "";
let savedRange    = null;

/* ── Float Button: show on text selection ── */
document.addEventListener("mouseup", e => {
    if (e.target.closest("#side-panel") || e.target.closest("#float-btn")) return;

    setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) { hideFloat(); return; }

        const text = sel.toString().trim();
        if (text.length < 8) { hideFloat(); return; }

        const docBody = document.getElementById("doc-body");
        if (!docBody) return;

        const range = sel.getRangeAt(0);
        if (!docBody.contains(range.commonAncestorContainer)) { hideFloat(); return; }

        savedRange = range.cloneRange();

        const rect      = range.getBoundingClientRect();
        const scroll    = document.getElementById("doc-scroll");
        const scrollRect = scroll.getBoundingClientRect();
        const btn       = document.getElementById("float-btn");

        let left = rect.left - scrollRect.left + scroll.scrollLeft + rect.width / 2 - 110;
        let top  = rect.top  - scrollRect.top  + scroll.scrollTop;

        left = Math.max(8, Math.min(left, scrollRect.width - 230));
        btn.style.left    = left + "px";
        btn.style.top     = top  + "px";
        btn.style.display = "flex";
    }, 10);
});

document.addEventListener("mousedown", e => {
    if (!e.target.closest("#float-btn")) hideFloat();
});

function hideFloat() {
    const btn = document.getElementById("float-btn");
    if (btn) btn.style.display = "none";
}

/* ── Lock Claim: wraps selected text in a yellow mark ── */
function lockClaim() {
    const sel  = window.getSelection();
    const text = (sel && !sel.isCollapsed)
        ? sel.toString().trim()
        : (savedRange ? savedRange.toString().trim() : "");

    if (!text) return;
    CURRENT_CLAIM = text;

    clearMarks();

    try {
        const range = (sel && !sel.isCollapsed) ? sel.getRangeAt(0) : savedRange;
        if (range) {
            const mark = document.createElement("mark");
            mark.className = "rrl-mark";
            range.surroundContents(mark);
        }
    } catch (e) {
        /* surroundContents fails on cross-element selections — silent fallback */
    }

    if (sel) sel.removeAllRanges();
    hideFloat();

    /* Open panel if closed */
    if (!panelOpen) togglePanel();

    setStep(1);
    showView("discovery");
    runDiscovery();
}

/** Remove all existing yellow marks from the document. */
function clearMarks() {
    document.querySelectorAll(".rrl-mark").forEach(m => {
        const p = m.parentNode;
        while (m.firstChild) p.insertBefore(m.firstChild, m);
        p.removeChild(m);
    });
}
