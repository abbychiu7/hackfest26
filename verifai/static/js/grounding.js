/* ============================================================
   grounding.js — Step 3: Paste & Analyze
   ============================================================ */

"use strict";

let REAL_SOURCE_TEXT = "";

/** Run the grounding (verification) analysis against pasted paper text. */
async function runGrounding() {
    const btn        = document.getElementById("analyze-btn");
    const sourceText = document.getElementById("source-input").value.trim();

    if (sourceText.length < 80) {
        setStatus("Paste at least a few paragraphs of the paper first.", "error");
        return;
    }

    REAL_SOURCE_TEXT = sourceText;
    const wc = sourceText.split(/\s+/).length;
    setStatus(`${wc.toLocaleString()} words loaded — analyzing…`, "ok");

    btn.classList.add("loading");
    btn.disabled = true;
    setStep(3);
    document.getElementById("verifai-particles-overlay").classList.add("active");

    const truncated  = sourceText.length > 14000 ? sourceText.slice(0, 14000) + "…" : sourceText;
    const sourceRef  = SELECTED_SOURCE ? SELECTED_SOURCE.title : "provided source";
    const sourceYear = SELECTED_SOURCE ? (SELECTED_SOURCE.year || "unknown") : "unknown";

    try {
        const prompt = buildGroundingPrompt(CURRENT_CLAIM, sourceRef, sourceYear, truncated);
        const raw    = await callGemini(prompt, 1200);
        const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
        renderResults(result.verification_phase, wc);
    } catch (err) {
        console.warn("Grounding API failed, using demo data:", err);
        renderResults(getDemoVerification(), wc);
        setStatus("Demo mode — API unavailable", "error");
    }

    btn.classList.remove("loading");
    btn.disabled = false;
    document.getElementById("verifai-particles-overlay").classList.remove("active");
}

/** Fallback demo verification result. */
function getDemoVerification() {
    return {
        status:            "HIGHLY CREDIBLE",
        credibility_score: "88%",
        recency_flag:      "CURRENT",
        highlight_tier:    "exact",
        exact_quotes: [
            "Artificial intelligence is not a replacement for human intelligence; it is a tool that enhances and extends human capabilities.",
            "AI will not replace human workers in the broader sense; rather, it will serve as an assistive technology that enables humans to work more efficiently, make better decisions, and focus on higher-value tasks that require distinctly human skills."
        ],
        point_of_interest: {
            sentences: [
                "Artificial intelligence is not a replacement for human intelligence; it is a tool that enhances and extends human capabilities.",
                "AI will not replace human workers in the broader sense; rather, it will serve as an assistive technology that enables humans to work more efficiently, make better decisions, and focus on higher-value tasks that require distinctly human skills."
            ],
            note: "These two sentences — from the Introduction and Conclusion — are the academic core of the augmentation argument. They directly anchor the student's claim in peer-reviewed language.",
            contextual_critique: ""
        },
        explanation: "Both passages are extracted verbatim from Iliyas et al. (2024). They directly mirror the student's claim in peer-reviewed academic language.",
        rrl_synthesis: "Iliyas et al. (2024) conclude that artificial intelligence does not supplant human intelligence but functions as an assistive tool, enabling workers to concentrate on higher-value tasks requiring creativity, empathy, and ethical reasoning.",
        apa_citation: "Iliyas, M. A., Rajalakshmi, V., & Reshma, B. (2024). A study on AI replace human in future. Rathinam Journal of Management Studies, 18(1). https://www.researchgate.net/publication/386546435"
    };
}

/** Demo source text used when no real text was pasted. */
function getDemoSourceText() {
    return [
        "Mohamed Iliyas A, Dr. V. Rajalakshmi, Reshma B. (2024). A STUDY ON AI REPLACE HUMAN IN FUTURE.",
        "Vol. 18, No.1, Oct-Dec 2024. ISSN: 0971-3034. Rathinam College of Arts and Science.",
        "",
        "Introduction: Artificial intelligence is not a replacement for human intelligence; it is a tool that enhances and extends human capabilities. The relationship between humans and AI is collaborative rather than adversarial.",
        "",
        "Key findings: The research found that while AI will automate certain repetitive and rule-based tasks, the uniquely human qualities such as empathy, creativity, ethical reasoning, and complex social interaction remain irreplaceable.",
        "",
        "Conclusion: AI will not replace human workers in the broader sense; rather, it will serve as an assistive technology that enables humans to work more efficiently, make better decisions, and focus on higher-value tasks that require distinctly human skills. The future of work is human-AI collaboration, not human replacement."
    ].join("\n");
}
