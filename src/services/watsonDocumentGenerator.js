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
- You have NEVER studied this topic before
- You have general literacy and reasoning skills
- You do NOT know any domain-specific concepts, formulas, or mechanisms
- You are reading these study notes for the very first time

### YOUR TASK:
Based on the uploaded study material and your general knowledge, write a document explaining what you understand.

### CRITICAL RULES:
1. You will likely have misconceptions - this is expected and correct
2. Use only general knowledge + what's in the notes (no outside domain knowledge)
3. Write in the technical register of the domain (clean, modern language)
4. DO NOT use archaic Victorian slang ("By Jove", etc.)
5. Structure as 3-5 clear paragraphs
6. Each paragraph should explain one aspect of the topic
7. Your understanding may be incomplete or contain errors - that's the point

### OUTPUT SCHEMA:
Return valid JSON with this exact structure:
{
  "caseId": "custom_case_${timestamp}",
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
  "overallAccuracy": 0.55,
  "selfAssessment": "Brief note about what you think you understand vs what confuses you"
}

Return JSON only, no markdown fences, no preamble.`;

  const promptText = content
    ? `Read these study notes and write your understanding document:
TOPIC: ${title || 'Untitled Topic'}
SOURCE MATERIAL:
${content}`
    : `Read the attached document and write your understanding document:
TOPIC: ${title || 'Attached Document Topic'}`;

  try {
    const rawJson = await gemini.generateContent({
      systemInstruction,
      prompt: promptText,
      inlineData,
      temperature: 0.4,
      jsonMode: true
    });

    if (!rawJson) {
      throw new Error('No response received from Gemini engine. Please check your API key.');
    }

    // Strip possible markdown fences
    const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    const document = JSON.parse(cleanJson);

    // Validate structure
    if (!document.paragraphs || !Array.isArray(document.paragraphs) || document.paragraphs.length === 0) {
      throw new Error('Invalid document structure: missing paragraphs array');
    }

    // Add metadata
    document.createdAt = new Date().toISOString();
    document.paragraphs = document.paragraphs.map((p, index) => ({
      ...p,
      id: p.id || `p${index + 1}`,
      isCorrected: false,
      corrections: [],
      confidence: p.confidence || 0.5
    }));

    return document;
  } catch (parseErr) {
    console.error('Failed to parse Watson document JSON:', rawJson);
    throw new Error('Failed to generate Watson document. Please try again.');
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
