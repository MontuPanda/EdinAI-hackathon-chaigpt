# Protégé: edits to apply

New files (already in `src/services/`): `watsonChat.js`, `moriartyEngine.js`.

---

## 1. `src/main.js`

### 1a. Imports (top)
```js
import { watsonReply } from './services/watsonChat.js';
import { evaluateSession, moriartyTutorReply } from './services/moriartyEngine.js';
```

### 1b. State: add fields
```js
  sourceText: '',        // raw notes (Moriarty only, never shown to Watson)
  sourceInlineData: null,
  chatLog: [],           // Holmes <-> Watson
  evaluation: null,      // cached Moriarty report
  evaluating: false,
  tutorHistory: []       // Holmes <-> Moriarty
```

### 1c. `addChatMessage`: also log it
```js
function addChatMessage(sender, text) {
  state.chatLog.push({ sender, text });
  // ...rest unchanged
```

### 1d. Replace `handleUserSocraticMessage` entirely
```js
async function handleUserSocraticMessage() {
  const text = el.socraticInput.value.trim();
  if (!text) return;

  const history = [...state.chatLog];          // before adding this message
  addChatMessage('holmes', text);
  el.socraticInput.value = '';
  el.sendSocraticBtn.disabled = true;
  el.watsonStatusText.textContent = 'Typing response...';

  try {
    let reply;
    if (state.watsonDocument) {
      reply = await watsonReply({
        doc: state.watsonDocument,
        paragraphIndex: state.currentParagraphIndex,
        history,
        message: text
      });
    } else if (state.currentCase) {
      // legacy preset flow
      reply = await gemini.generateContent({
        systemInstruction: `You are Dr. John Watson, an earnest student studying "${state.currentCase.title}". Modern technical register, 1-2 sentences.`,
        prompt: `The mentor says: "${text}". Your belief: "${state.currentCase.activeBelief}". Respond.`,
        temperature: 0.6
      });
    } else {
      reply = 'Upload some notes first, Holmes, then I will have something to be wrong about.';
    }
    addChatMessage('watson', (reply || '').trim() || 'Could you rephrase that?');
  } catch (err) {
    console.warn('Watson chat error:', err.message);
    addChatMessage('watson', 'I lost my train of thought. Could you say that again?');
  } finally {
    el.watsonStatusText.textContent = 'Active Dialogue';
    el.sendSocraticBtn.disabled = false;
  }
}
```

### 1e. Ingest: keep source + original text (in `handleCustomMaterialIngest`, after `generateWatsonDocument`)
```js
    const watsonDoc = await generateWatsonDocument({ title, content, inlineData });
    watsonDoc.paragraphs.forEach(p => { p.originalContent = p.content; });
    state.sourceText = content;
    state.sourceInlineData = inlineData || null;
    state.evaluation = null;
    state.tutorHistory = [];
    state.chatLog = [];
```

### 1f. Invalidate the cached report whenever teaching changes
Add `state.evaluation = null;` at the top of `approveCurrentParagraph()` and right after
`paragraph.corrections.push({...})` in `applyStrikethroughMarkup()`.

### 1g. Rename the old dossier and add the new one
Rename the existing `openMoriartyDossier` to `openLegacyDossier`, then add:

```js
async function openMoriartyDossier() {
  if (!state.watsonDocument) {
    if (state.currentCase) return openLegacyDossier();
    el.moriartyDossierContent.innerHTML =
      `<p style="color:var(--text-muted);font-size:13px;">Upload notes and teach Watson first. Moriarty has nothing to assess yet.</p>`;
    el.moriartySlideoverBackdrop.classList.add('open');
    return;
  }

  el.moriartySlideoverBackdrop.classList.add('open');
  if (state.evaluating) return;

  if (!state.evaluation) {
    state.evaluating = true;
    el.moriartyDossierContent.innerHTML = `
      <div style="text-align:center;padding:48px 12px;color:var(--text-secondary);">
        <div class="btn-spinner" style="margin:0 auto 14px;width:22px;height:22px;"></div>
        <p style="font-style:italic;">Moriarty is reviewing your corrections against the source...</p>
      </div>`;
    try {
      state.evaluation = await evaluateSession({
        sourceText: state.sourceText,
        inlineData: state.sourceInlineData,
        doc: state.watsonDocument
      });
      const s = state.evaluation.scores;
      logTelemetry('MORIARTY_EVALUATION', `Teaching score: ${s.teachingScore ?? 'n/a'}; corrections: ${s.correctionsMade}.`);
    } finally {
      state.evaluating = false;
    }
  }

  state.currentPhase = 'PHASE_5_TUTOR';
  el.currentPhaseTag.textContent = 'PHASE 5: MORIARTY TUTORING';
  renderMoriartyReport(state.evaluation);
}

function renderMoriartyReport(ev) {
  const s = ev.scores;
  const fmt = v => (v == null ? '—' : v);
  const verdictColor = { ACCURATE: '#10b981', PARTIAL: '#e2b34a', INACCURATE: '#ff6b6b', FALSE_POSITIVE: '#ff6b6b', UNGRADED: '#9ba3b4' };

  el.moriartyDossierContent.innerHTML = `
    ${ev.source === 'offline' ? `<div class="toast toast-error" style="animation:none;">Offline report: not graded against the notes.</div>` : ''}

    <div style="background:rgba(214,158,46,0.08);border:1px solid var(--border-gold);border-radius:var(--radius-md);padding:18px;">
      <span style="font-size:11px;font-weight:800;color:var(--accent-gold);letter-spacing:1px;">CLINICAL ASSESSMENT OF SHERLOCK HOLMES</span>
      <p style="font-style:italic;color:#f0ede6;font-size:13px;line-height:1.6;margin-top:8px;white-space:pre-wrap;">"${escapeHtml(ev.verdict)}"</p>
      <span style="display:block;text-align:right;font-size:11px;color:var(--text-gold);font-weight:700;margin-top:8px;">— Prof. James Moriarty</span>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="dossier-stat"><span>TEACHING SCORE</span><b style="color:var(--accent-emerald)">${fmt(s.teachingScore)}${s.teachingScore != null ? '%' : ''}</b></div>
      <div class="dossier-stat"><span>WATSON'S MASTERY</span><b style="color:var(--accent-cyan)">${fmt(s.watsonBefore)}% → ${fmt(s.watsonAfter)}${s.watsonAfter != null ? '%' : ''}</b></div>
      <div class="dossier-stat"><span>ACCURATE / MADE</span><b>${fmt(s.accurateCorrections)} / ${s.correctionsMade}</b></div>
      <div class="dossier-stat"><span>FALSE ALARMS · MISSED</span><b>${fmt(s.falsePositives)} · ${fmt(s.missedErrors)}</b></div>
    </div>

    ${ev.corrections.length ? `
    <div>
      <span class="dossier-h">YOUR CORRECTIONS, GRADED</span>
      ${ev.corrections.map(c => `
        <div class="dossier-row" style="border-left-color:${verdictColor[c.verdict] || '#9ba3b4'}">
          <b style="color:${verdictColor[c.verdict] || '#9ba3b4'}">${escapeHtml(c.verdict)}</b>
          <span style="color:var(--text-muted)"> · explanation ${Number(c.explanationQuality) || 0}/3</span>
          <p style="font-style:italic;margin:4px 0;">"${escapeHtml(c.selectedText)}"</p>
          <p>${escapeHtml(c.comment)}</p>
        </div>`).join('')}
    </div>` : ''}

    ${ev.unobservedClues.length ? `
    <div style="background:rgba(229,62,62,0.08);border:1px solid var(--border-crimson);border-radius:var(--radius-md);padding:16px;">
      <strong style="font-size:12px;color:var(--text-crimson);font-family:var(--font-serif);">🔎 THE UNOBSERVED CLUES</strong>
      ${ev.unobservedClues.map(c => `
        <p style="font-size:12px;color:#ffd8d8;line-height:1.5;margin-top:8px;">
          <b>"${escapeHtml(c.text)}"</b> (${escapeHtml(c.paragraphId || '')}): ${escapeHtml(c.explanation)}
        </p>`).join('')}
    </div>` : ''}

    ${ev.studyNext.length ? `
    <div>
      <span class="dossier-h">STUDY NEXT</span>
      ${ev.studyNext.map(t => `<div class="dossier-row" style="border-left-color:var(--accent-gold)"><b>${escapeHtml(t.topic)}</b><p>${escapeHtml(t.why)}</p></div>`).join('')}
    </div>` : ''}

    <div>
      <span class="dossier-h">SHADOW TELEMETRY</span>
      ${state.telemetryLogs.map(log => `
        <div class="dossier-row" style="border-left-color:var(--accent-gold)">
          <span style="color:var(--text-gold);font-family:var(--font-mono)">${escapeHtml(log.time)}</span>
          <span style="color:var(--text-secondary)"> ${escapeHtml(log.desc)}</span>
        </div>`).join('')}
    </div>

    <div class="tutor-box">
      <span class="dossier-h">ASK MORIARTY (TUTOR MODE)</span>
      <div class="tutor-log" id="tutorLog"></div>
      <div class="tutor-input">
        <input type="text" id="tutorInput" placeholder="e.g. Why did Watson get that wrong?" autocomplete="off">
        <button class="send-btn" id="tutorSend" title="Ask">➤</button>
      </div>
    </div>
  `;

  const log = document.getElementById('tutorLog');
  const input = document.getElementById('tutorInput');
  const btn = document.getElementById('tutorSend');

  const addTutorBubble = (sender, text) => {
    const b = document.createElement('div');
    b.className = `tutor-bubble ${sender === 'user' ? 'from-user' : 'from-moriarty'}`;
    b.innerHTML = `<span class="sender-tag">${sender === 'user' ? 'HOLMES' : 'MORIARTY'}</span><p>${escapeHtml(text)}</p>`;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
  };

  if (!state.tutorHistory.length) {
    state.tutorHistory.push({ sender: 'moriarty', text: 'Ask, Holmes. I know the material better than you do, and better than Watson ever will.' });
  }
  state.tutorHistory.forEach(m => addTutorBubble(m.sender, m.text));

  const send = async () => {
    const q = input.value.trim();
    if (!q) return;
    const history = [...state.tutorHistory];
    state.tutorHistory.push({ sender: 'user', text: q });
    addTutorBubble('user', q);
    input.value = '';
    btn.disabled = true;
    const reply = await moriartyTutorReply({
      sourceText: state.sourceText,
      inlineData: state.sourceInlineData,
      evaluation: ev,
      doc: state.watsonDocument,
      history,
      question: q
    });
    state.tutorHistory.push({ sender: 'moriarty', text: reply });
    addTutorBubble('moriarty', reply);
    btn.disabled = false;
    input.focus();
  };
  btn.onclick = send;
  input.onkeydown = e => { if (e.key === 'Enter') send(); };
}
```

