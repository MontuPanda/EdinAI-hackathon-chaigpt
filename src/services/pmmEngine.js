/**
 * PROTÉGÉ: Plausible Misconceptions Matrix (PMM) & Case Generator Engine
 * Ingests user-uploaded study notes/textbook chapters, extracts canonical truths,
 * and dynamically seeds Dr. Watson's ~80% grasp draft in the exact technical language of the upload.
 */

import { gemini } from './gemini.js';

export async function generateCaseFromMaterial({ title, content, inlineData }) {
  if ((!content || content.trim().length < 15) && !inlineData) {
    throw new Error('Please provide study material (upload a document or paste at least 2-3 sentences).');
  }

  const systemInstruction = `You are an expert cognitive curriculum architect and pedagogical engine for an inverted student-teacher learning platform.
You are processing study notes/textbook chapters uploaded by a student mentor (Holmes).

### CORE PEDAGOGICAL DYNAMICS (CRUCIAL):
1. WHAT THE UPLOADED NOTES CONTAIN:
   The uploaded material contains the TARGET KNOWLEDGE — the breakthrough concepts, modern theorems, formulas, or counter-intuitive causal mechanisms that the student wants to teach.
2. WATSON'S COGNITIVE PROFILE (THE PUPIL):
   - Watson DOES NOT ALREADY KNOW the uploaded material!
   - Instead, Watson only possesses the PREREQUISITE BASELINE knowledge leading up to this topic.
   - He has enough foundational background so that the topic is NOT impossibly difficult to grasp, BUT he has not yet learned the new mechanisms in the uploaded document.
   - He relies on conventional intuition, common-sense heuristics, or classical/naive prior models.
   - As a result, when Watson attempts to analyze the problem, he naturally makes a fundamental conceptual error by assuming conventional logic applies where the new uploaded breakthrough is actually required!

### CRITICAL REGISTER & TONE RULE:
The application wrapper uses a Victorian 221B motif for UI branding (Holmes/Watson/Moriarty).
HOWEVER, all academic content, drafts, and dialogue MUST STRICTLY REFLECT the actual modern domain, terminology, and technical register of the uploaded material (e.g. undergraduate engineering, medical biochemistry, distributed systems).
DO NOT use archaic Victorian language (no "By Jove", "Good heavens", or 19th-century pastiche).
Watson speaks as an intelligent, contemporary university student / peer researcher (~45-50% initial grasp of this new topic).

### REQUIRED JSON SCHEMA:
Output valid, parseable JSON with the following exact keys:
{
  "id": "custom_case_${Date.now()}",
  "title": "${title ? title.replace(/"/g, '') : 'Extracted Topic'}",
  "category": "Domain Category (e.g. Computer Science, Physics, Medicine, Law)",
  "difficulty": "MODERATE" | "DIFFICULT",
  "initialMastery": 45,
  "targetMastery": 90,
  "prerequisiteFoundation": "1-2 sentences describing the background knowledge Watson already understands (the vocabulary that allows him to grasp the topic without knowing the uploaded breakthrough).",
  "activeBelief": "Watson's naive starting belief—how he tries to explain the problem using conventional intuition before being taught the uploaded material.",
  "canonicalAxioms": [
    "Axiom 1: The core breakthrough/truth from the uploaded notes that Watson does not yet know",
    "Axiom 2: The causal mechanism from the uploaded notes that disproves Watson's naive assumption",
    "Axiom 3: The key boundary condition or formula from the uploaded notes"
  ],
  "seededMisconceptions": [
    {
      "id": "seeded_trap_1",
      "concept": "The concept Watson naively misjudges",
      "errorText": "The exact sentence in Watson's draft where his naive/conventional logic breaks down",
      "explanation": "Why Watson's conventional assumption is false according to the uploaded notes, and what the correct mechanism is",
      "category": "CONCEPTUAL_FALLACY" | "BOUNDARY_CONDITION" | "CORRELATION_VS_CAUSATION"
    }
  ],
  "watsonInitialDraft": "A realistic 3-paragraph draft written from the perspective of an intelligent student who knows the prerequisites but has NOT learned the uploaded material yet. Paragraph 1: He outlines the problem using his foundational vocabulary. Paragraph 2: He applies conventional common-sense or outdated theory, asserting the naive misconception as fact. Paragraph 3: He draws a flawed conclusion based on that naive assumption, clearly needing to be taught the uploaded material.",
  "suggestedAnnotations": [
    {
      "targetPhrase": "Exact sentence in paragraph 2 where Watson's naive assumption is stated",
      "correction": "Short, sharp correction based on the uploaded notes explaining the true mechanism",
      "tag": "CONCEPTUAL_FALLACY"
    }
  ],
  "watsonDialogue": {
    "onLoad": "Watson introducing his draft, saying that using basic principles he deduced this explanation, but asking Holmes if his reasoning holds.",
    "onAudit": "Watson's surprised realization upon being marked in red, realizing his conventional model doesn't work, and asking Holmes how the new mechanism works.",
    "afterQuizSuccess": "Watson's authentic 'Aha!' moment understanding the uploaded concept for the first time, seeing why his old intuition failed.",
    "afterQuizFailure": "Watson explaining where he is still clinging to his intuitive model."
  },
  "remediationChallenge": {
    "lesson": "2-3 sentences from the uploaded notes explaining the new mechanism that cures Watson's naive model.",
    "question": "A diagnostic application scenario testing if Watson now understands the new concept from the uploaded material.",
    "correctAnswer": "The correct answer according to the uploaded notes.",
    "distractor1": "A distractor tempting Watson's original naive common-sense belief.",
    "distractor2": "A distractor confusing correlation with causation."
  },
  "moriartyDebrief": {
    "acuityScore": 90,
    "bloomLevel": 4.5,
    "verdict": "Moriarty's sharp review evaluating whether Holmes successfully brought Watson from his naive baseline into true comprehension of the uploaded notes.",
    "unobservedClues": "A subtle nuance from the uploaded material that Holmes should watch out for."
  }
}`;

  const promptText = content 
    ? `Analyze this uploaded study material and generate the complete Watson case:
TOPIC: ${title || 'Untitled Syllabus Topic'}
SOURCE MATERIAL:
${content}`
    : `Analyze the attached study document and generate the complete Watson case:
TOPIC: ${title || 'Attached Document Topic'}`;

  const rawJson = await gemini.generateContent({
    systemInstruction,
    prompt: promptText,
    inlineData,
    temperature: 0.3,
    jsonMode: true
  });

  if (!rawJson) {
    throw new Error('No response received from Gemini engine. Please check your API key.');
  }

  try {
    // Strip possible markdown fences if returned
    const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (parseErr) {
    console.error('Failed to parse Gemini PMM JSON:', rawJson);
    throw new Error('Failed to parse case structure from Gemini. Please try again.');
  }
}
