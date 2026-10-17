/**
 * PROTÉGÉ: Moriarty Evaluation Service
 * Evaluates Watson's final document and the user's teaching quality.
 * Professor Moriarty acts as the expert proctor scoring both Watson's understanding
 * and Holmes's pedagogical effectiveness.
 */

import { gemini } from './gemini.js';

export function summarizeEvaluation({ recall = 0, falseAlarms = 0, noteQuality = 0, lessonAccurate = true, questionBloom = 0, distractorPlausibility = 0 } = {}) {
  const diagnosticRecall = Number(recall || 0);
  const lessonStatus = lessonAccurate ? 'accurate' : 'weak';

  let rubricStatus = 'weak';
  if (diagnosticRecall >= 0.6 && falseAlarms <= 1 && lessonAccurate && questionBloom >= 4 && distractorPlausibility >= 2) {
    rubricStatus = 'strong';
  } else if (diagnosticRecall >= 0.4 || lessonAccurate) {
    rubricStatus = 'mixed';
  }

  return {
    diagnosticRecall,
    falseAlarmCount: Number(falseAlarms || 0),
    noteQuality: Number(noteQuality || 0),
    lessonStatus,
    questionLevel: Number(questionBloom || 0),
    distractorScore: Number(distractorPlausibility || 0),
    rubricStatus
  };
}

export function buildTutorContext({ question, sourceMaterial, evaluation }) {
  const teachingEvaluation = evaluation?.userTeachingEvaluation || {};
  return [
    `User asks: "${question}"`,
    '',
    'Source material:',
    sourceMaterial || 'No source material provided.',
    '',
    'Latest Moriarty evaluation:',
    evaluation?.overallVerdict || 'No evaluation available yet.',
    teachingEvaluation.detailedFeedback || '',
    'Errors the user missed:',
    JSON.stringify(teachingEvaluation.missedErrors || [], null, 2)
  ].join('\n');
}

export function summarizeUserErrors({ annotations = [], flawedSentences = [], evaluation = {} } = {}) {
  const issues = [];
  const seen = new Set();

  const addIssue = (sentenceId, detail) => {
    const cleanDetail = String(detail || '').replace(/\s+/g, ' ').trim();
    if (!cleanDetail) return;

    const key = `${sentenceId || 'issue'}::${cleanDetail}`;
    if (seen.has(key)) return;

    seen.add(key);
    issues.push(cleanDetail);
  };

  (annotations || []).forEach((annotation) => {
    const sentenceId = annotation.sentence_id || annotation.id || 'issue';
    const detail = annotation.note || annotation.userCorrection || annotation.reason || annotation.explanation || annotation.text;
    addIssue(sentenceId, detail);
  });

  if (issues.length) {
    return issues.slice(0, 4);
  }

  (flawedSentences || []).forEach((sentence, index) => {
    if (issues.length >= 4) return;

    const sentenceId = sentence.id || sentence.sentence_id || `sentence-${index + 1}`;
    const detail = sentence.error || sentence.reason || sentence.note || sentence.explanation || sentence.errorText || sentence.text;
    addIssue(sentenceId, detail);
  });

  if (!issues.length && evaluation?.userTeachingEvaluation?.missedErrors) {
    const missed = Number(evaluation.userTeachingEvaluation.missedErrors || 0);
    if (missed > 0) {
      issues.push(`Missed errors: ${missed} important points were not flagged.`);
    }
  }

  return issues.slice(0, 4);
}

/**
 * Evaluates Watson's final document and user's teaching
 * @param {Object} params - { watsonDocument, sourceMaterial }
 * @returns {Promise<Object>} MoriartyEvaluation
 */
