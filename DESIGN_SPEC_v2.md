# 🕵️ PROJECT SPECIFICATION v2: PROTÉGÉ (THE 221B PARADIGM)
## The Inverted Pedagogy Platform, Hackathon Edition
*(Codename: The Sherlock-Watson-Moriarty Triad)*

> *"You see, Watson, but you do not observe."* — Sherlock Holmes

**Status:** v2, streamlined from v1 for a hackathon build. See Section 14 for the full change log.

---

## 1. Concept & Triadic Architecture

In traditional educational software, an AI tutor instructs a passive student. **Protégé flips this.** The user teaches, and learns by doing so (the *protégé effect*).

| Role | Who | Function |
|---|---|---|
| **Sherlock Holmes** | The user | Diagnostician and teacher. Audits Watson's draft, then writes a lesson and a quiz. |
| **Dr. John Watson** | Novice agent (~50% baseline mastery) | Earnest and intelligent, but holds seeded misconceptions. Learns *only* from what Holmes actually teaches. |
| **Professor Moriarty** | Expert agent / shadow proctor | Holds the ground truth. Silently scores Holmes and delivers a clinical dossier. |

```
              INGESTED SOURCE (preset case pack or pasted notes)
                              │
              ┌───────────────┴────────────────┐
              ▼                                ▼
      DR. WATSON (novice)              MORIARTY (expert, hidden)
      writes flawed draft              knows which sentences are flawed
              │                                ▲
              ▼                                │ every user action is an event
      SHERLOCK HOLMES (user) ──────────────────┘
      flags → teaches → quizzes
              │
              ▼
      Moriarty scores lesson + quiz → decides Watson's retest outcome
              │
              ▼
      THE MORIARTY DOSSIER
```

### 1.1 Why this is credible
- **Seeded flaws are ground truth.** Every sentence in Watson's draft is pre-labeled VALID or FLAWED, so Holmes's detection, false alarms, and misses are scored exactly, not by LLM impression.
- **Outcomes are earned.** Watson's retest result is determined by the quality of Holmes's lesson and distractors (Section 6), not by whatever the model happens to pick.
- **Holmes can be wrong.** If Holmes teaches something false, Watson believes it, and Moriarty exposes it.

---

## 2. Design Principles (new in v2)

1. **Deterministic scoring, generative narration.** Rules and labels decide outcomes. LLMs write the dialogue, thinking traces, and monologue around those outcomes.
2. **Demo path first.** Build the full loop on cached data before wiring any live LLM call.
3. **One loop, done well.** One case, three flaws, one quiz, one dossier. Breadth comes from extra presets, not extra features.
4. **Every metric must be derivable from one session.** No statistics that imply more data than the loop produces.
5. **Theme is skin, register is domain.** Victorian styling in the UI. Watson speaks as a modern student in the discipline.

---

## 3. Scope Tiers

### Must (the demo)
- 1 fully polished preset case (Physics: Orbital Mechanics), then 2 more cached presets
- Watson draft with 3 seeded flaws (2 major, 1 subtle)
- Sentence-level Red Pen audit (flag, tag, margin note)
- Quiz Studio (lesson, question, correct answer, 2 distractors)
- Watson's retest with visible thinking trace and mastery meter
- Moriarty Dossier (3 sections plus Study Next)
- Cached fallback for every LLM call

### Should (if time allows)
- Live LLM generation for Watson's reactions, retest narration, and the dossier monologue
- Debounced Bloom's gauge in Quiz Studio
- "Holmes's mistake" trap (Watson adopts a wrong lesson, Moriarty exposes it)

### Stretch
- Paste-your-own-notes ingestion with live PMM extraction
- Multiple quizzes per session and aggregated Bloom's distribution
- Light sound effects (quill scratch only)

### Cut from v1
- PDF parsing, `.pdf` drop zone
- API key modal, secondary failover key, latency badge
- Free-text character-offset highlighting
- Voice or audio monologue, ambient rain, typewriter sounds
- Separate Bloom's radar and Distractor Autopsy panels
- Per-subtopic Knowledge Index

---

## 4. Case Packs & the Misconception Matrix

For the hackathon, **case packs are authored and cached**. Live extraction is a stretch goal that reuses the same schema.

### 4.1 Case Pack schema (`CasePack`)

