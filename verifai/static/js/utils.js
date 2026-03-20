/* ============================================================
   utils.js — Shared helper functions
   ============================================================ */

"use strict";

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} s
 * @returns {string}
 */
function escHtml(s) {
    return (s || "").replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
}

/**
 * Show a temporary toast notification at the bottom of the screen.
 * @param {string} msg
 * @param {number} [duration=2500]
 */
function showToast(msg, duration = 2500) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), duration);
}

/**
 * Set the fetch-status label below the paste area.
 * @param {string} msg
 * @param {"ok"|"error"|"info"} type
 */
function setStatus(msg, type) {
    const el = document.getElementById("fetch-status");
    if (!el) return;
    el.textContent = msg;
    el.style.color =
        type === "error" ? "#d93025" :
        type === "ok"    ? "#1e8e3e" :
                           "#9aa0a6";
}

/**
 * Calculate recency score (0–50) based on publication year vs 2026.
 * @param {number} year
 * @returns {{ score: number, flag: string, label: string }}
 */
function calcRecency(year) {
    const CURRENT_YEAR = 2026;
    const age = year > 0 ? CURRENT_YEAR - year : 99;
    if (age <= 1)  return { score: 50, flag: "CURRENT", label: `✓ ${year} — within 1 yr (max recency)` };
    if (age <= 3)  return { score: 45, flag: "CURRENT", label: `✓ ${year} — within 3 yrs (5-year window)` };
    if (age <= 5)  return { score: 35, flag: "CURRENT", label: `✓ ${year} — within 5-year window (2021–2026)` };
    if (age <= 8)  return { score: 20, flag: "DATED",   label: `⚠ ${year} — ${age} yrs old, exceeds 5-year window` };
    return          { score: 0,  flag: "OUTDATED", label: `✕ ${year || "?"} — OUTDATED (before 2018)` };
}
