import test from 'node:test';
import assert from 'node:assert/strict';

import { gemini } from '../src/services/gemini.js';
import { evaluateWatsonDocument, summarizeEvaluation, buildTutorContext, summarizeUserErrors } from '../src/services/moriartyEvaluator.js';

test('summarizeEvaluation computes dossier-style metrics', () => {
  const summary = summarizeEvaluation({
    recall: 0.67,
    falseAlarms: 1,
    noteQuality: 2.5,
    lessonAccurate: true,
    questionBloom: 4,
    distractorPlausibility: 2.4
  });

  assert.equal(summary.diagnosticRecall, 0.67);
  assert.equal(summary.falseAlarmCount, 1);
  assert.equal(summary.lessonStatus, 'accurate');
  assert.equal(summary.questionLevel, 4);
  assert.equal(summary.rubricStatus, 'strong');
});

test('buildTutorContext includes the user question and the source material', () => {
  const context = buildTutorContext({
    question: 'How should I explain orbital mechanics to Watson?',
    sourceMaterial: 'Gravity still acts in orbit.',
    evaluation: {
      overallVerdict: 'Solid teaching.',
      userTeachingEvaluation: {
        detailedFeedback: 'One misconception remains.',
        missedErrors: [{ claim: 'Gravity disappears in orbit.' }]
      }
    }
  });

  assert.match(context, /How should I explain orbital mechanics to Watson\?/);
  assert.match(context, /Gravity still acts in orbit\./);
  assert.match(context, /Solid teaching\./);
  assert.match(context, /One misconception remains\./);
  assert.match(context, /Gravity disappears in orbit\./);
});

test('summarizeUserErrors lists the user’s mistakes in plain language', () => {
  const summary = summarizeUserErrors({
    annotations: [
      { sentence_id: 's2', note: 'Gravity is still about 90% at orbit.' },
      { sentence_id: 's8', note: 'Mass changes orbital period.' }
    ],
    flawedSentences: [
      { id: 's2', text: 'Gravity is almost zero in orbit.' },
      { id: 's8', text: 'A heavier satellite orbits more slowly.' },
      { id: 's9', text: 'The orbital period is unaffected by mass.' }
    ]
  });

  assert.equal(summary.length, 2);
  assert.doesNotMatch(summary[0], /s2/);
  assert.match(summary[0], /gravity/i);
  assert.doesNotMatch(summary[1], /s8/);
});

test('evaluateWatsonDocument compares the uploaded source, original draft, and corrections', async () => {
  const originalGenerateContent = gemini.generateContent;
  let request;
  gemini.generateContent = async (generationRequest) => {
    request = generationRequest;
    return JSON.stringify({
      watsonFinalDocument: { overallAccuracy: 0.7, remainingMisconceptions: [] },
      userTeachingEvaluation: {
        correctionsMade: 1,
        accurateCorrections: 1,
        falsePositives: 0,
        missedErrors: [{
          paragraphId: 'p1',
          claim: 'Gravity disappears in orbit.',
          correctUnderstanding: 'Gravity remains significant in orbit.',
          whyItMatters: 'It explains orbital freefall.',
          severity: 'major'
        }],
        detailedFeedback: 'One error was missed.'
      },
      overallVerdict: 'One misconception remains.'
    });
  };

  try {
    const evaluation = await evaluateWatsonDocument({
      sourceMaterial: 'Gravity remains significant in orbit.',
      watsonDocument: {
        title: 'Orbital freefall',
        initialParagraphs: [{ id: 'p1', content: 'Gravity disappears in orbit.' }],
        paragraphs: [{ id: 'p1', content: 'Gravity is weak in orbit.', confidence: 0.7, corrections: [{ selectedText: 'Gravity disappears', userCorrection: 'Gravity remains.' }] }],
        teachingNotes: ['Gravity remains significant in orbit.']
      }
    });

    assert.match(request.prompt, /Gravity remains significant in orbit/);
    assert.match(request.prompt, /Gravity disappears in orbit/);
    assert.match(request.prompt, /Gravity remains\./);
    assert.equal(evaluation.userTeachingEvaluation.missedErrors.length, 1);
    assert.equal(evaluation.userTeachingEvaluation.missedErrorCount, 1);
  } finally {
    gemini.generateContent = originalGenerateContent;
  }
});
