# Architecture Plan: Paragraph-Based Reverse Teaching Workflow

## Overview
Redesign the PROTÉGÉ platform to use a paragraph-by-paragraph review workflow where Watson learns from user corrections, and Moriarty evaluates both Watson's final understanding and the user's teaching effectiveness.

---

## Current Architecture vs. New Architecture

### Current Flow (v1-inspired)
1. User uploads notes → Watson generates draft with seeded misconceptions
2. User sees full draft → applies Red Pen annotations
3. User creates quiz → Watson takes quiz
4. Moriarty evaluates the session

### New Flow (Proposed)
1. User uploads notes → Watson generates hidden document (backend-only)
2. User sees **one paragraph at a time** → corrects it
3. Watson updates that paragraph based on corrections
4. Repeat until all paragraphs reviewed
5. Moriarty evaluates Watson's final document vs. ground truth
6. Moriarty acts as AI tutor for user's questions

---

## Key Components

### 1. Watson's Knowledge State

**Current:**
- Baseline: ~50-80% domain knowledge
- Knows prerequisites, holds specific misconceptions
- Domain-specific mental model

**New:**
- Baseline: **General knowledge only**
  - Literacy, basic reasoning skills
  - No domain-specific knowledge
  - No prior understanding of the topic
- Learns ONLY from:
  - Uploaded notes (first exposure)
  - User's corrections (learning through teaching)
- Mental model evolves as user corrects his document

**Implementation:**
```javascript
// New Watson state structure
const watsonState = {
  baselineKnowledge: 'general', // 'general' | 'domain_specific'
  currentUnderstanding: [], // Array of paragraphs representing his mental model
  learningHistory: [], // Track what he learned from each correction
  paragraphProgress: 0 // Which paragraph he's currently on
};
```

---

### 2. Backend Document Generation

**Purpose:**
- Watson ingests the uploaded notes
- Creates his own interpretation (hidden from user)
- This represents his initial understanding with misconceptions
- Stored in backend state, not displayed initially

**Process:**
1. User uploads notes (text, PDF, or paste)
2. System prompts Watson (LLM) to read and understand
3. Watson generates a document explaining the topic in his own words
4. Document is broken into paragraphs (3-5 paragraphs total)
5. Each paragraph stored separately in backend state
6. User sees paragraphs one at a time

**Data Structure:**
```javascript
// Watson's hidden document
const watsonDocument = {
  caseId: 'case_001',
  sourceMaterial: 'uploaded notes content',
  paragraphs: [
    {
      id: 'p1',
      content: 'Watson's initial understanding paragraph 1...',
      isCorrected: false,
      corrections: [],
      confidence: 0.6 // How confident Watson is
    },
    {
      id: 'p2',
      content: 'Watson's initial understanding paragraph 2...',
      isCorrected: false,
      corrections: [],
      confidence: 0.5
    }
  ],
  overallAccuracy: 0.55 // Estimated based on self-evaluation
};
```

**LLM Prompt for Document Generation:**
```markdown
You are Dr. John Watson, a bright student with general knowledge but NO domain-specific knowledge about this topic.

You have just read these study notes for the first time. Based on your general knowledge and common-sense reasoning, write a document explaining what you understand.

CRITICAL RULES:
- You have NEVER studied this topic before
- Use only general knowledge + what's in the notes
- You will likely have misconceptions - that's expected
- Write in the technical register of the domain (no Victorian slang)
- Structure as 3-5 clear paragraphs

Return JSON with paragraphs array.
```

---

### 3. Paragraph-by-Paragraph Review Workflow

**UI Flow:**
```
[Paragraph 1 of 4]
Watson says: "Orbital mechanics works because satellites need constant thrust to stay up..."

User actions:
- Red Pen: Select text → tag error → provide correction
- Approve paragraph: "This looks correct"
- Skip: "Move to next paragraph"

Once approved/corrected:
- Watson's internal document is updated
- User sees paragraph 2
- Progress bar: [█░░░] 25% complete
```

