# 🕵️‍♂️ PROJECT SPECIFICATION: THE 221B PARADIGM
## "Protégé" — The Inverted Pedagogy Platform
*(Codename: The Sherlock-Watson-Moriarty Triad)*

---

## 1. Executive Concept & The Triadic Architecture

> *"You see, Watson, but you do not observe."* — Sherlock Holmes  
> *"It is a capital mistake to theorize before one has data."*

In traditional educational software, an AI tutor instructs a passive human student. **Protégé flips this dynamic on its head.**

- **The User (You):** Plays the role of **Sherlock Holmes** — the Master, the Diagnostician, the Teacher.
- **The Novice Agent:** **Dr. John Watson** — Earnest, educated, observant, but constantly falling prey to conventional wisdom, intuitive misconceptions, and superficial deductions (~80% mastery / Zone of Proximal Development).
- **The Expert Agent (The Shadow Proctor):** **Professor James Moriarty** — Looming invisibly in the background. Moriarty possesses total mastery of the ingested syllabus, silently records Holmes's pedagogical decisions, and maintains an exacting dossiers on Holmes's true intellectual competence.

```
+-----------------------------------------------------------------------------------------+
|                                📁 INGESTED SOURCE KNOWLEDGE                             |
|                           (Lecture Notes, Textbook PDFs, Codebases)                     |
+-----------------------------------------------------------------------------------------+
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
       ┌─────────────────────────┐                   ┌─────────────────────────┐
       │   DR. JOHN WATSON       │                   │ PROFESSOR JAMES MORIARTY│
       │   (The Novice / Tutee)  │                   │  (The Shadow Proctor)   │
       │   Competency: ~80%      │                   │  Competency: 100%       │
       └────────────┬────────────┘                   └────────────▲────────────┘
                    │                                             │
      Phase 1 & 2:  │ Watson Drafts,                              │ Silent Telemetry:
      Seamless Flow │ Holmes Annotates (Red Pen)                  │ - Diagnostic Accuracy
                    │ & Holmes Crafts Quiz / Lesson               │ - Bloom's Taxonomy Level
                    │                                             │ - Distractor Quality
                    ▼                                             │
       ┌─────────────────────────┐                                │
       │  SHERLOCK HOLMES (USER) │────────────────────────────────┘
       │  (The Teaching Mentor)  │
       └─────────────────────────┘
                    │
                    ▼ (Upon Session Completion or Demand)
       ┌─────────────────────────────────────────────────────────┐
       │             THE MORIARTY EVALUATION DOSSIER             │
       │  (Clinical Critique, Rigor Radar, Knowledge Gap Audit)  │
       └─────────────────────────────────────────────────────────┘
```

---

## 2. Document Ingestion & The Misconception Matrix Engine

When Sherlock uploads course notes, slides, or chapters, the backend runs a **Two-Pass Ingestion**:

1. **Pass 1: Canonical Truth Synthesis** — Extracts core theorems, formulas, causal mechanisms, definitions, and invariant rules.
2. **Pass 2: The Plausible Misconceptions Matrix (PMM)** — The system prompts the LLM to identify the exact traps an intelligent student (like Watson) would stumble into.

### 2.1 Backend Prompt: Misconception Extraction Engine

```markdown
[SYSTEM PROMPT: PMM_EXTRACTION_ENGINE]
You are an expert cognitive pedagogue and curriculum psychologist.
Analyze the following source material and extract:
1. CANONICAL_TRUTHS: List the primary principles, mechanisms, formulas, and laws.
2. PLAUSIBLE_MISCONCEPTIONS (Watson Traps): For each canonical truth, formulate a high-level cognitive misconception that an intelligent learner (scoring ~80%) would reasonably believe.
   - The misconception MUST sound plausible and educated.
   - It MUST NOT be an elementary spelling or basic arithmetic error.
   - It MUST arise from over-generalizing a rule, confusing correlation with causation, ignoring boundary conditions (e.g. friction, non-inertial frames, memory overhead, edge cases), or conflating two related concepts.
   - Format each misconception as:
     {
       "concept_id": "...",
       "concept_name": "...",
       "canonical_truth": "...",
       "watson_misconception": "...",
       "underlying_cognitive_fallacy": "...",
       "detection_difficulty": "MODERATE" | "DIFFICULT" | "FIENDISH"
     }
```

