/**
 * PROTÉGÉ: Moriarty engine
 *  1. evaluateSession(): LLM does a strict rubric pass (JSON), then scores are
 *     computed DETERMINISTICALLY from that JSON (v2 design principle:
 *     "deterministic scoring, generative narration").
 *  2. moriartyTutorReply(): post-dossier AI tutor grounded in the source notes.
 * Every call falls back to an offline result so the UI never breaks.
 */
import { gemini } from './gemini.js';

const clean = raw => raw.replace(/```json/g, '').replace(/```/g, '').trim();
const arr = v => (Array.isArray(v) ? v : []);

/* ---------- Evaluation ---------- */

export async function evaluateSession({ sourceText, inlineData, doc }) {
  const systemInstruction = `You are Professor James Moriarty: cold, precise, intellectually admiring. You hold the ground truth (the source notes) and have silently observed Holmes teaching Dr. Watson.

You are given: the source notes, and for each of Watson's paragraphs its ORIGINAL text, FINAL text, and Holmes's corrections.

JOB 1 - RUBRIC (strict, no inflation). Return JSON only:
{
  "finalAccuracy": 0.0-1.0,   // how accurate Watson's FINAL document is vs the notes
  "paragraphs": [{
    "id": "p1",
    "originalErrors": ["short description of each real error in the ORIGINAL paragraph"],
    "missedErrors": ["errors from the original that Holmes did NOT correct"],
    "remainingErrors": ["errors still present in the FINAL paragraph"]
  }],
  "corrections": [{
    "paragraphId": "p1",
    "selectedText": "copied from input",
    "verdict": "ACCURATE" | "PARTIAL" | "INACCURATE" | "FALSE_POSITIVE",
    "explanationQuality": 0-3,  // 0 no reason, 1 asserts truth, 2 names mechanism, 3 mechanism + boundary condition
    "comment": "one sentence, specific"
  }],
  "unobservedClues": [{ "paragraphId": "p2", "text": "flawed phrase Holmes walked past", "explanation": "one line" }],
  "studyNext": [{ "topic": "...", "why": "one line tied to the notes" }],
  "verdict": "~150 words addressed to 'My dear Holmes.' Name what he caught, what he missed, any false alarms or errors in his own corrections, and close with his single biggest blind spot."
}
FALSE_POSITIVE = Holmes "corrected" something that was actually right. INACCURATE = the correction itself is factually wrong.
Return JSON only, no fences.`;

  const prompt = `SOURCE NOTES${sourceText ? ':\n' + sourceText : ' are attached as a document.'}

WATSON'S DOCUMENT:
${doc.paragraphs.map(p => `--- ${p.id} (${p.topic || 'topic'}) ---
ORIGINAL: ${p.originalContent ?? p.content}
FINAL: ${p.content}
APPROVED_WITHOUT_CHANGE: ${!!p.isApproved && p.corrections.length === 0}
CORRECTIONS: ${p.corrections.length
    ? p.corrections.map(c => `[${c.tag}] on "${c.selectedText}" -> "${c.userCorrection}"`).join(' | ')
    : 'none'}`).join('\n\n')}`;

  try {
    const raw = await gemini.generateContent({ systemInstruction, prompt, inlineData, temperature: 0.2, jsonMode: true });
    if (raw) {
      const ai = normalise(JSON.parse(clean(raw)));
      return { ...ai, scores: computeScores(ai, doc), source: 'live' };
    }
  } catch (err) {
    console.warn('[moriarty] live evaluation failed, using offline fallback:', err.message);
  }
  return offlineEvaluation(doc);
}

function normalise(ai) {
  return {
    finalAccuracy: typeof ai.finalAccuracy === 'number' ? Math.min(Math.max(ai.finalAccuracy, 0), 1) : null,
    paragraphs: arr(ai.paragraphs).map(p => ({
      id: p.id,
      originalErrors: arr(p.originalErrors),
      missedErrors: arr(p.missedErrors),
      remainingErrors: arr(p.remainingErrors)
    })),
    corrections: arr(ai.corrections),
    unobservedClues: arr(ai.unobservedClues),
    studyNext: arr(ai.studyNext),
    verdict: ai.verdict || 'The data is insufficient for a verdict, Holmes.'
  };
}

