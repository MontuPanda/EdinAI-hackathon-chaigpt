/**
 * PROTÉGÉ: The 221B Inverted Pedagogy Platform
 * Core Application Controller & State Machine
 */

import { gemini } from './services/gemini.js';
import { generateCaseFromMaterial } from './services/pmmEngine.js';

// Application State
const state = {
  currentCase: null,
  currentPhase: 'PHASE_1_AWAITING_NOTES', // 'PHASE_1_AWAITING_NOTES' | 'PHASE_2_AUDIT' | 'PHASE_3_REMEDIATION' | 'PHASE_4_RESOLVED'
  annotations: [],
  selectedRange: null,
  selectedText: '',
  attachedFile: null,
  telemetryLogs: []
};

// DOM References
const el = {
  // Nav
  activeCasePill: document.getElementById('activeCasePill'),
  currentCaseName: document.getElementById('currentCaseName'),
  openIngestionBtn: document.getElementById('openIngestionBtn'),
  watsonMasteryBar: document.getElementById('watsonMasteryBar'),
  watsonMasteryVal: document.getElementById('watsonMasteryVal'),
  openMoriartyBtn: document.getElementById('openMoriartyBtn'),
  telemetryEventCount: document.getElementById('telemetryEventCount'),
  openApiSettingsBtn: document.getElementById('openApiSettingsBtn'),
  apiKeyStatusIcon: document.getElementById('apiKeyStatusIcon'),
  apiKeyStatusLabel: document.getElementById('apiKeyStatusLabel'),

  // Watson Panel
  watsonStatusBadge: document.getElementById('watsonStatusBadge'),
  watsonStatusText: document.getElementById('watsonStatusText'),
  watsonActiveBelief: document.getElementById('watsonActiveBelief'),
  dialogueScroll: document.getElementById('dialogueScroll'),
  socraticInput: document.getElementById('socraticInput'),
  sendSocraticBtn: document.getElementById('sendSocraticBtn'),

  // Canvas
  currentPhaseTag: document.getElementById('currentPhaseTag'),
  canvasDocTitle: document.getElementById('canvasDocTitle'),
  canvasActionGroup: document.getElementById('canvasActionGroup'),
  manuscriptContent: document.getElementById('manuscriptContent'),
  marginNotesColumn: document.getElementById('marginNotesColumn'),
  redPenToolbar: document.getElementById('redPenToolbar'),
  toolStrikeBtn: document.getElementById('toolStrikeBtn'),
  toolTagSelect: document.getElementById('toolTagSelect'),
  toolCommentBtn: document.getElementById('toolCommentBtn'),
  remediationStudio: document.getElementById('remediationStudio'),

  // Modals
  apiModalBackdrop: document.getElementById('apiModalBackdrop'),
  closeApiModalBtn: document.getElementById('closeApiModalBtn'),
  primaryApiKey: document.getElementById('primaryApiKey'),
  secondaryApiKey: document.getElementById('secondaryApiKey'),
  modelSelect: document.getElementById('modelSelect'),
  toggleKeyVisBtn: document.getElementById('toggleKeyVisBtn'),
  connectionStatusBox: document.getElementById('connectionStatusBox'),
  statusBoxIndicator: document.getElementById('statusBoxIndicator'),
  statusBoxTitle: document.getElementById('statusBoxTitle'),
  statusBoxDesc: document.getElementById('statusBoxDesc'),
  verifyKeyBtn: document.getElementById('verifyKeyBtn'),
  verifySpinner: document.getElementById('verifySpinner'),
  saveKeyBtn: document.getElementById('saveKeyBtn'),
  useMockModeBtn: document.getElementById('useMockModeBtn'),

  // Ingestion Modal & Dropzone
  ingestionModalBackdrop: document.getElementById('ingestionModalBackdrop'),
  closeIngestionModalBtn: document.getElementById('closeIngestionModalBtn'),
  cancelIngestionBtn: document.getElementById('cancelIngestionBtn'),
  customMaterialTitle: document.getElementById('customMaterialTitle'),
  customMaterialContent: document.getElementById('customMaterialContent'),
  processIngestionBtn: document.getElementById('processIngestionBtn'),
  ingestSpinner: document.getElementById('ingestSpinner'),
  fileDropzone: document.getElementById('fileDropzone'),
  studyFileInput: document.getElementById('studyFileInput'),
  dropzonePrompt: document.getElementById('dropzonePrompt'),
  activeFileCard: document.getElementById('activeFileCard'),
  activeFileName: document.getElementById('activeFileName'),
  activeFileSize: document.getElementById('activeFileSize'),
  removeFileBtn: document.getElementById('removeFileBtn'),

  // Case Grounding Manifest
  openManifestBtn: document.getElementById('openManifestBtn'),
  manifestModalBackdrop: document.getElementById('manifestModalBackdrop'),
  manifestModalBody: document.getElementById('manifestModalBody'),
  manifestSubtitle: document.getElementById('manifestSubtitle'),
  closeManifestModalBtn: document.getElementById('closeManifestModalBtn'),
  closeManifestBtn: document.getElementById('closeManifestBtn'),

  // Moriarty Dossier
  moriartySlideoverBackdrop: document.getElementById('moriartySlideoverBackdrop'),
  closeMoriartyBtn: document.getElementById('closeMoriartyBtn'),
  moriartyDossierContent: document.getElementById('moriartyDossierContent'),

  // Toasts
  toastContainer: document.getElementById('toastContainer')
};

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
function init() {
  setupEventListeners();
  updateApiStatusUI();
  
  if (state.currentCase) {
    renderCase(state.currentCase);
  } else {
    renderEmptyState();
  }

  // If user hasn't configured key yet, prompt modal gently
  if (!gemini.hasValidKey()) {
    setTimeout(() => openApiModal(), 600);
  }
}