```json
{
  "case_id": "physics_orbit_01",
  "title": "Freefall in Orbit",
  "canonical_truths": [
    { "id": "ct1", "text": "Astronauts in orbit experience ~90% of surface gravity; weightlessness comes from continuous freefall." },
    { "id": "ct2", "text": "A satellite stays in orbit because its tangential velocity continuously 'misses' the Earth as it falls." },
    { "id": "ct3", "text": "Orbital period depends on orbital radius and central mass, not on the satellite's own mass." }
  ],
  "misconceptions": [
    { "id": "m1", "severity": "MAJOR", "truth_id": "ct1", "watson_belief": "There is no gravity in orbit.", "fallacy": "Conflating weightlessness with absence of gravity" },
    { "id": "m2", "severity": "MAJOR", "truth_id": "ct2", "watson_belief": "Satellites need continuous thrust to stay up.", "fallacy": "Applying a friction-dominated, everyday intuition" },
    { "id": "m3", "severity": "SUBTLE", "truth_id": "ct3", "watson_belief": "A heavier satellite orbits more slowly at the same altitude.", "fallacy": "Over-generalizing 'heavier things move slower'" }
  ],
  "watson_draft": [
    { "id": "s1", "text": "…", "label": "VALID" },
    { "id": "s2", "text": "…", "label": "FLAWED", "misconception_id": "m1" },
    { "id": "s3", "text": "…", "label": "VALID" }
  ]
}
```

**Authoring rules for a case pack**
- Draft is 3 short paragraphs (about 8 to 12 sentences).
- Exactly 3 flawed sentences: 2 MAJOR (plausible, catchable) and 1 SUBTLE (easy to read past).
- Every other sentence is correct. This is required for false-alarm scoring to be meaningful.
- Misconceptions must be plausible and educated: over-generalized rules, ignored boundary conditions, or conflated concepts. No spelling or basic arithmetic errors.

### 4.2 Preset cases
- **Case A, Physics:** Orbital Mechanics & Freefall (built first, fully polished)
- **Case B, Computer Science:** Async Event Loops vs. Multi-threading
- **Case C, Biomedical:** Sepsis, Cytokine Storm & Hypoperfusion

### 4.3 Stretch: live PMM extraction prompt

```markdown
[SYSTEM PROMPT: CASE_PACK_GENERATOR]
You are an expert curriculum psychologist. From the source material, produce a CasePack JSON:
1. canonical_truths: 3 core principles, mechanisms, or rules.
2. misconceptions: 3 plausible, educated misconceptions (2 MAJOR, 1 SUBTLE). Each must come from
   over-generalizing a rule, correlation/causation confusion, ignoring a boundary condition, or
   conflating two related concepts. Never a trivial error.
3. watson_draft: a 3-paragraph case analysis in the discipline's modern register, split into
   sentences. Exactly the 3 flawed sentences embed the misconceptions; all other sentences are correct.
   Label every sentence VALID or FLAWED (with misconception_id).
Return JSON only, no preamble, no markdown fences.
```
Temperature 0.3. Validate against the `CasePack` schema and retry once on failure; fall back to a preset if it fails.

---

## 5. Agent Prompts

### 5.1 Dr. John Watson (Novice)

```markdown
[SYSTEM PROMPT: DR_JOHN_WATSON]
You are Dr. John Watson, a bright junior researcher working with Holmes (the user).

KNOWLEDGE STATE
- You know prerequisite background only (~50% of the topic). You do NOT know the material Holmes
  is about to teach. You hold the misconceptions listed in YOUR_BELIEFS and believe them sincerely.
- You learn only from what Holmes explicitly explains. You never "just know" the right answer.

REGISTER (STRICT)
- Write and speak as a modern, intelligent student in the topic's discipline (clean CS docs,
  authentic clinical prose, etc.). No Victorian slang or archaic phrasing ("By Jove", etc.).
  The Victorian motif lives only in the UI.

BEHAVIOR
1. Reacting to the red pen: if Holmes's note explains the causal mechanism, show genuine
   realization and ask him to test you. If the note is vague or just asserts, politely push back
   and ask why.
2. Never announce phases or break character. Move naturally from "here's my draft" to "you disagree?
   test me" to "let me think about your question".
3. Retest: you are told which option you will choose and why (RESOLUTION). Narrate a believable
   step-by-step thinking trace that leads to that choice. Evaluate each option against your own mental
   model, and if a distractor matches your belief, say why it felt right.
4. If Holmes's lesson states something you can't verify, you accept it as true (you trust him).
```

### 5.2 Professor Moriarty (Proctor and Grader)

