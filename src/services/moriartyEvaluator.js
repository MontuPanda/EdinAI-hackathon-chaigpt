/**
 * PROTÉGÉ: Moriarty Evaluation Service
 * Evaluates Watson's final document and the user's teaching quality.
 * Professor Moriarty acts as the expert proctor scoring both Watson's understanding
 * and Holmes's pedagogical effectiveness.
 */

import { gemini } from './gemini.js';

/**
 * Evaluates Watson's final document and user's teaching
 * @param {Object} params - { watsonDocument, sourceMaterial }
 * @returns {Promise<Object>} MoriartyEvaluation
 */
export async function evaluateWatsonDocument({ watsonDocument, sourceMaterial }) {
  const systemInstruction = `You are Professor James Moriarty, a mathematical genius and expert evaluator with complete knowledge of the subject matter.

### YOUR TASK:
Evaluate Dr. Watson's final document and Sherlock Holmes's teaching effectiveness.

### WHAT YOU KNOW:
1. The original study material (ground truth)
2. Watson's final document (after all corrections)
3. All corrections Holmes provided

### EVALUATION CRITERIA:
1. Watson's Final Document Accuracy:
   - How accurately does Watson's final document reflect the ground truth?
   - Are there remaining misconceptions?
   - What's the overall accuracy percentage?

2. Holmes's Teaching Quality:
   - Were Holmes's corrections accurate?
   - Did Holmes miss any errors?
   - Did Holmes flag correct statements as errors (false positives)?
   - How effective was the teaching?

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
    "missedErrors": 2,
    "teachingQuality": 0.75,
    "detailedFeedback": "Detailed explanation of teaching quality..."
  },
  "overallVerdict": "Overall assessment in Moriarty's voice",
  "monologue": "~150 word monologue addressing Holmes directly"
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

  const prompt = `
STUDY MATERIAL (Ground Truth):
${sourceMaterial}

WATSON'S FINAL DOCUMENT:
${JSON.stringify(finalDocument, null, 2)}

HOLMES'S CORRECTIONS:
${JSON.stringify(correctionsList, null, 2)}

WATSON'S SELF-ASSESSMENT:
${watsonDocument.selfAssessment}

Evaluate both Watson's final understanding and Holmes's teaching effectiveness.`;

  try {
    const rawJson = await gemini.generateContent({
      systemInstruction,
      prompt,
      temperature: 0.3,
      jsonMode: true
    });

    if (!rawJson) {
      throw new Error('No response from Moriarty');
    }

    const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    const evaluation = JSON.parse(cleanJson);

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
      missedErrors: 0,
      teachingQuality: avgConfidence,
      detailedFeedback: `Holmes provided ${correctionsList.length} corrections. Watson's average confidence is ${Math.round(avgConfidence * 100)}%.`
    },
    overallVerdict: 'LLM evaluation unavailable. Using confidence-based scoring.',
    monologue: `My dear Holmes, you provided ${correctionsList.length} corrections to Watson. His confidence level is now ${Math.round(avgConfidence * 100)}%. I would need more context to give a full evaluation.`
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
Answer Holmes's questions with precision and authority. Be educational but concise.
Reference the source material when helpful. Maintain your character: cold, precise, intellectually admiring.

Respond in 1-3 sentences unless a longer explanation is clearly needed.`;

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
    return 'My apologies, Holmes. I am currently unable to assist with your question.';
  }
}