/* ==========================================================================
   API KEY & CONNECTION HANDSHAKE (PHASE 1 CORE)
   ========================================================================== */
function openApiModal() {
  el.primaryApiKey.value = gemini.primaryKey;
  el.secondaryApiKey.value = gemini.secondaryKey;
  el.modelSelect.value = gemini.model;
  el.apiModalBackdrop.classList.add('open');
}

function closeApiModal() {
  el.apiModalBackdrop.classList.remove('open');
}

async function verifyApiKeyConnection() {
  const testKey = el.primaryApiKey.value.trim();
  const testModel = el.modelSelect.value;

  if (!testKey) {
    setStatusBox('error', 'Key Missing', 'Please paste your Google AI Studio Gemini API key first.');
    return;
  }

  el.verifySpinner.style.display = 'inline-block';
  el.verifyKeyBtn.disabled = true;
  setStatusBox('idle', 'Testing Handshake...', `Pinging Gemini API via ${testModel}...`);

  try {
    const result = await gemini.testConnection(testKey, testModel);

    if (result.success) {
      setStatusBox(
        'success',
        `Connected to Google Gemini (${result.latencyMs}ms)`,
        `Handshake verified! Model: ${testModel}. You are ready for live AI inference.`
      );
      showToast(`⚡ Handshake confirmed with Google Gemini in ${result.latencyMs}ms!`, 'success');
    } else {
      setStatusBox('error', 'Connection Refused', result.message);
      showToast(`Connection failed: ${result.message}`, 'error');
    }
  } catch (err) {
    setStatusBox('error', 'Connection Error', err.message);
  } finally {
    el.verifySpinner.style.display = 'none';
    el.verifyKeyBtn.disabled = false;
  }
}

function setStatusBox(status, title, desc) {
  el.statusBoxIndicator.className =
    status === 'success'
      ? 'status-indicator-success'
      : status === 'error'
      ? 'status-indicator-error'
      : 'status-indicator-idle';

  el.statusBoxTitle.textContent = title;
  el.statusBoxDesc.textContent = desc;
}

function saveApiSettings() {
  const primaryKey = el.primaryApiKey.value.trim();
  const secondaryKey = el.secondaryApiKey.value.trim();
  const model = el.modelSelect.value;

  gemini.setKeys({ primaryKey, secondaryKey, model, mockMode: false });
  updateApiStatusUI();
  closeApiModal();
  showToast('Gemini API settings saved successfully.', 'success');
}

function enableMockMode() {
  gemini.setKeys({ primaryKey: '', secondaryKey: '', model: 'gemini-3.8-flash', mockMode: true });
  updateApiStatusUI();
  closeApiModal();
  showToast('⚡ Switched to Zero-Latency Offline Mock Demo Mode.', 'success');
}

function updateApiStatusUI() {
  if (gemini.isMockMode) {
    el.apiKeyStatusIcon.textContent = '⚡';
    el.apiKeyStatusLabel.textContent = 'Mock Mode';
    el.openApiSettingsBtn.className = 'settings-btn connected';
  } else if (gemini.primaryKey) {
    el.apiKeyStatusIcon.textContent = '🟢';
    el.apiKeyStatusLabel.textContent = 'Gemini Live';
    el.openApiSettingsBtn.className = 'settings-btn connected';
  } else {
    el.apiKeyStatusIcon.textContent = '⚠️';
    el.apiKeyStatusLabel.textContent = 'Set API Key';
    el.openApiSettingsBtn.className = 'settings-btn';
  }
}

/* ==========================================================================
   CASE RENDERING & WORKSPACE DISPLAY
   ========================================================================== */
