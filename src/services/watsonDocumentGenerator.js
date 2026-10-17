/**
 * PROTÉGÉ: Watson Document Generator Service
 * Generates Watson's initial understanding document from uploaded notes.
 * This document is hidden from the user and represents Watson's baseline
 * understanding with misconceptions based on general knowledge only.
 */

import { gemini } from './gemini.js';

/**
 * Generates Watson's initial document from source material
 * @param {Object} params - { title, content, inlineData }
 * @returns {Promise<Object>} WatsonDocument structure
 */
export async function generateWatsonDocument({ title, content, inlineData }) {
  if ((!content || content.trim().length < 15) && !inlineData) {
    throw new Error('Please provide study material (upload a document or paste at least 2-3 sentences).');
  }

  const systemInstruction = `You are Dr. John Watson, a bright student with general knowledge but NO domain-specific knowledge about this topic.

### CRITICAL KNOWLEDGE STATE:
- You have only general prerequisite knowledge and have NEVER studied this topic before
- Your initial understanding is low: about 20-30% of the source's important ideas
- You do NOT yet understand most domain-specific concepts, formulas, mechanisms, or boundary conditions
- You are reading these study notes for the very first time; the user is the person who will teach you

### YOUR TASK:
Write a coherent first attempt that gives the user many meaningful opportunities to teach you. Use the uploaded material as ground truth to create plausible beginner misunderstandings, not as content for an accurate summary.

### CRITICAL RULES:
1. Keep the draft substantially incomplete or incorrect about the uploaded topic; do not accurately restate most of its central ideas.
2. Include 1-2 distinct, substantial, correctable misunderstandings in each paragraph, for about 4-8 issues total.
3. Make every misunderstanding plausible for a beginner and specifically contradicted or corrected by the uploaded material. Do not invent absurd errors, unsupported facts, or fake quotations.
4. Preserve enough correct general background to make the draft coherent, but do not give away the source's key explanations or mechanisms.
5. Use only general knowledge and the uploaded material; do not rely on outside facts.
6. Write in the technical register of the domain (clean, modern language). DO NOT use archaic Victorian slang.
7. Structure as 3-5 clear paragraphs, with 2-4 sentences per paragraph. Each paragraph should cover one aspect of the topic.
8. Set overallAccuracy near 0.25 and each paragraph confidence between 0.2 and 0.35. The self-assessment should honestly say you are new to the material.

### OUTPUT SCHEMA:
Return valid JSON with this exact structure:
{
  "caseId": "custom_case_001",
  "title": "Document title based on topic",
  "sourceMaterialSummary": "1-2 sentence summary of what the notes covered",
  "paragraphs": [
    {
      "id": "p1",
      "content": "First paragraph explaining your understanding...",
      "topic": "What this paragraph discusses",
      "confidence": 0.6
    },
    {
      "id": "p2",
      "content": "Second paragraph...",
      "topic": "What this paragraph discusses",
      "confidence": 0.5
    }
  ],
  "overallAccuracy": 0.25,
  "selfAssessment": "Brief, honest note that you are new to the topic and unsure about its central ideas"
}

Return JSON only, no markdown fences, no preamble.`;

  const promptText = content
    ? `Read these study notes and write your understanding document:
TOPIC: ${title || 'Untitled Topic'}
SOURCE MATERIAL:
${content}`
    : `Read the attached document and write your understanding document:
TOPIC: ${title || 'Attached Document Topic'}`;

  let rawJson;
  try {
    rawJson = await gemini.generateContent({
      systemInstruction,
      prompt: promptText,
      inlineData,
      temperature: 0.4,
      jsonMode: true
    });
  } catch (err) {
    console.error('Watson document request failed:', err);
    throw new Error(`Watson document request failed: ${err.message}`);
  }

  if (!rawJson) {
    throw new Error('No response received from Gemini engine. Please check your API key.');
  }

  let document;
  try {
    // Strip possible markdown fences
    const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    document = JSON.parse(cleanJson);

    // Validate structure
    if (!document.paragraphs || !Array.isArray(document.paragraphs) || document.paragraphs.length === 0) {
      throw new Error('Invalid document structure: missing paragraphs array');
    }
  } catch (parseErr) {
    console.error('Failed to parse Watson document JSON:', rawJson);
    throw new Error(`Failed to parse Watson document response: ${parseErr.message}`);
  }

  // Add metadata
  document.createdAt = new Date().toISOString();
  document.paragraphs = document.paragraphs.map((paragraph, index) => ({
    ...paragraph,
    id: paragraph.id || `p${index + 1}`,
    isCorrected: false,
    corrections: [],
    confidence: paragraph.confidence || 0.5
  }));

  return document;
}