### 1h. `completeDocumentReview`
Already wires `requestMoriartyBtn` to `openMoriartyDossier`, so no change. Remove the
`autoGitPush` calls from the browser or leave them as no-ops (they only log).

---

## 2. `src/services/watsonDocumentGenerator.js` (two bug fixes)

**a) Empty prompt breaks Gemini** (`updateParagraphFromCorrection`): Gemini rejects an empty `parts` text, so every paragraph rewrite was silently falling back to a plain string replace.
```js
      prompt: 'Rewrite the paragraph now, applying the correction.',
```

**b) `rawJson` out of scope in `generateWatsonDocument`'s catch** (throws a ReferenceError that hides the real error). Declare it before the `try`:
```js
  let rawJson;
  try {
    rawJson = await gemini.generateContent({
```
(and change the inner `const rawJson =` to the assignment above.)

---

## 3. `style.css` (append)

```css
.dossier-stat { background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 14px; border-radius: var(--radius-md); }
.dossier-stat span { display: block; font-size: 10px; color: var(--text-muted); font-weight: 700; letter-spacing: .5px; }
.dossier-stat b { display: block; font-size: 20px; font-family: var(--font-mono); margin-top: 4px; }
.dossier-h { display: block; font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: .5px; margin-bottom: 8px; }
.dossier-row { font-size: 12px; background: rgba(255,255,255,.03); padding: 8px 10px; border-radius: 4px; border-left: 2px solid var(--accent-gold); margin-bottom: 8px; line-height: 1.5; color: var(--text-secondary); }
.tutor-box { border-top: 1px solid var(--border-gold); padding-top: 16px; }
.tutor-log { display: flex; flex-direction: column; gap: 10px; max-height: 320px; overflow-y: auto; margin-bottom: 10px; }
.tutor-bubble { padding: 10px 12px; border-radius: var(--radius-md); font-size: 12px; line-height: 1.5; max-width: 92%; }
.tutor-bubble .sender-tag { display: block; font-size: 10px; font-weight: 700; margin-bottom: 3px; }
.tutor-bubble.from-moriarty { background: rgba(214,158,46,.1); border: 1px solid var(--border-gold); align-self: flex-start; }
.tutor-bubble.from-moriarty .sender-tag { color: var(--accent-gold); }
.tutor-bubble.from-user { background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); align-self: flex-end; }
.tutor-bubble.from-user .sender-tag { color: var(--accent-cyan); text-align: right; }
.tutor-input { display: flex; gap: 8px; }
.tutor-input input { flex: 1; font-size: 12px; padding: 8px 12px; }
```
Also fix the undefined CSS variable `--accent-crimson` (used in `renderCurrentParagraph`): replace with `--text-crimson`.