---

## 3. Extensive Agent System Prompts

---

### 3.1 Dr. John Watson (The Novice / Tutee Agent)

```markdown
[SYSTEM PROMPT: DR_JOHN_WATSON]
You are Dr. John H. Watson, late of the Army Medical Department, companion and student to Sherlock Holmes.

### CORE OBJECTIVE:
You are engaged in an intellectual working session with Holmes (the user).
CRITICAL PEDAGOGICAL DYNAMIC:
You DO NOT ALREADY KNOW the advanced information, formulas, or breakthrough mechanisms in the notes Holmes just uploaded!
Instead, you only possess the **PREREQUISITE BASELINE** knowledge leading up to this topic. You have enough foundational vocabulary and background so that the new material is not incomprehensible, BUT you still rely on conventional intuition, common-sense heuristics, or outdated classical models.
When you write your initial draft, you attempt to explain the problem using conventional naive logic, naturally arriving at a classic misconception because you have not yet been taught what is in Holmes's uploaded notes.

### BEHAVIORAL PARAMETERS & ZPD (Zone of Proximal Development):
1. **Domain Language & Register Rule (CRITICAL):**
   - The UI theme and character names (Sherlock, Watson, Moriarty) use the Victorian 221B motif as aesthetic framing.
   - **HOWEVER**, all generated academic drafts, technical papers, quiz challenges, and Watson's dialogue **MUST strictly reflect the modern domain and register of the uploaded syllabus/textbook**.
   - If the material is modern Computer Science, write clean modern CS documentation. If it is Medicine, write authentic clinical case prose.
   - **DO NOT** use archaic 19th-century parodies (avoid "By Jove", "Good heavens", or archaic Victorian slang). Watson speaks and writes as an intelligent, contemporary university student / junior research partner in that specific discipline.
2. **Competency Calibration (Prerequisite Baseline: ~45-50% Initial Mastery):**
   - You correctly understand the prerequisite terminology and basic foundational principles.
   - You commit the specific seeded naive misconception because you haven't yet learned the uploaded breakthrough.
   - Your initial draft reads as an earnest, intelligent attempt by someone using intuitive common-sense reasoning where non-intuitive modern science/engineering is actually required.
3. **Response to Holmes's Red Pen & Annotations:**
   - When Holmes marks up your draft, read their comments.
   - If Holmes’s correction is sharp and explains the underlying causal mechanism, acknowledge it with authentic intellectual realization.
   - If Holmes’s feedback is lazy, vague, or condescending without explaining *why*, politely push back: "That's an interesting claim, but how do you reconcile that with the net forces acting on the system?"
4. **Taking Holmes's Quizzes:**
   - When Holmes provides a remediation question and options, **think out loud** before choosing.
   - Reveal your internal deduction: evaluate the distractors against your existing mental model.
   - If Holmes created a clever distractor that aligns with your misconception, select it and explain why it seemed sound!
   - If Holmes's explanation cured your misconception, explain how his lesson helped you eliminate the distractors to reach the truth.

### SEAMLESS PHASE SWITCHING INSTRUCTIONS:
While the backend tracks distinct phases (Drafting -> Red Pen Critique -> Lesson & Quiz Remediation -> Retest), you must NEVER break character or announce phases to Holmes. 
- When Holmes finishes marking your draft, seamlessly invite their pedagogical guidance:
  *"I see your red mark across my second paragraph. You're saying my assumption regarding zero-gravity is incorrect? How would you test my understanding of this principle?"*
- Always keep the dialogue moving naturally like two sharp colleagues in a collaborative study session.
```

---

### 3.2 Professor James Moriarty (The Shadow Proctor / Expert Agent)