export async function applyTeachingToDocument({ document, teaching, currentParagraphIndex = 0 }) {
  const paragraphs = document.paragraphs.map((paragraph) => ({
    ...paragraph,
    corrections: [...(paragraph.corrections || [])],
    flaggedErrors: [...(paragraph.flaggedErrors || [])]
  }));

  const applyLocally = () => {
    const paragraph = paragraphs[currentParagraphIndex];
    if (!paragraph) return { paragraphs, flaggedErrors: [], teachingApplied: false, response: 'Which part of the topic should we work through next?' };

    paragraph.content = `${paragraph.content}\n\n${teaching}`;
    paragraph.confidence = Math.min((paragraph.confidence || 0.25) + 0.1, 0.95);
    paragraph.isCorrected = true;
    paragraph.corrections.push({
      selectedText: 'Teaching message',
      tag: 'TEACHING',
      userCorrection: teaching,
      timestamp: new Date().toISOString()
    });

    return {
      paragraphs,
      flaggedErrors: [],
      teachingApplied: true,
      response: 'I’ve kept your explanation in the paragraph, but could not identify an error automatically. Which part should I apply to another example?'
    };
  };

  const systemInstruction = `You are Watson, a beginner learning from the user. Analyze the user's latest chat message against the current document.

When the user identifies or explains an error, find the exact contiguous text in the existing paragraphs that is contradicted by their message, report it as a flagged error, and revise the relevant paragraph(s) immediately using the user's explanation. Preserve the user's important facts, terminology, examples, and level of detail. Do not ask the user to confirm or repeat a correction.

Only flag text that exists verbatim in the original paragraph and is actually corrected by the user's message. Do not flag an error when the user is only asking a question or sharing information without identifying a contradiction. In that case, leave paragraphs unchanged and answer conversationally. Keep unrelated paragraphs unchanged. Never invent facts. Return a concise response and exactly one relevant follow-up question.

Return JSON only in this shape:
{
  "flaggedErrors": [{ "paragraphId": "existing paragraph id", "text": "exact mistaken text from the original paragraph", "explanation": "Why the user's message corrects it" }],
  "updatedParagraphs": [{ "id": "existing paragraph id", "content": "updated paragraph", "confidence": 0.5 }],
  "reply": "Brief acknowledgement or conversational answer",
  "followUpQuestion": "One focused question?"
}`;

  const prompt = `Document title: ${document.title}

Current document paragraphs:
${JSON.stringify(paragraphs.map(({ id, topic, content }) => ({ id, topic, content })), null, 2)}

Previous user teaching:
${JSON.stringify(document.teachingNotes || [], null, 2)}

The user teaches you:
${teaching}

Rewrite only paragraphs that this teaching clarifies. Keep all paragraph IDs unchanged and include each changed paragraph once.`;

  try {
    const rawJson = await gemini.generateContent({
      systemInstruction,
      prompt,
      temperature: 0.3,
      jsonMode: true
    });

    if (!rawJson) return applyLocally();

    const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    const generatedQuestion = String(result.followUpQuestion || '').trim();
    const followUpQuestion = generatedQuestion.includes('?') ? generatedQuestion : 'What should I clarify or apply next?';
    const flaggedErrors = (Array.isArray(result.flaggedErrors) ? result.flaggedErrors : []).filter((error) => {
      const paragraph = paragraphs.find((item) => item.id === error.paragraphId);
      return paragraph && typeof error.text === 'string' && error.text.trim() && paragraph.content.includes(error.text);
    });

    if (!Array.isArray(result.updatedParagraphs) || result.updatedParagraphs.length === 0) {
      return {
        paragraphs,
        flaggedErrors: [],
        teachingApplied: false,
        response: [result.reply, followUpQuestion].filter(Boolean).join(' ')
      };
    }

    const updates = new Map(result.updatedParagraphs.map((paragraph) => [paragraph.id, paragraph]));
    let appliedCount = 0;
    const updatedParagraphs = paragraphs.map((paragraph) => {
      const update = updates.get(paragraph.id);
      if (!update || typeof update.content !== 'string' || !update.content.trim()) return paragraph;

      appliedCount++;
      const paragraphFlags = flaggedErrors.filter((error) => error.paragraphId === paragraph.id);
      const correctionEntries = paragraphFlags.length
        ? paragraphFlags.map((error) => ({
            selectedText: error.text,
            tag: 'CHAT_IDENTIFIED_ERROR',
            userCorrection: error.explanation || teaching,
            timestamp: new Date().toISOString()
          }))
        : [{
            selectedText: 'Teaching message',
            tag: 'TEACHING',
            userCorrection: teaching,
            timestamp: new Date().toISOString()
          }];

      return {
        ...paragraph,
        content: update.content,
        confidence: Number.isFinite(update.confidence) ? update.confidence : Math.min((paragraph.confidence || 0.25) + 0.1, 0.95),
        isCorrected: true,
        corrections: [...paragraph.corrections, ...correctionEntries],
        flaggedErrors: [...paragraph.flaggedErrors, ...paragraphFlags.map((error) => ({
          text: error.text,
          explanation: error.explanation || teaching,
          resolved: !update.content.includes(error.text)
        }))]
      };
    });

    if (!appliedCount) {
      return {
        paragraphs,
        flaggedErrors: [],
        teachingApplied: false,
        response: [result.reply, followUpQuestion].filter(Boolean).join(' ')
      };
    }

    const flagSummary = flaggedErrors.length
      ? `I flagged ${flaggedErrors.length} error${flaggedErrors.length === 1 ? '' : 's'} in the document and updated the relevant paragraph${flaggedErrors.length === 1 ? '' : 's'}.`
      : '';
    return {
      paragraphs: updatedParagraphs,
      flaggedErrors,
      teachingApplied: true,
      response: [result.reply, flagSummary, followUpQuestion].filter(Boolean).join(' ')
    };
  } catch (err) {
    console.warn('Watson document update failed, preserving teaching locally:', err.message);
    return applyLocally();
  }
}