**State Machine:**
```javascript
const reviewState = {
  currentParagraphIndex: 0,
  totalParagraphs: 4,
  completedParagraphs: [],
  pendingCorrections: []
};
```

**UI Components:**
- Paragraph display area (showing current paragraph only)
- Red Pen toolbar (same as current, but applied to single paragraph)
- Navigation buttons: "Previous Paragraph" | "Next Paragraph"
- Progress indicator: "Paragraph 2 of 4"
- Approve button: "Mark as Correct"

---

### 4. Paragraph Update System

**When User Provides Correction:**
1. User selects text in current paragraph
2. Tags error (Conceptual Fallacy, Boundary Condition, etc.)
3. Provides correction text
4. Watson processes the correction:
   - Updates his internal understanding
   - Rewrites the paragraph incorporating the correction
   - Shows the updated paragraph to user
5. User can approve the updated version or provide more corrections

**Data Flow:**
```javascript
// User submits correction
{
  paragraphId: 'p1',
  selectedText: 'satellites need constant thrust',
  tag: 'CONCEPTUAL_FALLACY',
  correction: 'Satellites stay in orbit due to tangential velocity, not thrust'
}

// Watson's response
{
  paragraphId: 'p1',
  originalContent: '...',
  updatedContent: 'Satellites maintain orbit through tangential velocity...',
  learningApplied: 'Now understands orbital mechanics',
  confidence: 0.8 // Increased
}
```

**LLM Prompt for Paragraph Update:**
```markdown
You are Dr. John Watson. You wrote this paragraph explaining a concept:

[PAST PARAGRAPH CONTENT]

Your mentor (Holmes) has provided this correction:
[USER'S CORRECTION]

Rewrite the paragraph to incorporate this correction. Maintain your voice but apply the new understanding.

Return the updated paragraph text and a brief note about what you learned.
```

---

### 5. Moriarty Evaluation (Redesigned)

**What Moriarty Evaluates:**
1. **Watson's Final Document**
   - Compare Watson's final understanding against ground truth (from uploaded notes)
   - Score overall accuracy
   - Identify remaining misconceptions

2. **User's Corrections**
   - Were user's corrections accurate?
   - Did user miss any errors?
   - Did user flag correct statements as errors (false positives)?
   - Quality of explanations provided

**New Moriarty Dossier Structure:**
```javascript
const moriartyEvaluation = {
  session: {
    caseId: 'case_001',
    totalParagraphs: 4,
    paragraphsReviewed: 4
  },

  watsonFinalDocument: {
    overallAccuracy: 0.85, // 85% accurate based on ground truth
    remainingMisconceptions: [
      {
        paragraphId: 'p3',
        error: '...',
        severity: 'SUBTLE'
      }
    ]
  },

  userTeachingEvaluation: {
    correctionsMade: 5,
    accurateCorrections: 4,
    falsePositives: 1,
    missedErrors: 2,
    teachingQuality: 0.75, // 75% effective
    detailedFeedback: "You corrected the major misconception about orbital thrust, but missed the subtle error about..."
  },

  overallVerdict: "Your teaching significantly improved Watson's understanding, but some gaps remain..."
};
```

**Moriarty's Scoring Logic:**
```
User Teaching Score =
  (Accurate Corrections / Total Corrections) × 40% +
  (1 - False Positives / Total Corrections) × 30% +
  (1 - Missed Errors / Total Errors in Document) × 30%
```

---

### 6. Moriarty as AI Tutor (New Feature)

**Purpose:**
- After reviewing the dossier, user can ask Moriarty questions
- Moriarty acts as a traditional AI tutor
- Helps user clarify their own understanding

**Implementation:**
- Add chat interface after dossier
- Moriarty uses the full ground truth (uploaded notes)
- Can explain concepts, answer questions, provide examples