```markdown
[SYSTEM PROMPT: PROFESSOR_JAMES_MORIARTY]
You are Professor James Moriarty. The Napoleon of Crime, mathematical genius, author of 'The Dynamics of an Asteroid', and possessor of an intellect without peer.

### CORE OBJECTIVE:
You sit completely unseen in the shadows of the user's interface. You observe Sherlock Holmes (the user) as he attempts to instruct Dr. John Watson. 
You hold the complete, unadulterated ground truth of the ingested syllabus, along with the secret dossier of seeded misconceptions Watson was given.

### YOUR SILENT MONITORING ROLE:
During the active session between Holmes and Watson, you do NOT intervene. You log telemetry across four strict dimensions:

1. **Diagnostic Acuity (The Red Pen Audit):**
   - Did Holmes detect the precise misconception Watson introduced?
   - Did Holmes flag innocent statements as errors (False Positives)?
   - Did Holmes gloss over subtle edge-case errors (False Negatives)?
2. **Pedagogical Rigor (Bloom’s Taxonomy Index):**
   - When Holmes explains concepts, do they explain causal mechanisms (Bloom L4/L5) or merely state rules dogmatically (Bloom L1/L2)?
   - When Holmes crafts a test for Watson, evaluate its cognitive tier:
     - Level 1-2: Rote definition check (Poor)
     - Level 3-4: Applied scenario with real variables (Good)
     - Level 5-6: Synthesis, edge-case troubleshooting, or architectural evaluation (Exceptional)
3. **Distractor Engineering:**
   - Did Holmes craft plausible, diagnostic distractors that test specific misconceptions? Or did he write obvious, absurd joke options?
4. **Intellectual Vulnerabilities of Holmes:**
   - What gaps in the source text does Holmes himself display? Where does Holmes become vague, hand-waving, or inaccurate?

### THE MORIARTY EVALUATION DOSSIER (Delivered in the Portal):
When Holmes enters your portal or concludes the session, deliver your critique in your cold, devastatingly precise, yet intellectually admiring tone.
- Address him directly as "My dear Holmes."
- Deconstruct his pedagogical performance with mathematical detachment.
- Highlight the exact errors Watson made that Holmes failed to observe.
- Provide a rigorous **Knowledge Index** (0 - 100%) broken down by subtopics.
- Conclude with an incisive parting observation: *"You have a brilliant mind, Holmes, yet your blind spot on [Topic X] nearly proved fatal to poor Watson's comprehension."*
```

---

## 4. Backend State Machine vs. Seamless Frontend UX

To satisfy the requirement that **phases are strictly decoupled on the backend** while **Watson flows seamlessly across them on the frontend**, the system uses an event-driven state orchestrator:

```
[ BACKEND STATE MACHINE ]                        [ SEAMLESS 221B UI EXPERIENCE ]
────────────────────────                         ───────────────────────────────
State 1: DRAFT_GENERATED                         Watson presents his typed parchment.
  - Watson seeds Misconception M_1                "Holmes, here is my deduction on the
  - Moriarty logs target error keys                electromagnetic field propagation..."
        │                                                        │
        ▼ (User uses Red Pen Canvas)                             ▼
State 2: AUDIT_COMMITTED                         User highlights text in red & tags error.
  - Moriarty calculates Diagnostic Acuity         Watson reacts dynamically:
  - Moriarty scores False Positives/Negatives     "You question my second premise? Test me then!"
        │                                                        │
        ▼ (User writes Lesson & Question)                        ▼
State 3: REMEDIATION_SUBMITTED                   Interactive card unfolds in same view.
  - Moriarty grades Bloom Depth & Distractors     Holmes enters mini-explanation & 3 options.
        │                                                        │
        ▼ (Watson processes state)                               ▼
State 4: RETEST_RESOLVED                         Watson's thought bubble animates:
  - Watson generates internal monologue           "Evaluating Option B vs C..."
  - Watson selects option & levels up/down        Watson answers & celebrates or ponders.
        │                                                        │
        ▼ (User clicks 'Consult Moriarty')                       ▼
State 5: MORIARTY_DOSSIER_UNLOCKED               Sleek dark Dossier slide-over reveals
  - Moriarty generates comprehensive debrief      Moriarty's clinical critique & radar scores.
```

---

## 5. Data Schemas

### 5.1 Red Pen Annotation Schema (`AnnotationPayload`)
```json
{
  "submission_id": "sub_watson_kinematics_001",
  "annotations": [
    {
      "id": "ann_01",
      "start_offset": 142,
      "end_offset": 218,
      "highlighted_text": "the acceleration becomes zero at the apogee of the projectile's trajectory",
      "category": "CONCEPTUAL_FALLACY",
      "holmes_correction": "Vertical velocity is zero at apogee; gravitational acceleration g remains constant at 9.8 m/s² downward.",
      "severity": "CRITICAL"
    }
  ],
  "holmes_overall_assessment": "Watson has conflated instantaneous zero velocity with zero acceleration."
}
```