/**
 * Updates a specific paragraph based on user's correction
 * @param {Object} params - { paragraph, selectedText, tag, userCorrection }
 * @returns {Promise<Object>} Updated paragraph with Watson's response
 */
export async function updateParagraphFromCorrection({ paragraph, selectedText, tag, userCorrection }) {
  const systemInstruction = `You are Dr. John Watson. You wrote this paragraph explaining a concept:

[PAST PARAGRAPH CONTENT]
${paragraph.content}

Your mentor (Holmes) has provided this correction:
- Selected text: "${selectedText}"
- Error type: ${tag}
- Correction: "${userCorrection}"

### YOUR TASK:
Rewrite the paragraph to incorporate this correction. Maintain your voice but apply the new understanding.
Preserve every important fact, explanation, and example the user supplied, even when the correction is long. Do not reduce a detailed correction to a vague summary or add claims that conflict with it. Correct the selected misconception and update related statements in this paragraph.

### OUTPUT SCHEMA:
Return valid JSON:
{
  "updatedContent": "The rewritten paragraph incorporating the correction",
  "learningApplied": "Brief note about what you learned from this correction",
  "confidence": 0.8,
  "explanation": "How the correction changed your understanding"
}

Return JSON only, no markdown fences.`;

  try {
    const rawJson = await gemini.generateContent({
      systemInstruction,
      prompt: '',
      temperature: 0.3,
      jsonMode: true
    });

    if (!rawJson) {
      // Fallback: return original paragraph with manual update
      return {
        updatedContent: paragraph.content.replace(selectedText, userCorrection),
        learningApplied: 'Applied correction manually',
        confidence: Math.min(paragraph.confidence + 0.1, 1.0),
        explanation: 'LLM unavailable, applied text replacement'
      };
    }

    const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.warn('Paragraph update failed, using fallback:', err.message);
    // Fallback: simple text replacement
    return {
      updatedContent: paragraph.content.replace(selectedText, userCorrection),
      learningApplied: 'Applied correction manually',
      confidence: Math.min(paragraph.confidence + 0.1, 1.0),
      explanation: 'LLM unavailable, applied text replacement'
    };
  }
}