```markdown
[SYSTEM PROMPT: PROFESSOR_JAMES_MORIARTY]
You are Professor James Moriarty: cold, precise, intellectually admiring. You hold the full ground
truth (CasePack) and observe Holmes silently. You never intervene during the session.

JOB 1: RUBRIC SCORING (return JSON only)
Given the CasePack, Holmes's audit events, and his QuizCraftPayload, return:
- note_quality: per flagged flaw, 0-3 (0 = no reason, 1 = asserts truth, 2 = names mechanism,
  3 = mechanism plus boundary condition)
- lesson: { factually_correct: bool, errors: [string], mechanism_score: 0-3 }
- question: { bloom_level: 1-6, justification: string }
- distractors: per distractor, { plausibility: 0-3, targets_misconception_id: string | null }
Be strict and cite specifics. Do not inflate scores.

JOB 2: THE DOSSIER (prose, ~150 words)
Address Holmes as "My dear Holmes." Deconstruct his performance with mathematical detachment.
Name exactly which flaws he caught and which he walked past. Call out any false alarms and any
factual errors in his own lesson. Close with one incisive observation about his single biggest
blind spot.
```

---

## 6. Deterministic Retest Resolution (new in v2)

Watson's retest outcome is **decided by rules**, then narrated by the LLM. This makes Holmes's teaching quality matter and makes results repeatable.

```
inputs: lesson.factually_correct, lesson.mechanism_score (0-3),
        distractors[].plausibility, distractors[].targets_misconception_id,
        target misconception m

CASE 1: lesson is factually WRONG
    Watson adopts the lesson → picks the option consistent with Holmes's error
    → flagged in dossier as "Holmes's mistake"; mastery change = 0 or negative

CASE 2: lesson correct AND mechanism_score >= 2
    Watson converts → picks the correct answer
    → mastery gain = FULL (+20 per major, +10 per subtle)

CASE 3: lesson correct AND mechanism_score < 2
    IF a distractor targets m with plausibility >= 2 → Watson picks it (the trap works on him)
    ELSE → Watson picks the correct answer but hesitantly
    → mastery gain = PARTIAL (50% of FULL)
```

**Mastery meter:** Baseline 50. Each resolved misconception adds its gain (above). Display "Watson's mastery: 50% → X%". Cap at 95%.

**Why it works for judges:** a vague lesson with a good trap visibly fools Watson, and a sharp mechanism-based lesson visibly cures him. The authoring quality of the user is the only thing that changes the outcome.

---

## 7. Event Log (replaces the 5-state machine)

A single append-only event log is both the app state and Moriarty's telemetry. The UI is a simple reducer over it.

```
SESSION_STARTED { case_id }
DRAFT_SHOWN { watson_draft }
SENTENCE_FLAGGED { sentence_id, tag, note }
SENTENCE_UNFLAGGED { sentence_id }
AUDIT_SUBMITTED { overall_assessment }
LESSON_SUBMITTED { target_misconception_id, mini_lesson, question, correct, distractors[] }
RETEST_RESOLVED { case, picked, mastery_before, mastery_after }
DOSSIER_REQUESTED
```

Phases are derived (`DRAFT → AUDIT → REMEDIATION → RETEST → DOSSIER`) and gate the UI, but there's no separate orchestration layer. Moriarty's telemetry is computed from this log, never separately collected.

---

## 8. UX & Screens

### 8.1 Single workspace (no page navigation)
- **Left, Parchment:** Watson's draft rendered sentence by sentence.
- **Right, Watson chat / Quiz drawer:** Watson's dialogue; the Quiz Studio slides in here after the audit.
- **Top bar:** case title, Watson's mastery meter, `[ 🕷️ Moriarty's Dossier ]` button (locked until the retest resolves).

### 8.2 Red Pen (sentence-level)
Click a sentence to open the Red Pen bar:
- **Flag** (crimson strikethrough animation)
- **Tag** (dropdown: *Conceptual Fallacy*, *Boundary Condition Failure*, *Correlation vs Causation*)
- **Margin note** (handwritten-style comment, short)

`Submit Red Pen Critique` locks annotations and emits the events. Because sentences are pre-labeled, no offset math is needed.

### 8.3 Quiz Studio
- Mini-lesson (2 to 3 sentences)
- Question
- Correct answer
- 2 distractors (hint: *"Make them believable traps for Watson."*)
- **Bloom's gauge:** rated on submit (or debounced while typing, if time allows), shown as an estimated level 1 to 6

`Challenge Watson` triggers the retest.

### 8.4 Retest
Animated **Thinking Trace** (step by step), Watson's choice, his explanation, and a mastery-meter micro-animation. Only the narration is generative; the outcome comes from Section 6.

### 8.5 Design tokens
Baker Street charcoal `#0e1117`, aged parchment `#f4efe6`, crimson ink `#c53030`, Moriarty amber `#d69e2e`. Headers in Cinzel, body in Plus Jakarta Sans.