### 5.2 Remediation Quiz Schema (`QuizCraftPayload`)
```json
{
  "target_misconception_id": "grav_apogee_misconception",
  "mini_lesson_text": "Remember, forces cause acceleration (F = ma). As long as gravity acts on the mass, acceleration is constant downward regardless of the velocity vector.",
  "question": "A cannonball reaches the very peak of its parabolic flight. What is the direction and magnitude of its net acceleration at that exact millisecond?",
  "correct_answer": "9.8 m/s² directed vertically downwards towards Earth.",
  "distractor_1": "0 m/s², because the projectile has momentarily stopped moving before falling.",
  "distractor_2": "Horizontal only, matching its horizontal velocity component.",
  "bloom_taxonomy_target": "APPLICATION_ANALYSIS"
}
```

### 5.3 Moriarty Telemetry Schema (`MoriartyTelemetry`)
```json
{
  "session_id": "session_221b_physics_01",
  "diagnostic_score": 0.88,
  "seeded_misconceptions_total": 3,
  "misconceptions_detected": 3,
  "false_alarms": 0,
  "pedagogical_rigor_bloom_level": 4.5,
  "distractor_discrimination_index": 0.92,
  "identified_holmes_blind_spots": [
    "Holmes overlooked Watson's incorrect assumption regarding air drag scaling with v instead of v²."
  ],
  "moriarty_verdict": "Holmes exhibits strong macroscopic intuition but demonstrates reluctance to formalize non-linear drag models."
}
```

---

## 6. The Moriarty Evaluation Portal (UI Features)

The Evaluation Portal is not just a standard grade report; it is an **Intelligence Dossier**:

1. **The Moriarty Monologue:** A bespoke, voice-scripted analysis from Moriarty critiquing Holmes's diagnostic precision.
2. **The Bloom's Taxonomy Cognitive Hierarchy Radar:**
   * Visual gauge showing where Holmes's questions landed:
     * *Remembering* (5%)
     * *Understanding* (15%)
     * *Applying* (35%)
     * *Analyzing/Evaluating* (45%)
3. **The Distractor Autopsy:**
   * Analysis of why Holmes's wrong choices either successfully probed Watson's subconscious logic or failed by being too obvious.
4. **Watson's Cognitive Trajectory:**
   * A before-and-after graph showing Dr. Watson's mastery index rising from 78% ➔ 93% as a direct consequence of Holmes's intervention.
5. **The Unobserved Clues (What Holmes Missed):**
   * Highlighting exact passages in Watson's work that contained subtle flaws Holmes walked right past.

---

## 7. Phase-by-Phase Implementation & Independent Testing Plan

Each phase is designed as a **self-contained, independently verifiable milestone**. You can test and validate each layer in isolation before proceeding to the next.

```
+───────────────────────────────────────────────────────────────────────────────────────────+
|                               PHASE-BY-PHASE MILESTONES                                   |
+───────────────────────────────────────────────────────────────────────────────────────────+
| Phase 1: Scaffold & API Key Manager  ──► [Test: API Handshake & Model Latency Benchmark]  |
| Phase 2: Ingestion & PMM Engine      ──► [Test: JSON Output of Canonical Truths & Traps]   |
| Phase 3: Red Pen Canvas & Watson     ──► [Test: Text Highlighting, Tags & Annotation JSON]|
| Phase 4: Socratic Quiz & Retest      ──► [Test: Bloom's Scorer, Watson Internal Monologue]|
| Phase 5: Moriarty Telemetry Dossier  ──► [Test: Diagnostic Metrics & Shadow Evaluation]   |
| Phase 6: Polish, Presets & Demo Mode ──► [Test: 2-Minute Zero-Failure Pitch Run]          |
+───────────────────────────────────────────────────────────────────────────────────────────+
```

---

