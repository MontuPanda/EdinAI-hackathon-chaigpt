import test from 'node:test';
import assert from 'node:assert/strict';

import { gemini } from '../src/services/gemini.js';
import { applyTeachingToDocument, generateWatsonDocument } from '../src/services/watsonDocumentGenerator.js';

test('generation failures preserve the Gemini error instead of referencing rawJson', async () => {
  const originalGenerateContent = gemini.generateContent;
  gemini.generateContent = async () => {
    throw new Error('network unavailable');
  };

  try {
    await assert.rejects(
      generateWatsonDocument({ title: 'Test topic', content: 'This is enough source material for the test.' }),
      (error) => {
        assert.match(error.message, /Watson document request failed: network unavailable/);
        assert.doesNotMatch(error.message, /rawJson/);
        return true;
      }
    );
  } finally {
    gemini.generateContent = originalGenerateContent;
  }
});

test('Watson generation requests a novice draft with multiple source-grounded errors', async () => {
  const originalGenerateContent = gemini.generateContent;
  let generationRequest;
  gemini.generateContent = async (request) => {
    generationRequest = request;
    return JSON.stringify({
      title: 'Test topic',
      overallAccuracy: 0.25,
      selfAssessment: 'I am new to this topic.',
      paragraphs: [{ content: 'A beginner explanation.', confidence: 0.25 }]
    });
  };

  try {
    const document = await generateWatsonDocument({
      title: 'Test topic',
      content: 'This is enough source material for the test.'
    });

    assert.match(generationRequest.systemInstruction, /20-30%/);
    assert.match(generationRequest.systemInstruction, /4-8 issues total/);
    assert.match(generationRequest.systemInstruction, /contradicted or corrected by the uploaded material/);
    assert.equal(document.overallAccuracy, 0.25);
  } finally {
    gemini.generateContent = originalGenerateContent;
  }
});

test('chat teaching updates document paragraphs and returns a follow-up question', async () => {
  const originalGenerateContent = gemini.generateContent;
  let generationRequest;
  gemini.generateContent = async (request) => {
    generationRequest = request;
    return JSON.stringify({
      flaggedErrors: [{ paragraphId: 'p1', text: 'An incorrect explanation.', explanation: 'The user corrected this claim.' }],
      updatedParagraphs: [{ id: 'p1', content: 'The corrected explanation includes the user’s details.', confidence: 0.7 }],
      reply: 'I added the corrected explanation.',
      followUpQuestion: 'How does this principle apply to a second case?'
    });
  };

  try {
    const result = await applyTeachingToDocument({
      document: {
        title: 'Test topic',
        teachingNotes: ['The first principle is conservation of energy.'],
        paragraphs: [{ id: 'p1', topic: 'Core idea', content: 'An incorrect explanation.', confidence: 0.25, corrections: [] }]
      },
      teaching: 'The mechanism depends on the boundary condition.',
      currentParagraphIndex: 0
    });

    assert.match(generationRequest.prompt, /The mechanism depends on the boundary condition/);
    assert.match(generationRequest.prompt, /The first principle is conservation of energy/);
    assert.equal(result.paragraphs[0].content, 'The corrected explanation includes the user’s details.');
    assert.match(result.response, /How does this principle apply to a second case\?/);
    assert.equal(result.flaggedErrors[0].text, 'An incorrect explanation.');
    assert.equal(result.paragraphs[0].corrections[0].tag, 'CHAT_IDENTIFIED_ERROR');
    assert.equal(result.paragraphs[0].flaggedErrors[0].resolved, true);
  } finally {
    gemini.generateContent = originalGenerateContent;
  }
});

test('chat teaching keeps Watson Socratic when the model omits its question', async () => {
  const originalGenerateContent = gemini.generateContent;
  gemini.generateContent = async () => JSON.stringify({
    updatedParagraphs: [{ id: 'p1', content: 'Updated paragraph.', confidence: 0.6 }],
    reply: 'I updated the paragraph.'
  });

  try {
    const result = await applyTeachingToDocument({
      document: {
        title: 'Test topic',
        paragraphs: [{ id: 'p1', content: 'Original paragraph.', confidence: 0.25, corrections: [] }]
      },
      teaching: 'The new explanation.',
      currentParagraphIndex: 0
    });

    assert.match(result.response, /\?/);
  } finally {
    gemini.generateContent = originalGenerateContent;
  }
});

test('chat questions do not alter paragraphs or get saved as teaching', async () => {
  const originalGenerateContent = gemini.generateContent;
  gemini.generateContent = async () => JSON.stringify({
    flaggedErrors: [],
    updatedParagraphs: [],
    reply: 'I am not sure about that yet.',
    followUpQuestion: 'Can you explain the key idea?'
  });

  try {
    const result = await applyTeachingToDocument({
      document: {
        title: 'Test topic',
        paragraphs: [{ id: 'p1', content: 'Original paragraph.', confidence: 0.25, corrections: [] }]
      },
      teaching: 'Why does the process work this way?',
      currentParagraphIndex: 0
    });

    assert.equal(result.paragraphs[0].content, 'Original paragraph.');
    assert.equal(result.teachingApplied, false);
    assert.match(result.response, /Can you explain the key idea\?/);
  } finally {
    gemini.generateContent = originalGenerateContent;
  }
});