function renderEmptyState() {
  state.currentCase = null;
  state.currentPhase = 'PHASE_1_AWAITING_NOTES';

  el.currentCaseName.textContent = 'No Notes Uploaded';
  el.openManifestBtn.style.display = 'none';
  el.openIngestionBtn.textContent = '📁 Upload Notes';

  el.watsonMasteryBar.style.width = '0%';
  el.watsonMasteryVal.textContent = '—';
  el.watsonStatusText.textContent = 'Awaiting Study Material';
  el.watsonStatusBadge.style.color = 'var(--text-muted)';
  el.watsonActiveBelief.textContent = '"Awaiting your lecture notes or syllabus document to begin investigation."';

  el.currentPhaseTag.textContent = 'PHASE 1: INGEST STUDY NOTES';
  el.canvasDocTitle.textContent = "Watson's Study Desk (Awaiting Material)";

  el.manuscriptContent.innerHTML = `
    <div style="text-align: center; padding: 48px 24px;">
      <div style="font-size: 52px; margin-bottom: 16px;">📚</div>
      <h3 style="font-family: var(--font-serif); font-size: 19px; color: var(--text-primary); margin-bottom: 8px;">
        No Study Material Ingested Yet
      </h3>
      <p style="font-size: 13px; color: var(--text-muted); max-width: 480px; margin: 0 auto 24px; line-height: 1.6;">
        Upload your lecture slides, PDF syllabus, or paste your study notes. Dr. Watson will study your specific document and generate his case analysis with subtle misconceptions for you to diagnose.
      </p>
      <button class="btn btn-primary" id="emptyStateUploadBtn" style="padding: 10px 24px; font-size: 13px;">
        📁 Upload Notes or PDF
      </button>
    </div>
  `;

  const uploadBtn = document.getElementById('emptyStateUploadBtn');
  if (uploadBtn) uploadBtn.onclick = openIngestionModal;

  el.marginNotesColumn.innerHTML = '';
  el.remediationStudio.style.display = 'none';
  el.canvasActionGroup.innerHTML = '';

  el.dialogueScroll.innerHTML = '';
  addChatMessage('watson', 'Welcome, Holmes. I am ready to begin. Please upload your lecture notes or syllabus chapter so I can study the material and prepare my initial draft.');
}

function renderCase(caseData) {
  state.currentCase = caseData;
  state.annotations = [];
  state.currentPhase = 'PHASE_2_AUDIT';

  // Update Nav
  el.currentCaseName.textContent = caseData.title;
  el.openManifestBtn.style.display = 'inline-flex';
  el.openIngestionBtn.textContent = 'Change';

  const mastery = caseData.initialMastery || 45;
  el.watsonMasteryBar.style.width = `${mastery}%`;
  el.watsonMasteryVal.textContent = `${mastery}%`;
  el.watsonStatusText.textContent = 'Novice (Pre-instruction)';

  if (caseData.prerequisiteFoundation) {
    el.watsonActiveBelief.innerHTML = `
      <span style="display:block; font-size:11px; color:var(--accent-cyan); margin-bottom:4px;">
        <strong>Baseline:</strong> ${escapeHtml(caseData.prerequisiteFoundation)}
      </span>
      <span style="display:block; font-size:12px; color:var(--text-secondary); font-style:italic;">
        <strong>Naive Belief:</strong> "${escapeHtml(caseData.activeBelief)}"
      </span>
    `;
  } else {
    el.watsonActiveBelief.textContent = `"${caseData.activeBelief}"`;
  }

  // Update Canvas Header
  el.currentPhaseTag.textContent = 'PHASE 2: RED PEN AUDIT';
  el.canvasDocTitle.textContent = `Watson's Working Parchment: ${caseData.title}`;

  // Render Watson's Draft
  const paragraphs = caseData.watsonInitialDraft.split('\n\n');
  el.manuscriptContent.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');

  // Clear margin notes
  el.marginNotesColumn.innerHTML = '';
  el.remediationStudio.style.display = 'none';

  // Render Action Button
  renderCanvasActions();

  // Reset dialogue with Watson's intro
  el.dialogueScroll.innerHTML = '';
  addChatMessage('watson', caseData.watsonDialogue.onLoad);
}

function renderCanvasActions() {
  el.canvasActionGroup.innerHTML = '';

  if (state.currentPhase === 'PHASE_2_AUDIT') {
    const quickAuditBtn = document.createElement('button');
    quickAuditBtn.className = 'btn btn-secondary';
    quickAuditBtn.innerHTML = '⚡ Auto-Highlight Flaw (Demo)';
    quickAuditBtn.title = 'Pre-select Watson\'s subtle misconception for quick demo presentation';
    quickAuditBtn.onclick = triggerAutoDemoHighlight;

    const submitAuditBtn = document.createElement('button');
    submitAuditBtn.className = 'btn btn-primary';
    submitAuditBtn.id = 'submitAuditBtn';
    submitAuditBtn.innerHTML = '✒️ Submit Red Pen Critique';
    submitAuditBtn.onclick = submitRedPenCritique;

    el.canvasActionGroup.appendChild(quickAuditBtn);
    el.canvasActionGroup.appendChild(submitAuditBtn);
  }
}