export async function evaluateWatsonDocument({ watsonDocument, sourceMaterial, inlineData }) {
  const systemInstruction = `You are an expert, plain-spoken evaluator. Compare Watson's understanding with the uploaded source and assess which user corrections were accurate.

### YOUR TASK:
Evaluate Watson's original document, the user's teaching and corrections, and Watson's final document.

### WHAT YOU KNOW:
1. The original study material (ground truth)
2. Watson's final document (after all corrections)
3. All corrections Holmes provided

### EVALUATION CRITERIA:
1. Compare every factual claim in Watson's original paragraphs with the uploaded source.
2. For each distinct false, unsupported, or materially incomplete claim, check whether the user's corrections or chat teaching addressed it.
3. Include EVERY distinct issue the user did not correct in missedErrors. Do not cap the list or merge unrelated errors. Identify Watson's original claim, state the source-grounded correction, identify its paragraph where possible, and briefly explain significance.
4. Do not call a claim missed if the user corrected it elsewhere in the conversation or teaching notes. Do not invent errors when the source does not support a clear conclusion.
5. Report false positives separately: user corrections that contradict the uploaded source.
6. Distinguish errors missed by the user from misconceptions still present in Watson's final document.

### OUTPUT SCHEMA:
Return valid JSON:
{
  "watsonFinalDocument": {
    "overallAccuracy": 0.85,
    "remainingMisconceptions": [
      {
        "paragraphId": "p3",
        "error": "Description of remaining error",
        "severity": "SUBTLE"
      }
    ]
  },
  "userTeachingEvaluation": {
    "correctionsMade": 5,
    "accurateCorrections": 4,
    "falsePositives": 1,
    "missedErrors": [
      {
        "paragraphId": "p2",
        "claim": "Watson's original incorrect or incomplete claim",
        "correctUnderstanding": "What the uploaded source says instead",
        "whyItMatters": "Why this distinction matters",
        "severity": "major | moderate | minor"
      }
    ],
    "missedErrorCount": 1,
    "teachingQuality": 0.75,
    "detailedFeedback": "Detailed explanation of teaching quality..."
  },
  "overallVerdict": "Concise, plain-language assessment",
  "monologue": "Concise plain-language explanation of the main finding"
}

Return JSON only, no markdown fences.`;

  // Build context
  const correctionsList = watsonDocument.paragraphs.flatMap(p =>
    p.corrections.map(c => ({
      paragraphId: p.id,
      selectedText: c.selectedText,
      tag: c.tag,
      userCorrection: c.userCorrection
    }))
  );

  const finalDocument = watsonDocument.paragraphs.map(p => ({
    id: p.id,
    topic: p.topic,
    content: p.content,
    confidence: p.confidence
  }));
  const initialDocument = watsonDocument.initialParagraphs || finalDocument;

  const prompt = `
STUDY MATERIAL (Ground Truth):
${sourceMaterial}

WATSON'S FINAL DOCUMENT:
${JSON.stringify(finalDocument, null, 2)}

WATSON'S ORIGINAL DOCUMENT BEFORE ANY CORRECTIONS:
${JSON.stringify(initialDocument, null, 2)}

USER'S CORRECTIONS AND CHAT TEACHING:
${JSON.stringify(correctionsList, null, 2)}
${JSON.stringify(watsonDocument.teachingNotes || [], null, 2)}

WATSON'S SELF-ASSESSMENT:
${watsonDocument.selfAssessment}

Evaluate both Watson's final understanding and Holmes's teaching effectiveness.`;

  try {
    const rawJson = await gemini.generateContent({
      systemInstruction,
      prompt,
      inlineData,
      temperature: 0.3,
      jsonMode: true
    });

    if (!rawJson) {
      throw new Error('No response from Moriarty');
    }

    const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    const evaluation = JSON.parse(cleanJson);

    const teachingEvaluation = evaluation.userTeachingEvaluation || {};
    if (Array.isArray(teachingEvaluation.missedErrors)) {
      teachingEvaluation.missedErrorCount = teachingEvaluation.missedErrors.length;
    } else {
      teachingEvaluation.missedErrors = [];
      teachingEvaluation.missedErrorCount = Number(teachingEvaluation.missedErrorCount || 0);
      teachingEvaluation.analysisAvailable = false;
    }
    evaluation.userTeachingEvaluation = teachingEvaluation;

    // Add metadata
    evaluation.session = {
      caseId: watsonDocument.caseId,
      totalParagraphs: watsonDocument.paragraphs.length,
      paragraphsReviewed: watsonDocument.paragraphs.filter(p => p.isCorrected || p.isApproved).length,
      totalCorrections: correctionsList.length
    };

    return evaluation;
  } catch (err) {
    console.error('Moriarty evaluation failed:', err);
    // Fallback evaluation
    return generateFallbackEvaluation(watsonDocument, correctionsList);
  }
}

function generateFallbackEvaluation(watsonDocument, correctionsList) {
  const avgConfidence = watsonDocument.paragraphs.reduce((sum, p) => sum + p.confidence, 0) / watsonDocument.paragraphs.length;

  return {
    session: {
      caseId: watsonDocument.caseId,
      totalParagraphs: watsonDocument.paragraphs.length,
      paragraphsReviewed: watsonDocument.paragraphs.filter(p => p.isCorrected || p.isApproved).length,
      totalCorrections: correctionsList.length
    },
    watsonFinalDocument: {
      overallAccuracy: avgConfidence,
      remainingMisconceptions: []
    },
    userTeachingEvaluation: {
      correctionsMade: correctionsList.length,
      accurateCorrections: correctionsList.length,
      falsePositives: 0,
      missedErrors: [],
      missedErrorCount: 0,
      analysisAvailable: false,
      teachingQuality: avgConfidence,
      detailedFeedback: `Detailed source comparison was unavailable. Watson's average confidence is ${Math.round(avgConfidence * 100)}%.`
    },
    overallVerdict: 'Detailed source comparison is unavailable. This report only includes confidence-based scoring.',
    monologue: 'A source-grounded review could not be completed.'
  };
}

/**
 * Moriarty acts as AI tutor for user questions
 * @param {Object} params - { question, watsonDocument, sourceMaterial, evaluation }
 * @returns {Promise<string>} Moriarty's response
 */
export async function askMoriartyTutor({ question, watsonDocument, sourceMaterial, evaluation }) {
  const systemInstruction = `You are Professor Moriarty, an expert tutor with complete knowledge of the subject matter.
You are helping Sherlock Holmes (the user) clarify his own understanding.

### YOUR KNOWLEDGE:
- The complete study material (ground truth)
- Watson's final document
- Your evaluation of Holmes's teaching

### YOUR ROLE:
Answer Holmes's questions with precision and authority. Be educational, direct, and concise.
Reference the source material when helpful. Avoid theatrical language and stay plain and professional.

Respond in 2-4 sentences unless a longer explanation is clearly needed.`;

  const prompt = `
STUDY MATERIAL:
${sourceMaterial}

WATSON'S FINAL DOCUMENT:
${watsonDocument.paragraphs.map(p => p.content).join('\n\n')}

MY EVALUATION OF YOUR TEACHING:
${evaluation.detailedFeedback}

Holmes asks: "${question}"

Answer his question.`;

  try {
    const response = await gemini.generateContent({
      systemInstruction,
      prompt,
      temperature: 0.4
    });

    return response || 'I am unable to provide guidance at this moment.';
  } catch (err) {
    console.error('Moriarty tutor failed:', err);
    return 'I cannot answer that question at the moment. Please rephrase it or try again later.';
  }
}