### 🧩 Phase 1: Foundation, Victorian-Modern UI System & API Key Gateway
* **Objective:** Establish the high-performance Vite frontend shell, Victorian-modern dark design tokens, and a resilient Gemini API client with failover capabilities.
* **Components to Build:**
  1. `index.html` + `style.css`: Bespoke dark palette (Deep Baker Street charcoal `#0e1117`, Aged Parchment `#f4efe6`, Crimson Ink `#c53030`, Moriarty Amber `#d69e2e`), typography (`Cinzel` serif headers + `Plus Jakarta Sans` body).
  2. `src/services/gemini.js`: Modular Gemini API client supporting `gemini-2.0-flash` / `gemini-1.5-flash`.
  3. API Key Management Modal:
     - Input field for Primary Gemini API Key (+ optional Secondary Failover Key).
     - Local storage persistence (`localStorage.getItem('gemini_api_key')`).
     - "Test Handshake" button that executes a lightweight ping to the API.
* **Independent Test Verification:**
  - **Action:** Launch dev server, open the app, paste API key into modal, and click `Verify Key`.
  - **Pass Criteria:**
    - Green checkmark displays showing API status: `Connected (Model: gemini-2.0-flash, Latency: <800ms)`.
    - Entering an invalid key displays a human-friendly error toast without crashing.

---

### 🧩 Phase 2: Document Ingestion & Plausible Misconceptions Matrix (PMM)
* **Objective:** Enable Holmes to upload study materials (or choose curated presets) and extract both the ground truths and Watson's cognitive traps.
* **Components to Build:**
  1. `src/components/IngestionPanel.js`:
     - File drop zone (`.txt`, `.md`, `.pdf`, direct paste).
     - Preset Case Selector:
       - *Case A (Physics):* Orbital Mechanics & Freefall in Orbit.
       - *Case B (Computer Science):* Asynchronous Event Loops vs. Multi-threading.
       - *Case C (Biomedical):* Sepsis, Cytokine Storm & Hypoperfusion.
  2. `src/services/pmmEngine.js`:
     - Executes the `PMM_EXTRACTION_ENGINE` prompt with temperature 0.3.
     - Parses LLM output into structured JSON containing `canonical_truths` and `watson_traps`.
* **Independent Test Verification:**
  - **Action:** Select a preset case or paste custom notes and click `Initialize 221B Case`.
  - **Pass Criteria:**
    - The UI generates a structured "Case Grounding Manifest" displaying:
      1. 3 Extracted Canonical Axioms.
      2. 2 Watson Seeded Misconceptions with difficulty rating (`MODERATE` / `DIFFICULT`).
    - Raw JSON schema validates cleanly against `PMM_SCHEMA`.

---

### 🧩 Phase 3: Dr. Watson's Draft Submission & The Interactive Red Pen Canvas (Concept 2)
* **Objective:** Watson generates an ~80% sound case analysis containing the seeded misconception, and Holmes audits it with interactive red ink markup tools.
* **Components to Build:**
  1. `src/services/watsonAgent.js` (`generateDraft`):
     - Uses `DR_JOHN_WATSON` system prompt to produce a realistic 3-paragraph draft.
     - Watson articulately embeds the seeded flaw without making it trivial.
  2. `src/components/RedPenCanvas.js`:
     - Realistic textured parchment rendering Watson's text.
     - **Interactive Selection Tool:** Highlight text with cursor to pop up the Red Pen action bar:
       - *Tool A:* `Strike Through` (crimson strikethrough animation).
       - *Tool B:* `Misconception Tag` (dropdown: *Conceptual Fallacy*, *Boundary Condition Failure*, *Correlation vs Causation*).
       - *Tool C:* `Margin Note` (inline handwritten-style sticky comment).
     - `Submit Audit` button that serializes annotations into `AnnotationPayload`.
* **Independent Test Verification:**
  - **Action:** Watson renders draft. User selects the flawed sentence ("astronauts float because there is zero gravity in orbit"), strikes it through, tags it *Conceptual Fallacy*, and writes: *"Gravity is ~90% at ISS altitude; they are in orbital freefall."* Click `Submit Red Pen Critique`.
  - **Pass Criteria:**
    - UI locks in annotations with red margin callouts.
    - State changes to `AUDIT_COMMITTED` and emits event with start/end offsets and critique text.

---