/* ==========================================================================
   RED PEN CANVAS INTERACTIVITY (CONCEPT 2)
   ========================================================================== */
function handleTextSelection() {
  const selection = window.getSelection();
  const text = selection.toString().trim();

  if (!text || text.length < 5 || !el.manuscriptContent.contains(selection.anchorNode)) {
    el.redPenToolbar.style.display = 'none';
    return;
  }

  state.selectedText = text;
  state.selectedRange = selection.getRangeAt(0).cloneRange();

  // Position the floating toolbar
  el.redPenToolbar.style.display = 'flex';
}

function applyStrikethroughMarkup() {
  if (!state.selectedRange || !state.selectedText) return;

  const tag = el.toolTagSelect.value || 'CONCEPTUAL_FALLACY';
  const span = document.createElement('span');
  span.className = 'red-strike';
  span.dataset.tag = tag;
  span.textContent = state.selectedText;

  // Add click handler to view or edit
  span.onclick = () => showToast(`Tagged as [${tag}]`, 'success');

  state.selectedRange.deleteContents();
  state.selectedRange.insertNode(span);

  // Add margin note
  addMarginSticky(state.selectedText, tag, 'Gravity remains ~90% at orbital altitudes; the true cause of floating is perpetual freefall.');

  // Save annotation state
  state.annotations.push({
    text: state.selectedText,
    tag: tag,
    note: 'Gravity remains ~90% at orbital altitudes; the true cause of floating is perpetual freefall.'
  });

  // Hide toolbar & clear selection
  el.redPenToolbar.style.display = 'none';
  window.getSelection().removeAllRanges();

  showToast('✒️ Strikethrough applied with Red Ink!', 'success');
}

function addMarginSticky(targetText, tag, note) {
  const sticky = document.createElement('div');
  sticky.className = 'margin-sticky';
  sticky.innerHTML = `
    <span class="sticky-tag">✒️ ${escapeHtml(tag)}</span>
    <p><strong>Correction:</strong> ${escapeHtml(note)}</p>
  `;
  el.marginNotesColumn.appendChild(sticky);
}

function triggerAutoDemoHighlight() {
  const preset = state.currentCase;
  if (!preset.suggestedAnnotations?.length) return;

  const anno = preset.suggestedAnnotations[0];
  const content = el.manuscriptContent.innerHTML;

  if (content.includes(anno.targetPhrase)) {
    const marked = content.replace(
      anno.targetPhrase,
      `<span class="red-strike" data-tag="${anno.tag}">${escapeHtml(anno.targetPhrase)}</span>`
    );
    el.manuscriptContent.innerHTML = marked;
    addMarginSticky(anno.targetPhrase, anno.tag, anno.correction);

    state.annotations.push({
      text: anno.targetPhrase,
      tag: anno.tag,
      note: anno.correction
    });

    showToast('Auto-highlighted Watson\'s seeded misconception.', 'success');
  }
}

/* ==========================================================================
   SEAMLESS TRANSITION: AUDIT -> QUIZ STUDIO (PHASE 3 & 4)
   ========================================================================== */
function submitRedPenCritique() {
  if (!state.annotations.length) {
    showToast('Please highlight at least one error in Watson\'s draft first!', 'error');
    return;
  }

  // Update State Machine
  state.currentPhase = 'PHASE_3_REMEDIATION';
  el.currentPhaseTag.textContent = 'PHASE 3: PEDAGOGICAL INTERVENTION';
  el.watsonStatusText.textContent = 'Debating Critique';
  el.watsonStatusBadge.style.color = '#e2b34a';

  // Watson reacts dynamically to the red marks!
  addChatMessage('holmes', `Watson, look at the claim you made here: "${state.annotations[0].text}". That is an incorrect assumption—${state.annotations[0].note}`);
  
  setTimeout(() => {
    addChatMessage('watson', state.currentCase.watsonDialogue.onAudit);
    renderRemediationStudio();
  }, 600);

  // Log Moriarty telemetry
  logTelemetry('RED_PEN_AUDIT_SUBMITTED', `Teacher annotated 1 critical misconception (${state.annotations[0].tag}).`);
}