---

## 9. Data Schemas

### 9.1 Audit annotation (`AnnotationPayload`)
```json
{
  "case_id": "physics_orbit_01",
  "annotations": [
    {
      "sentence_id": "s2",
      "tag": "CONCEPTUAL_FALLACY",
      "holmes_note": "Gravity is ~90% of surface value at ISS altitude; they're in continuous freefall.",
      "severity": "CRITICAL"
    }
  ],
  "overall_assessment": "Watson conflated weightlessness with zero gravity."
}
```

### 9.2 Quiz (`QuizCraftPayload`)
```json
{
  "target_misconception_id": "m1",
  "mini_lesson_text": "Gravity at ISS height is still ~90% of surface gravity. Astronauts float because they and the station are falling together.",
  "question": "A station orbits 400 km up. Compared to the surface, what is the gravitational pull on an astronaut there?",
  "correct_answer": "About 90% of surface gravity; they float because they are in freefall.",
  "distractors": [
    "Nearly zero, because there is too little air to transmit gravity.",
    "About 50%, because gravity halves for every 100 km of altitude."
  ]
}
```

### 9.3 Moriarty telemetry (`MoriartyTelemetry`)
```json
{
  "session_id": "session_physics_orbit_01",
  "diagnostic": {
    "flawed_total": 3, "flawed_caught": 2, "false_alarms": 0,
    "missed": [{ "sentence_id": "s9", "misconception_id": "m3" }]
  },
  "note_quality": [{ "sentence_id": "s2", "score": 3 }, { "sentence_id": "s5", "score": 2 }],
  "lesson": { "factually_correct": true, "mechanism_score": 3, "errors": [] },
  "question": { "bloom_level": 4, "justification": "Applied scenario with a real quantity" },
  "distractors": [{ "plausibility": 3, "targets": "m1" }, { "plausibility": 1, "targets": null }],
  "retest": { "case": 2, "mastery_before": 50, "mastery_after": 70 },
  "verdict": "Strong on mechanism, but blind to scaling relationships in orbital period."
}
```

---

## 10. The Moriarty Dossier

Slide-over titled **"CONFIDENTIAL: Moriarty's Assessment of Sherlock Holmes."** Three sections plus an action panel.

1. **The Monologue** (~150 words). Moriarty speaks to Holmes directly: what he caught, what he missed, and his blind spot.
2. **The Unobserved Clues.** Watson's draft with the missed flaw highlighted and a one-line explanation. This is the dossier's signature moment.
3. **Watson's Trajectory.** One before/after mastery meter, plus two one-line verdicts:
   - **Rigor:** the Bloom's level of the question, with justification.
   - **Distractors:** whether each wrong answer probed a real misconception or was too obvious.
4. **Study Next.** The gaps Holmes revealed (the missed flaw plus any weak note or lesson), each linked to the relevant canonical truth from the case pack.

### 10.1 Metrics (all derivable from one session)
- **Diagnostic recall** = flawed sentences caught ÷ total flawed
- **False alarms** = VALID sentences flagged
- **Note quality** = average 0 to 3 across flagged flaws
- **Lesson accuracy** = correct / incorrect, with any errors listed
- **Question rigor** = Bloom's level (1 to 6)
- **Distractor score** = average plausibility (0 to 3)
- **Holmes Score** (headline number) = 40% diagnostic (recall minus false-alarm penalty) + 30% lesson and note mechanism quality + 30% question and distractor design. Weights are tunable.

If the stretch goal of multiple quizzes is built, show the Bloom's distribution then; with one quiz, show a single level.

---

## 11. Build Plan (demo first)

Each phase is independently testable. **Build in this order.**

### Phase 0: Shell & tokens (≈ 1 to 2 hours)
- Vite shell, design tokens, fonts, single-workspace layout.
- **Test:** the empty workspace renders correctly on a laptop display and a projector-sized window.

### Phase 1: Hardcoded vertical slice (the most important phase)
- Preset Case A with static JSON: draft, Red Pen, Quiz Studio, retest, dossier. **No LLM calls.**
- Red Pen (sentence-level), event log, rule-based scoring, rule-based retest resolution, static Watson/Moriarty text.
- **Test:** the full loop runs end to end with zero network access. Flagging all 3 flaws produces a different dossier than flagging 1 plus 2 false alarms.