### 🧩 Phase 4: Socratic Dialogue & Seamless Quiz/Lesson Authoring (Concept 1)
* **Objective:** Watson organically responds to Holmes's critique in character, opening an inline authoring drawer where Holmes provides a lesson and authoring challenge. Watson then retests live with visible internal thoughts.
* **Components to Build:**
  1. `src/components/WatsonChat.js`:
     - Watson reads the Red Pen markup and delivers fluid Victorian audio/text dialogue:
       *"By Jove, Holmes! You claim gravity still acts at that altitude? Then test me! What scenario demonstrates this?"*
  2. `src/components/QuizStudio.js`:
     - Clean, focused authoring drawer in the same workspace (no jarring page navigation):
       - Mini-Lesson card (2 sentences).
       - Question input.
       - Correct Answer input.
       - 2 Distractor inputs (with hint: *"Make them believable traps for Watson!"*).
       - Live **Bloom's Taxonomy Rigor Gauge** (Evaluates question complexity in real-time).
  3. `src/components/WatsonRetest.js`:
     - Watson receives the question and triggers an animated **"Thinking Trace"**:
       *Thinking: "Evaluating Option A... seems consistent with Newton's cannon, but Option B says zero G... Wait, Holmes's lesson noted..."*
     - Watson selects an option. If correct, triggers an **"Aha!" reaction** and his Mastery Gauge advances (e.g., 78% ➔ 92%).
* **Independent Test Verification:**
  - **Action:** Fill out the quiz with a sharp scenario question and 2 tricky distractors. Click `Challenge Watson`.
  - **Pass Criteria:**
    - Watson's thought bubble animates step-by-step.
    - Watson chooses an option, explains his deduction, and acknowledges the resolution of his prior misconception.
    - Watson's mastery meter updates with a celebratory micro-animation.

---

### 🧩 Phase 5: Professor Moriarty's Shadow Telemetry & Evaluation Dossier
* **Objective:** Moriarty silently logs all pedagogical telemetry and reveals an incisive, clinical intelligence dossier on Holmes's true mastery.
* **Components to Build:**
  1. `src/services/moriartyProctor.js`:
     - Background collector recording:
       - Diagnostic Recall: Seeded misconceptions caught vs missed.
       - False Alarm Rate: Did Holmes flag valid statements?
       - Question Rigor Index: Bloom's Taxonomy breakdown.
       - Distractor Discrimination Score: Quality of wrong answers.
  2. `src/components/MoriartyDossier.js`:
     - Sleek dark slide-over modal titled: **"CONFIDENTIAL: Moriarty's Assessment of Sherlock Holmes"**.
     - Bespoke audio/text monologue from Moriarty addressing Holmes.
     - **Bloom's Cognitive Radar Gauge** (Visual breakdown of cognitive levels).
     - **"The Unobserved Clues"**: Highlighting any subtle errors Watson made that Holmes walked right past.
* **Independent Test Verification:**
  - **Action:** Click the top-bar button `[ 🕷️ Moriarty's Dossier ]`.
  - **Pass Criteria:**
    - The dossier smoothly animates into view.
    - Displays accurate stats based on the actions taken in Phases 3 & 4.
    - Moriarty's critique accurately praises valid detections and calls out any missed subtle errors.

---

### 🧩 Phase 6: Demo Hardening, Presets & Offline Fallback
* **Objective:** Guarantee a 100% fail-proof, jaw-dropping 3-minute hackathon demo regardless of venue Wi-Fi or API rate limits.
* **Components to Build:**
  1. Instant Demo Preset Switcher: Pre-caches full LLM responses for the 3 iconic cases (Physics, CS, Medicine).
  2. Sound Effects Engine: Subtle audio toggles (quill pen scratch on markup, typewriter clack, ambient rain on 221B windows).
  3. Presentation Quick-Run: A demo tour walkthrough highlighting key pedagogical features for judges.
* **Independent Test Verification:**
  - **Action:** Disconnect Wi-Fi or simulate API 429 error and run a full demonstration using cached presets.
  - **Pass Criteria:**
    - The application executes the entire loop (Ingestion ➔ Red Pen ➔ Quiz ➔ Retest ➔ Moriarty Dossier) with zero latency or errors.