/** Deterministic scoring from the rubric JSON (formula from ARCHITECTURE_PLAN). */
export function computeScores(ai, doc) {
  const made = ai.corrections.length;
  const accurate = ai.corrections.filter(c => c.verdict === 'ACCURATE').length
    + 0.5 * ai.corrections.filter(c => c.verdict === 'PARTIAL').length;
  const falsePositives = ai.corrections.filter(c => c.verdict === 'FALSE_POSITIVE').length;
  const inaccurate = ai.corrections.filter(c => c.verdict === 'INACCURATE').length;
  const totalErrors = ai.paragraphs.reduce((s, p) => s + p.originalErrors.length, 0);
  const missed = ai.paragraphs.reduce((s, p) => s + p.missedErrors.length, 0);

  const accuracyTerm = made ? (accurate / made) * 0.4 : 0;
  const falseAlarmTerm = made ? (1 - falsePositives / made) * 0.3 : 0;
  const coverageTerm = totalErrors ? (1 - Math.min(missed, totalErrors) / totalErrors) * 0.3 : 0.3;
  const teachingScore = Math.round((accuracyTerm + falseAlarmTerm + coverageTerm) * 100);

  const q = ai.corrections.map(c => Number(c.explanationQuality) || 0);
  const avgExplanation = q.length ? +(q.reduce((a, b) => a + b, 0) / q.length).toFixed(1) : 0;

  return {
    teachingScore,
    correctionsMade: made,
    accurateCorrections: Math.round(accurate * 10) / 10,
    inaccurateCorrections: inaccurate,
    falsePositives,
    totalErrors,
    missedErrors: missed,
    avgExplanation,
    watsonBefore: Math.round((doc.paragraphs.length ? (doc.overallAccuracy ?? 0.5) : 0.5) * 100),
    watsonAfter: ai.finalAccuracy == null ? null : Math.round(ai.finalAccuracy * 100)
  };
}

function offlineEvaluation(doc) {
  const made = doc.paragraphs.reduce((s, p) => s + p.corrections.length, 0);
  const approved = doc.paragraphs.filter(p => p.isApproved).length;
  return {
    source: 'offline',
    finalAccuracy: null,
    paragraphs: [],
    corrections: doc.paragraphs.flatMap(p => p.corrections.map(c => ({
      paragraphId: p.id, selectedText: c.selectedText, verdict: 'UNGRADED', explanationQuality: 0,
      comment: 'Offline mode: this correction could not be graded against the notes.'
    }))),
    unobservedClues: [],
    studyNext: [],
    verdict: `My dear Holmes, the archive is unreachable, so I cannot grade you against the source. I can only report that you made ${made} correction(s) and approved ${approved} of ${doc.paragraphs.length} paragraphs. Reconnect to Gemini for a full audit.`,
    scores: {
      teachingScore: null, correctionsMade: made, accurateCorrections: null, inaccurateCorrections: null,
      falsePositives: null, totalErrors: null, missedErrors: null, avgExplanation: null,
      watsonBefore: Math.round((doc.overallAccuracy ?? 0.5) * 100), watsonAfter: null
    }
  };
}

/* ---------- AI Tutor ---------- */

export async function moriartyTutorReply({ sourceText, inlineData, evaluation, doc, history, question }) {
  const systemInstruction = `You are Professor Moriarty acting as an expert tutor for Holmes (the user), who has just taught Dr. Watson from the source notes.
Be precise, authoritative and educational: cold wit is fine, condescension is not. Keep answers under ~150 words.
Ground every claim in the SOURCE NOTES. If the notes do not cover something, say so explicitly before adding general knowledge.
You may refer to Watson's mistakes and Holmes's missed errors from the evaluation to explain WHY a misconception is tempting.
Register: modern and technical. End with one short check-for-understanding question when it fits.`;

  const prompt = `SOURCE NOTES${sourceText ? ':\n' + sourceText : ' are attached as a document.'}

HOLMES'S EVALUATION SUMMARY:
Verdict: ${evaluation?.verdict || 'n/a'}
Missed errors: ${(evaluation?.paragraphs || []).flatMap(p => p.missedErrors).join('; ') || 'none recorded'}
Unobserved clues: ${(evaluation?.unobservedClues || []).map(c => c.text).join('; ') || 'none recorded'}

WATSON'S FINAL DOCUMENT:
${doc.paragraphs.map(p => p.content).join('\n\n')}

CONVERSATION:
${history.slice(-8).map(m => `${m.sender === 'user' ? 'HOLMES' : 'MORIARTY'}: ${m.text}`).join('\n')}

HOLMES ASKS: "${question}"`;

  try {
    const reply = await gemini.generateContent({ systemInstruction, prompt, inlineData, temperature: 0.4 });
    if (reply && reply.trim()) return reply.trim();
  } catch (err) {
    console.warn('[moriarty tutor] failed:', err.message);
  }
  return 'The archive is unreachable at the moment, Holmes. Check your Gemini connection and ask again.';
}