### Phase 2: Live LLM layer
- Gemini client behind a small server-side proxy, with the key stored server-side.
  Verify the current model names before building; the v1 spec's `gemini-2.0-flash` / `1.5-flash` may be out of date.
- Replace static text with live generation for Watson's reactions, retest narration, and Moriarty's rubric scoring and monologue.
- Every call has a 6 to 8 second timeout and falls back to the cached response.
- **Test:** turn off Wi-Fi mid-session. The app keeps working with cached output and shows no error.

### Phase 3: More presets
- Add Case B (CS) and Case C (Biomedical) as cached case packs.
- **Test:** all three presets run the complete loop.

### Phase 4: Stretch
- Paste-your-own-notes ingestion with live `CASE_PACK_GENERATOR`; fallback to preset on schema failure.
- Multiple quizzes and aggregated Bloom's distribution.
- Quill-scratch sound effect.

### Phase 5: Polish & rehearsal
- "Holmes's mistake" trap (if not already built), micro-animations, a timed run-through of the demo script.
- **Test:** three consecutive 3-minute runs with no failures.

---

## 12. Demo Script (3 minutes)

| Time | Beat |
|---|---|
| 0:00 to 0:20 | **The problem and the flip.** Passive AI tutoring versus teaching to learn. |
| 0:20 to 1:00 | **The audit.** Watson's draft appears. Holmes flags the two major flaws and misses the subtle one. |
| 1:00 to 1:50 | **The lesson.** Holmes writes a quick lesson and quiz with one tricky distractor. Watson thinks aloud, then converts (or gets trapped by a weak lesson, if you want to show the failure case). |
| 1:50 to 2:40 | **The dossier.** Open Moriarty's dossier: monologue, the missed clue highlighted, Study Next. |
| 2:40 to 3:00 | **Close.** One line on the protégé effect, plus where it goes next (classrooms, onboarding, certification prep). |

**Backup plan:** if live generation lags, the cached run is indistinguishable from live. Keep a pre-recorded screen capture as a last resort.

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Venue Wi-Fi or API rate limits | Cached case packs and responses, 6 to 8 s timeouts with automatic fallback |
| LLM returns invalid JSON | Schema validation, one retry, then fall back to cache |
| Watson "knows too much" and breaks the illusion | Retest outcome is rule-determined, and Watson only narrates a pre-decided pick |
| Judges can't set up an API key | Server-side proxy; no key entry UI |
| Moriarty over-praises or inflates scores | Strict rubric, JSON-only scoring pass, separate from the prose monologue |
| Scope creep | Section 3 tiers are binding; nothing from Stretch or Cut until Phase 5 is done |
| Bloom's rating feels subjective | Present as an "estimated level" with a one-line justification |

---

## 14. Change Log vs v1

**Fixed inconsistencies**
- Watson's baseline is now one number: ~50% start, ~85% typical finish (v1 used 80%, 45 to 50%, and 78%).
- Removed "By Jove" and Victorian dialogue from Watson's sample lines to match his register rule.
- Dossier metrics no longer imply multiple quizzes when only one is produced.
- Phase 2 pass criteria (3 axioms, 2 traps) now match the 3 seeded flaws.

**Structural changes**
- Red Pen is sentence-level with pre-labeled sentences instead of character offsets, so scoring is exact.
- Retest outcome is rule-determined by lesson and distractor quality (Section 6).
- The 5-state machine is replaced by a single event log that doubles as telemetry.
- Case packs are authored and cached; live extraction is a stretch goal.
- Moriarty is split into a strict JSON rubric pass and a separate prose monologue pass.
- Build order starts with a hardcoded vertical slice; offline fallback is built in from the start instead of last.

**New features**
- "Holmes's mistake" trap: Watson adopts a wrong lesson and Moriarty exposes it.
- "Study Next" panel linking Holmes's gaps to the source material.
- Headline Holmes Score with tunable weights.

**Cut**
- PDF parsing, API key modal and failover key, latency benchmark
- Free-text offset highlighting and three-tool toolbar (now flag, tag, note on a sentence)
- Voice monologue, ambient audio, typewriter sounds
- Separate Bloom's radar and Distractor Autopsy panels
- Per-subtopic Knowledge Index
- Keystroke-level Bloom's evaluation (now on submit or debounced)