function renderRemediationStudio() {
  const challenge = state.currentCase.remediationChallenge;

  el.remediationStudio.style.display = 'block';
  el.remediationStudio.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <h3 style="font-family: var(--font-serif); font-size: 15px; color: var(--text-gold);">
          🛠️ Pedagogical Intervention: Author Watson's Remediation Challenge
        </h3>
        <p style="font-size: 12px; color: var(--text-muted);">
          To solidify Watson's understanding, provide a concise explanation and craft a diagnostic challenge with believable distractors.
        </p>
      </div>
      <div style="background: rgba(214, 158, 46, 0.15); border: 1px solid var(--border-gold); padding: 4px 10px; border-radius: 4px; font-size: 11px; color: var(--text-gold); font-weight: 700;">
        Bloom's Rigor: Level 4 (Application & Analysis)
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
      <div class="form-group">
        <label>Your Micro-Lesson (Causal Explanation):</label>
        <textarea id="lessonInput" rows="3" style="width: 100%; font-size: 12px;">${escapeHtml(challenge.lesson)}</textarea>
      </div>
      <div class="form-group">
        <label>Diagnostic Test Question for Watson:</label>
        <textarea id="questionInput" rows="3" style="width: 100%; font-size: 12px;">${escapeHtml(challenge.question)}</textarea>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
      <div class="form-group">
        <label style="color: var(--accent-emerald);">✅ Correct Conceptual Answer:</label>
        <input type="text" id="correctInput" value="${escapeHtml(challenge.correctAnswer)}" style="font-size: 12px;">
      </div>
      <div class="form-group">
        <label style="color: var(--text-crimson);">❌ Distractor #1 (Believable Trap):</label>
        <input type="text" id="distractor1Input" value="${escapeHtml(challenge.distractor1)}" style="font-size: 12px;">
      </div>
      <div class="form-group">
        <label style="color: var(--text-crimson);">❌ Distractor #2 (Plausible Misconception):</label>
        <input type="text" id="distractor2Input" value="${escapeHtml(challenge.distractor2)}" style="font-size: 12px;">
      </div>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button class="btn btn-primary" id="deliverChallengeBtn">
        🎯 Deliver Challenge to Watson
      </button>
    </div>
  `;

  // Bind challenge delivery
  document.getElementById('deliverChallengeBtn').onclick = executeWatsonRetest;

  // Scroll into view
  el.remediationStudio.scrollIntoView({ behavior: 'smooth' });
}

function executeWatsonRetest() {
  const challenge = state.currentCase.remediationChallenge;

  el.watsonStatusText.textContent = 'Deliberating Challenge';
  showToast('Challenge delivered. Watson is evaluating your options...', 'success');

  // Watson's live internal thoughts!
  addChatMessage('watson', `*Watson reviews your lesson notes and evaluates the test options...*`);

  setTimeout(() => {
    addChatMessage(
      'watson',
      `*Thinking Trace:* "Let's see... Distractor 1 claims the vacuum of space blocks gravity—an absurd notion. Distractor 2 claims centrifugal force physically cancels it... Wait! The lesson reminds me of an elevator in freefall! Both the scale and the astronaut accelerate towards Earth together at 8.9 m/s²!"`
    );

    setTimeout(() => {
      // Watson solves it!
      addChatMessage('watson', `The answer must be: "${challenge.correctAnswer}"!`);
      addChatMessage('watson', state.currentCase.watsonDialogue.afterQuizSuccess);

      // Level up Watson's Mastery
      const newMastery = state.currentCase.targetMastery;
      el.watsonMasteryBar.style.width = `${newMastery}%`;
      el.watsonMasteryVal.textContent = `${newMastery}%`;
      el.watsonStatusText.textContent = 'Mastery Achieved';
      el.watsonStatusBadge.style.color = '#10b981';
      el.watsonActiveBelief.textContent = `"Orbital weightlessness is perpetual freefall with zero normal force."`;

      // Update Phase
      state.currentPhase = 'PHASE_4_RESOLVED';
      el.currentPhaseTag.textContent = 'CASE RESOLVED: WATSON PROMOTED';
      el.currentPhaseTag.style.color = '#10b981';
      el.currentPhaseTag.style.borderColor = '#10b981';

      showToast(`🏆 Dr. Watson's topic comprehension jumped to ${newMastery}%!`, 'success');

      logTelemetry('WATSON_RETEST_SUCCESS', `Watson resolved misconception. Mastery increased to ${newMastery}%.`);
      logTelemetry('BLOOM_DEPTH_EVALUATION', `Authored question scored Bloom Level 4.6 (Analytical rigor).`);

      // Prompt Moriarty Dossier
      setTimeout(() => {
        showToast('🕷️ Professor Moriarty has finalized his Shadow Assessment.', 'success');
      }, 1000);
    }, 1200);
  }, 1000);
}

/* ==========================================================================
   SOCRATIC DIALOGUE HELPERS
   ========================================================================== */
function addChatMessage(sender, text) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble bubble-${sender}`;
  bubble.innerHTML = `
    <span class="sender-tag">${sender === 'watson' ? 'DR. JOHN WATSON' : 'SHERLOCK HOLMES'}</span>
    <p>${escapeHtml(text)}</p>
  `;
  el.dialogueScroll.appendChild(bubble);
  el.dialogueScroll.scrollTop = el.dialogueScroll.scrollHeight;
}

async function handleUserSocraticMessage() {
  const text = el.socraticInput.value.trim();
  if (!text) return;

  addChatMessage('holmes', text);
  el.socraticInput.value = '';

  // Watson thinking state
  el.watsonStatusText.textContent = 'Typing response...';

  // If Gemini API is configured, generate live response in the domain style!
  if (gemini.hasValidKey() && !gemini.isMockMode) {
    try {
      const systemInstruction = `You are Dr. John Watson, acting as an earnest, intelligent student/tutee studying "${state.currentCase.title}".