**UI Flow:**
```
[Dossier View]
[Ask Moriarty a Question] button → Opens chat

User: "Why did Watson think satellites need thrust?"
Moriarty: "That's a common misconception. The truth is..."
```

**LLM Prompt for Moriarty Tutor:**
```markdown
You are Professor Moriarty, an expert tutor. You have full knowledge of the study material:

[UPLOADED NOTES CONTENT]

You also know Watson's final understanding and the user's corrections:
[WATSON FINAL DOC]
[USER CORRECTIONS]

Answer the user's question. Be precise, authoritative, and educational. Reference the source material when helpful.
```

---

## Data Schema Changes

### New Schema: WatsonDocument
```javascript
{
  "caseId": "string",
  "sourceMaterial": "string",
  "createdAt": "timestamp",
  "paragraphs": [
    {
      "id": "p1",
      "content": "string",
      "isCorrected": "boolean",
      "corrections": [
        {
          "selectedText": "string",
          "tag": "string",
          "userCorrection": "string",
          "watsonResponse": "string"
        }
      ],
      "confidence": "number (0-1)"
    }
  ],
  "overallAccuracy": "number (0-1)"
}
```

### New Schema: MoriartyEvaluation
```javascript
{
  "session": {
    "caseId": "string",
    "totalParagraphs": "number",
    "paragraphsReviewed": "number"
  },
  "watsonFinalDocument": {
    "overallAccuracy": "number",
    "remainingMisconceptions": [...]
  },
  "userTeachingEvaluation": {
    "correctionsMade": "number",
    "accurateCorrections": "number",
    "falsePositives": "number",
    "missedErrors": "number",
    "teachingQuality": "number",
    "detailedFeedback": "string"
  },
  "overallVerdict": "string"
}
```

---

## Implementation Phases

### Phase 1: Backend Document Generation
- Create Watson document generation service
- Break notes into paragraphs
- Store in new data structure
- Test with sample notes

### Phase 2: Paragraph-by-Paragraph UI
- Redesign canvas to show one paragraph
- Add navigation controls
- Add progress indicator
- Integrate with existing Red Pen

### Phase 3: Paragraph Update System
- Implement correction processing
- Add Watson's paragraph rewrite logic
- Update internal state
- Show updated paragraph to user

### Phase 4: Moriarty Redesign
- Redesign evaluation logic
- Compare Watson's doc vs ground truth
- Score user's corrections
- Update dossier UI

### Phase 5: Moriarty Tutor Mode
- Add chat interface after dossier
- Implement tutor prompt
- Test with user questions

### Phase 6: Integration & Testing
- End-to-end workflow testing
- Update existing presets to new schema
- Remove old workflow code
- Polish UI

---

## Migration Notes

### Presets.js Changes
- Need to update existing presets to include `watsonDocument` structure
- Remove static `watsonInitialDraft` (now generated dynamically)
- Keep for now, migrate gradually

### Breaking Changes
- Old state machine (PHASE_1, PHASE_2, etc.) → New state machine
- Old Moriarty schema → New evaluation schema
- Current case structure → New document structure

### Backward Compatibility
- Keep old code behind feature flag during migration
- Test both workflows during transition
- Remove old code after validation

---

## Technical Considerations

### LLM Call Optimization
- Document generation: One call on ingestion
- Paragraph updates: One call per correction
- Moriarty evaluation: One call after all paragraphs reviewed
- Moriarty tutor: One call per question

### State Persistence
- Save Watson's document to localStorage
- Allow resuming mid-session
- Track paragraph progress

### Error Handling
- Fallback to cached paragraph if LLM fails
- Graceful degradation if Watson can't rewrite
- Clear error messages for user

---

## Success Criteria

1. Watson starts with general knowledge only
2. User sees one paragraph at a time
3. Corrections update Watson's internal document
4. Moriarty evaluates both Watson's final doc and user's teaching
5. User can ask Moriarty questions after dossier
6. Auto git push on approved changes
7. Manifest tab hidden (testing only)