Your tone should be that of a smart university student/researcher: respectful, engaged, and modern.
DO NOT use archaic Victorian language (no "By Jove", "Good heavens", or 19th-century slang). Use the clean, technical language of the topic.
The user (Sherlock Holmes) is your mentor teaching you. Respond in 1-2 concise sentences reflecting on their point.`;

      const response = await gemini.generateContent({
        systemInstruction,
        prompt: `The mentor says: "${text}". Your current active belief is: "${state.currentCase.activeBelief}". How do you respond?`,
        temperature: 0.6
      });

      if (response) {
        addChatMessage('watson', response.trim());
        el.watsonStatusText.textContent = 'Active Dialogue';
        return;
      }
    } catch (err) {
      console.warn('Gemini chat fallback:', err.message);
    }
  }

  // Realistic modern fallback
  setTimeout(() => {
    addChatMessage('watson', `That makes sense, but how does that apply when you calculate the net forces acting on the system?`);
    el.watsonStatusText.textContent = 'Active Dialogue';
  }, 500);
}

/* ==========================================================================
   MORIARTY'S SHADOW DOSSIER (PHASE 5)
   ========================================================================== */
function openMoriartyDossier() {
  const debrief = state.currentCase.moriartyDebrief;

  el.moriartyDossierContent.innerHTML = `
    <div style="background: rgba(214, 158, 46, 0.08); border: 1px solid var(--border-gold); border-radius: var(--radius-md); padding: 18px;">
      <span style="font-size: 11px; font-weight: 800; color: var(--accent-gold); letter-spacing: 1px;">
        CLINICAL ASSESSMENT OF SHERLOCK HOLMES
      </span>
      <p style="font-style: italic; color: #f0ede6; font-size: 13px; line-height: 1.6; margin-top: 8px;">
        "${debrief.verdict}"
      </p>
      <span style="display: block; text-align: right; font-size: 11px; color: var(--text-gold); font-weight: 700; margin-top: 8px;">
        — Prof. James Moriarty
      </span>
    </div>

    <!-- Metrics Radar / Scores -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 14px; border-radius: var(--radius-md);">
        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">DIAGNOSTIC ACUITY</span>
        <div style="font-size: 24px; font-weight: 900; color: var(--accent-emerald); font-family: var(--font-mono); margin-top: 4px;">
          ${debrief.acuityScore}%
        </div>
        <p style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">
          Spotted 100% of seeded cognitive traps without false alarms.
        </p>
      </div>

      <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 14px; border-radius: var(--radius-md);">
        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">BLOOM'S RIGOR</span>
        <div style="font-size: 24px; font-weight: 900; color: var(--accent-cyan); font-family: var(--font-mono); margin-top: 4px;">
          L ${debrief.bloomLevel}
        </div>
        <p style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">
          Synthesis & Analysis level question authoring.
        </p>
      </div>
    </div>

    <!-- The Unobserved Clues -->
    <div style="background: rgba(229, 62, 62, 0.08); border: 1px solid var(--border-crimson); border-radius: var(--radius-md); padding: 16px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <span style="color: var(--text-crimson); font-size: 14px;">🔎</span>
        <strong style="font-size: 12px; color: var(--text-crimson); font-family: var(--font-serif);">
          THE UNOBSERVED CLUES (What Holmes Walked Past)
        </strong>
      </div>
      <p style="font-size: 12px; color: #ffd8d8; line-height: 1.5;">
        ${debrief.unobservedClues}
      </p>
    </div>

    <!-- Audit Event Stream -->
    <div>
      <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">
        SHADOW TELEMETRY EVENT STREAM
      </span>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
        ${state.telemetryLogs.map(log => `
          <div style="display: flex; gap: 10px; font-size: 11px; background: rgba(255,255,255,0.03); padding: 6px 10px; border-radius: 4px; border-left: 2px solid var(--accent-gold);">
            <span style="color: var(--text-gold); font-family: var(--font-mono);">${log.time}</span>
            <span style="color: var(--text-secondary);">${log.desc}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  el.moriartySlideoverBackdrop.classList.add('open');
}

function closeMoriartyDossier() {
  el.moriartySlideoverBackdrop.classList.remove('open');
}

function logTelemetry(type, desc) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  state.telemetryLogs.push({ type, time, desc });
  el.telemetryEventCount.textContent = state.telemetryLogs.length;
}

/* ==========================================================================
   INGESTION & PRESETS (PHASE 2)
   ========================================================================== */
function openIngestionModal() {
  el.ingestionModalBackdrop.classList.add('open');
}

function closeIngestionModal() {
  el.ingestionModalBackdrop.classList.remove('open');
}

/* ==========================================================================
   FILE DROPZONE & CUSTOM INGESTION (PHASE 2)
   ========================================================================== */
function handleFileSelected(file) {
  if (!file) return;

  const fileName = file.name;
  const fileSizeKB = Math.round(file.size / 1024);
  const isPdf = file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

  // Auto-populate title if empty
  if (!el.customMaterialTitle.value.trim()) {
    const cleanTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    el.customMaterialTitle.value = cleanTitle;
  }

  if (isPdf) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result.split(',')[1];
      state.attachedFile = {
        name: fileName,
        size: `${fileSizeKB} KB`,
        type: 'application/pdf',
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data
        }
      };
      displayActiveFileCard(fileName, `${fileSizeKB} KB`, '📄');
      showToast(`PDF loaded: ${fileName} (${fileSizeKB} KB)`, 'success');
    };
    reader.readAsDataURL(file);
  } else {
    // Read plain text or markdown
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      state.attachedFile = {
        name: fileName,
        size: `${fileSizeKB} KB`,
        type: 'text/plain',
        textContent: text
      };
      el.customMaterialContent.value = text;
      displayActiveFileCard(fileName, `${fileSizeKB} KB`, '📝');
      showToast(`Notes extracted from ${fileName} (${text.length} characters)`, 'success');
    };
    reader.readAsText(file);
  }
}

function displayActiveFileCard(name, size, icon = '📄') {
  el.dropzonePrompt.style.display = 'none';
  el.activeFileCard.style.display = 'flex';
  el.activeFileName.textContent = name;
  el.activeFileSize.textContent = size;
}

function clearAttachedFile(e) {
  if (e) e.stopPropagation();
  state.attachedFile = null;
  el.studyFileInput.value = '';
  el.activeFileCard.style.display = 'none';
  el.dropzonePrompt.style.display = 'flex';
  showToast('Attached file removed.', 'info');
}

async function handleCustomMaterialIngest() {
  const title = el.customMaterialTitle.value.trim();
  const content = el.customMaterialContent.value.trim();
  const inlineData = state.attachedFile?.inlineData;

  if (!content && !inlineData) {
    showToast('Please drop a study document (PDF/TXT/MD) or paste notes first.', 'error');
    return;
  }

  if (!gemini.hasValidKey()) {
    showToast('Please configure your Gemini API Key first to generate custom cases.', 'error');
    openApiModal();
    return;
  }

  el.processIngestionBtn.disabled = true;
  el.ingestSpinner.style.display = 'inline-block';
  showToast(`Extracting canonical axioms and seeding Watson with ${gemini.model}...`, 'info');

  try {
    const generatedCase = await generateCaseFromMaterial({ title, content, inlineData });
    renderCase(generatedCase);
    closeIngestionModal();
    showToast(`Case grounded: "${generatedCase.title}"!`, 'success');
    logTelemetry('MATERIAL_INGESTED', `Grounded "${generatedCase.title}" from uploaded notes with seeded Watson misconception.`);
  } catch (err) {
    console.error('Ingestion error:', err);
    showToast(`Failed to process material: ${err.message}`, 'error');
  } finally {
    el.processIngestionBtn.disabled = false;
    el.ingestSpinner.style.display = 'none';
  }
}

/* ==========================================================================
   CASE GROUNDING MANIFEST INSPECTOR
   ========================================================================== */
function openManifestModal() {
  const curCase = state.currentCase;
  el.manifestSubtitle.textContent = `Axioms & Seeded Traps for "${curCase.title}"`;
  
  el.manifestModalBody.innerHTML = `
    <div class="manifest-badge-group">
      <span class="manifest-badge badge-gold">Domain: ${curCase.category || 'General'}</span>
      <span class="manifest-badge badge-emerald">Difficulty: ${curCase.difficulty || 'MODERATE'}</span>
      <span class="manifest-badge badge-gold">Watson Mastery: ${curCase.initialMastery}% ➔ Target: ${curCase.targetMastery}%</span>
    </div>

    ${curCase.prerequisiteFoundation ? `
      <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-left: 3px solid var(--accent-cyan); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #e0f2fe;">
        <strong style="color: var(--accent-cyan); display: block; font-size: 11px; margin-bottom: 4px;">
          📚 WATSON'S PREREQUISITE BASELINE (What he knows):
        </strong>
        ${escapeHtml(curCase.prerequisiteFoundation)}
      </div>
    ` : ''}

    <div style="margin-bottom: 16px;">
      <h5 style="font-size: 11px; font-weight: 800; color: var(--accent-emerald); letter-spacing: 0.5px; margin-bottom: 8px;">
        CANONICAL AXIOMS (Target Knowledge from Uploaded Notes):
      </h5>
      ${(curCase.canonicalAxioms || []).map((axiom, i) => `
        <div class="manifest-axiom-card">
          <strong>Axiom ${i + 1}:</strong> ${escapeHtml(axiom)}
        </div>
      `).join('')}
    </div>

    <div style="margin-bottom: 16px;">
      <h5 style="font-size: 11px; font-weight: 800; color: var(--text-crimson); letter-spacing: 0.5px; margin-bottom: 8px;">
        SEEDED WATSON TRAPS (Plausible Misconceptions):
      </h5>
      ${(curCase.seededMisconceptions || []).map(trap => `
        <div class="manifest-trap-card">
          <div style="font-size: 10px; font-weight: 800; color: var(--text-crimson); margin-bottom: 4px;">
            [${escapeHtml(trap.category || 'MISCONCEPTION')}] ${escapeHtml(trap.concept || '')}
          </div>
          <p><strong>Watson's Seeded Error:</strong> "${escapeHtml(trap.errorText || '')}"</p>
          <p style="margin-top: 4px; color: #fca5a5;"><strong>Scientific Truth:</strong> ${escapeHtml(trap.explanation || '')}</p>
        </div>
      `).join('')}
    </div>

    <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 12px; border-radius: var(--radius-sm);">
      <span style="font-size: 10px; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 4px;">
        WATSON'S ACTIVE INTELLECTUAL MODEL:
      </span>
      <p style="font-style: italic; color: var(--text-gold); font-size: 12px;">
        "${escapeHtml(curCase.activeBelief)}"
      </p>
    </div>
  `;

  el.manifestModalBackdrop.classList.add('open');
}

function closeManifestModal() {
  el.manifestModalBackdrop.classList.remove('open');
}

/* ==========================================================================
   EVENT LISTENERS SETUP
   ========================================================================== */
function setupEventListeners() {
  // API Modal
  el.openApiSettingsBtn.onclick = openApiModal;
  el.closeApiModalBtn.onclick = closeApiModal;
  el.verifyKeyBtn.onclick = verifyApiKeyConnection;
  el.saveKeyBtn.onclick = saveApiSettings;
  el.useMockModeBtn.onclick = enableMockMode;
  el.toggleKeyVisBtn.onclick = () => {
    el.primaryApiKey.type = el.primaryApiKey.type === 'password' ? 'text' : 'password';
  };

  // Ingestion Modal
  el.openIngestionBtn.onclick = openIngestionModal;
  el.closeIngestionModalBtn.onclick = closeIngestionModal;
  el.cancelIngestionBtn.onclick = closeIngestionModal;
  el.processIngestionBtn.onclick = handleCustomMaterialIngest;

  // File Dropzone Event Listeners
  el.fileDropzone.onclick = () => el.studyFileInput.click();
  el.studyFileInput.onchange = e => {
    if (e.target.files?.length) handleFileSelected(e.target.files[0]);
  };
  el.removeFileBtn.onclick = clearAttachedFile;

  el.fileDropzone.ondragover = e => {
    e.preventDefault();
    el.fileDropzone.classList.add('dragover');
  };
  el.fileDropzone.ondragleave = () => el.fileDropzone.classList.remove('dragover');
  el.fileDropzone.ondrop = e => {
    e.preventDefault();
    el.fileDropzone.classList.remove('dragover');
    if (e.dataTransfer.files?.length) handleFileSelected(e.dataTransfer.files[0]);
  };

  // Case Grounding Manifest Modal
  el.openManifestBtn.onclick = openManifestModal;
  el.closeManifestModalBtn.onclick = closeManifestModal;
  el.closeManifestBtn.onclick = closeManifestModal;

  // Moriarty Dossier
  el.openMoriartyBtn.onclick = openMoriartyDossier;
  el.closeMoriartyBtn.onclick = closeMoriartyDossier;

  // Text Selection on Parchment
  el.manuscriptContent.onmouseup = handleTextSelection;
  el.manuscriptContent.ontouchend = handleTextSelection;
  el.toolStrikeBtn.onclick = applyStrikethroughMarkup;
  el.toolCommentBtn.onclick = applyStrikethroughMarkup;

  // Socratic Chat
  el.sendSocraticBtn.onclick = handleUserSocraticMessage;
  el.socraticInput.onkeydown = e => {
    if (e.key === 'Enter') handleUserSocraticMessage();
  };

  // Backdrop clicks
  el.apiModalBackdrop.onclick = e => {
    if (e.target === el.apiModalBackdrop) closeApiModal();
  };
  el.ingestionModalBackdrop.onclick = e => {
    if (e.target === el.ingestionModalBackdrop) closeIngestionModal();
  };
  el.moriartySlideoverBackdrop.onclick = e => {
    if (e.target === el.moriartySlideoverBackdrop) closeMoriartyDossier();
  };
}

/* ==========================================================================
   UI UTILITIES
   ========================================================================== */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  el.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Bootstrap
window.addEventListener('DOMContentLoaded', init);
