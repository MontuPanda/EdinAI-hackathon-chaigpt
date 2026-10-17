/**
 * PROTÉGÉ: The 221B Inverted Pedagogy Platform
 * Core Application Controller & State Machine
 */

import { gemini } from './services/gemini.js';
import { generateCaseFromMaterial } from './services/pmmEngine.js';
import { applyTeachingToDocument, generateWatsonDocument } from './services/watsonDocumentGenerator.js';
import { buildAnnotationPayload, computeDiagnosticMetrics } from './services/sessionMetrics.js';
import { askMoriartyTutor, evaluateWatsonDocument, summarizeUserErrors } from './services/moriartyEvaluator.js';

// Application State
const state = {
  currentCase: null,
  currentPhase: 'PHASE_1_AWAITING_NOTES', // 'PHASE_1_AWAITING_NOTES' | 'PHASE_2_AUDIT' | 'PHASE_3_REMEDIATION' | 'PHASE_4_RESOLVED'
  annotations: [],
  attachedFile: null,
  telemetryLogs: [],
  eventLog: [],
  // Watson document state for paragraph-based workflow
  watsonDocument: null,
  currentParagraphIndex: 0
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

  state.currentCase = null;
  renderEmptyState();

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

  el.telemetryEventCount.textContent = state.telemetryLogs.length;
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
        Upload your lecture slides, PDF syllabus, or paste your study notes. Dr. Watson will study your document and generate an initial understanding. You'll then review and correct it paragraph by paragraph.
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
  state.eventLog = [];
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
  const draftSentences = Array.isArray(caseData.watson_draft) ? caseData.watson_draft : (caseData.watsonInitialDraft || '').split('\n\n').map((text, index) => ({ id: `legacy_${index + 1}`, text, label: 'VALID' }));
  el.manuscriptContent.innerHTML = draftSentences.map((sentence) => `
    <p class="draft-sentence" data-sentence-id="${sentence.id}" style="margin-bottom: 10px; line-height: 1.8;">
      ${escapeHtml(sentence.text)}
    </p>
  `).join('');

  // Clear margin notes
  el.marginNotesColumn.innerHTML = '';
  el.remediationStudio.style.display = 'none';

  // Render Action Button
  renderCanvasActions();

  // Reset dialogue with Watson's intro
  el.dialogueScroll.innerHTML = '';
  addChatMessage('watson', caseData.watsonDialogue.onLoad);
}

function renderWatsonDocument(watsonDoc) {
  if (!watsonDoc.initialParagraphs) {
    watsonDoc.initialParagraphs = watsonDoc.paragraphs.map(({ id, topic, content }) => ({ id, topic, content }));
  }

  state.watsonDocument = watsonDoc;
  state.currentParagraphIndex = 0;
  state.currentPhase = 'PHASE_2_PARAGRAPH_REVIEW';
  state.annotations = [];

  // Update Nav
  el.currentCaseName.textContent = watsonDoc.title;
  el.openManifestBtn.style.display = 'none'; // Hidden in new workflow
  el.openIngestionBtn.textContent = 'Change';

  // Update Watson status
  const accuracy = Math.round(watsonDoc.overallAccuracy * 100);
  el.watsonMasteryBar.style.width = `${accuracy}%`;
  el.watsonMasteryVal.textContent = `${accuracy}%`;
  el.watsonStatusText.textContent = 'Initial Understanding';
  el.watsonActiveBelief.textContent = `"${watsonDoc.selfAssessment}"`;

  // Update Canvas Header
  el.currentPhaseTag.textContent = 'PHASE 2: PARAGRAPH REVIEW';
  el.canvasDocTitle.textContent = `Watson's Document: ${watsonDoc.title}`;

  // Render current paragraph
  renderCurrentParagraph();

  // Clear margin notes
  el.marginNotesColumn.innerHTML = '';
  el.remediationStudio.style.display = 'none';

  // Render paragraph navigation
  renderParagraphNavigation();

  // Reset dialogue
  el.dialogueScroll.innerHTML = '';
  addChatMessage('watson', `I've read the notes and written my understanding. Here's my first paragraph. I'm still learning this topic, so please correct any errors you find.`);
}

function renderCurrentParagraph() {
  const doc = state.watsonDocument;
  const index = state.currentParagraphIndex;
  const paragraph = doc.paragraphs[index];

  if (!paragraph) return;

  // Show correction count if any
  const corrections = paragraph.corrections || [];
  const correctionCount = corrections.length;
  const correctionBadge = correctionCount > 0
    ? `<span style="margin-left: 8px; background: var(--accent-crimson); color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700;">
        ${correctionCount} correction${correctionCount > 1 ? 's' : ''}
       </span>`
    : '';

  // Show paragraph with topic header - make text selectable for Red Pen
  el.manuscriptContent.innerHTML = `
    <div id="currentParagraphContainer" style="margin-bottom: 24px;">
      <div style="font-size: 11px; color: var(--accent-gold); font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
        Topic: ${escapeHtml(paragraph.topic || 'General')}
        ${correctionBadge}
      </div>
      <p id="paragraphText" style="font-size: 14px; line-height: 1.7; color: var(--text-primary); user-select: text;">
        ${renderParagraphWithErrorFlags(paragraph)}
      </p>
      <div style="margin-top: 12px; font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between;">
        <span>Confidence: ${Math.round(paragraph.confidence * 100)}%</span>
        <span>${paragraph.isCorrected ? '✓ Corrected' : '⏳ Pending review'}</span>
      </div>
    </div>
  `;

  // Show correction history in margin notes
  if (corrections.length > 0) {
    el.marginNotesColumn.innerHTML = corrections.map((corr) => `
      <div class="margin-sticky" style="border-left: 3px solid var(--accent-crimson);">
        <span class="sticky-tag">${corr.tag === 'CHAT_IDENTIFIED_ERROR' ? 'CHAT-FLAGGED ERROR' : escapeHtml(corr.tag)}</span>
        <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">
          "${escapeHtml(corr.selectedText)}"
        </p>
        <p><strong>Correction:</strong> ${escapeHtml(corr.userCorrection)}</p>
      </div>
    `).join('');
  } else {
    el.marginNotesColumn.innerHTML = '';
  }
}

function renderParagraphWithErrorFlags(paragraph) {
  const content = String(paragraph.content || '');
  const matches = (paragraph.flaggedErrors || [])
    .map((error) => ({ error, start: content.indexOf(error.text) }))
    .filter((match) => match.start >= 0)
    .sort((left, right) => left.start - right.start);

  let html = '';
  let cursor = 0;
  matches.forEach(({ error, start }) => {
    if (start < cursor) return;
    html += escapeHtml(content.slice(cursor, start));
    html += `<mark class="auto-error-flag" title="${escapeHtml(error.explanation || 'Flagged from chat')}">${escapeHtml(error.text)}</mark>`;
    cursor = start + error.text.length;
  });

  return html + escapeHtml(content.slice(cursor));
}

function renderParagraphNavigation() {
  const doc = state.watsonDocument;
  const index = state.currentParagraphIndex;
  const total = doc.paragraphs.length;

  el.canvasActionGroup.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--text-muted);">
      <span>Paragraph ${index + 1} of ${total}</span>
      <div style="flex: 1; height: 4px; background: var(--bg-surface-elevated); border-radius: 2px;">
        <div style="width: ${((index + 1) / total) * 100}%; height: 100%; background: var(--accent-gold); border-radius: 2px; transition: width 0.3s;"></div>
      </div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-secondary" id="prevParagraphBtn" ${index === 0 ? 'disabled' : ''}>
        ← Previous
      </button>
      <button class="btn btn-secondary" id="approveParagraphBtn">
        ✓ Approve
      </button>
      <button class="btn btn-primary" id="nextParagraphBtn" ${index === total - 1 ? 'disabled' : ''}>
        Next →
      </button>
    </div>
  `;

  // Bind events
  document.getElementById('prevParagraphBtn').onclick = navigateToPreviousParagraph;
  document.getElementById('approveParagraphBtn').onclick = approveCurrentParagraph;
  document.getElementById('nextParagraphBtn').onclick = navigateToNextParagraph;
}

function navigateToPreviousParagraph() {
  if (state.currentParagraphIndex > 0) {
    state.currentParagraphIndex--;
    renderCurrentParagraph();
    renderParagraphNavigation();
  }
}

function navigateToNextParagraph() {
  const doc = state.watsonDocument;
  if (state.currentParagraphIndex < doc.paragraphs.length - 1) {
    state.currentParagraphIndex++;
    renderCurrentParagraph();
    renderParagraphNavigation();
  }
}

function approveCurrentParagraph() {
  const doc = state.watsonDocument;
  const paragraph = doc.paragraphs[state.currentParagraphIndex];

  paragraph.isCorrected = true;
  paragraph.isApproved = true;

  showToast(`Paragraph ${state.currentParagraphIndex + 1} approved`, 'success');
  addChatMessage('watson', 'Thanks for reviewing this paragraph. Should I move to the next one?');

  // Auto navigate to next if available
  if (state.currentParagraphIndex < doc.paragraphs.length - 1) {
    setTimeout(() => navigateToNextParagraph(), 1000);
  } else {
    // All paragraphs reviewed
    completeDocumentReview();
  }
}

function completeDocumentReview() {
  state.currentPhase = 'PHASE_3_REVIEW_COMPLETE';
  el.currentPhaseTag.textContent = 'DOCUMENT REVIEW COMPLETE';
  el.currentPhaseTag.style.color = '#10b981';
  el.currentPhaseTag.style.borderColor = '#10b981';

  // Calculate overall accuracy
  const doc = state.watsonDocument;
  const avgConfidence = doc.paragraphs.reduce((sum, p) => sum + p.confidence, 0) / doc.paragraphs.length;
  const totalCorrections = doc.paragraphs.reduce((sum, p) => sum + p.corrections.length, 0);

  el.canvasActionGroup.innerHTML = `
    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px; font-size: 12px; color: var(--text-muted);">
      <span>Total corrections: ${totalCorrections}</span>
      <span>•</span>
      <span>Average confidence: ${Math.round(avgConfidence * 100)}%</span>
    </div>
    <button class="btn btn-primary" id="requestMoriartyBtn">
      🕷️ Request Moriarty's Evaluation
    </button>
  `;

  document.getElementById('requestMoriartyBtn').onclick = openMoriartyDossier;

  addChatMessage('watson', `I've completed my document based on your ${totalCorrections} correction${totalCorrections !== 1 ? 's' : ''}. Thank you for teaching me!`);
  showToast('Document review complete! Moriarty will evaluate the final document.', 'success');

  // Auto git push
  autoGitPush('Document review complete - requesting Moriarty evaluation');
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
  if (!preset?.suggestedAnnotations?.length) return;

  const anno = preset.suggestedAnnotations[0];
  const content = el.manuscriptContent.innerHTML;
  const draftText = Array.isArray(preset.watson_draft)
    ? preset.watson_draft.find((sentence) => sentence.id === anno.sentence_id || sentence.text === anno.targetPhrase)?.text || anno.targetPhrase
    : anno.targetPhrase;

  if (content.includes(escapeHtml(draftText))) {
    const marked = content.replace(
      escapeHtml(draftText),
      `<span class="red-strike" data-tag="${anno.tag}" data-sentence-id="${anno.sentence_id || 'demo'}">${escapeHtml(draftText)}</span>`
    );
    el.manuscriptContent.innerHTML = marked;
    addMarginSticky(draftText, anno.tag, anno.correction);

    state.annotations.push({
      text: draftText,
      sentence_id: anno.sentence_id || 'demo',
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

  const draftSentences = Array.isArray(state.currentCase?.watson_draft)
    ? state.currentCase.watson_draft
    : (state.currentCase?.watsonInitialDraft || '').split('\n\n').map((text, index) => ({ id: `legacy_${index + 1}`, text, label: 'VALID' }));

  const metricSummary = computeDiagnosticMetrics({
    sentences: draftSentences,
    annotations: state.annotations
  });

  const payload = buildAnnotationPayload({
    caseId: state.currentCase?.case_id || state.currentCase?.id || 'uploaded_case',
    annotations: state.annotations,
    overallAssessment: `Watson struggled with the flagged misconception set. Recall: ${metricSummary.recall.toFixed(2)} with ${metricSummary.false_alarms} false alarms.`
  });

  state.eventLog.push({
    type: 'AUDIT_SUBMITTED',
    payload
  });

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
  logTelemetry('RED_PEN_AUDIT_SUBMITTED', `Teacher annotated ${state.annotations.length} issue(s); recall ${metricSummary.recall.toFixed(2)} with ${metricSummary.false_alarms} false alarms.`);

  // Auto-push changes to git
  autoGitPush(`Red pen critique submitted - ${state.annotations.length} annotation(s)`);
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
      `*Thinking Trace:* "Let me evaluate each option against what you taught me... The distractors seem to appeal to my earlier misunderstanding, but your lesson clarifies the actual mechanism. I should apply that reasoning here."`
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
      el.watsonActiveBelief.textContent = `"${state.currentCase.activeBelief}" (updated based on your guidance)`;

      // Update Phase
      state.currentPhase = 'PHASE_4_RESOLVED';
      el.currentPhaseTag.textContent = 'CASE RESOLVED: WATSON PROMOTED';
      el.currentPhaseTag.style.color = '#10b981';
      el.currentPhaseTag.style.borderColor = '#10b981';

      showToast(`🏆 Dr. Watson's topic comprehension jumped to ${newMastery}%!`, 'success');

      logTelemetry('WATSON_RETEST_SUCCESS', `Watson resolved misconception. Mastery increased to ${newMastery}%.`);
      logTelemetry('BLOOM_DEPTH_EVALUATION', `Authored question scored Bloom Level 4.6 (Analytical rigor).`);

      // Auto-push changes to git
      autoGitPush(`Watson resolved misconception - Mastery increased to ${newMastery}%`);

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

  if (state.watsonDocument) {
    const document = state.watsonDocument;
    const currentIndex = state.currentParagraphIndex;
    el.watsonStatusText.textContent = 'Updating document...';

    const update = await applyTeachingToDocument({
      document,
      teaching: text,
      currentParagraphIndex: currentIndex
    });

    document.paragraphs = update.paragraphs;
    if (update.teachingApplied) {
      document.teachingNotes = [...(document.teachingNotes || []), text];
    }
    document.overallAccuracy = document.paragraphs.reduce((total, paragraph) => total + (paragraph.confidence || 0), 0) / document.paragraphs.length;
    update.flaggedErrors.forEach((error, index) => {
      const sentenceId = `${error.paragraphId}_chat_${Date.now()}_${index}`;
      state.annotations.push({
        sentence_id: sentenceId,
        tag: 'CHAT_IDENTIFIED_ERROR',
        note: error.explanation || text,
        text: error.text,
        severity: 'HIGH'
      });
      recordSessionEvent('CHAT_ERROR_FLAGGED', { sentence_id: sentenceId, message: error.text });
    });
    const accuracy = Math.round(document.overallAccuracy * 100);
    el.watsonMasteryBar.style.width = `${accuracy}%`;
    el.watsonMasteryVal.textContent = `${accuracy}%`;
    renderCurrentParagraph();
    addChatMessage('watson', update.response);
    el.watsonStatusText.textContent = 'Active Dialogue';
    recordSessionEvent('TEACHING_MESSAGE_APPLIED', { message: text });
    return;
  }

  // Context based on workflow
  let context = '';
  let currentUnderstanding = '';

  if (state.watsonDocument) {
    // Paragraph-based workflow
    const doc = state.watsonDocument;
    const currentPara = doc.paragraphs[state.currentParagraphIndex];
    context = `Topic: ${doc.title}\n\nCurrent paragraph topic: ${currentPara?.topic || 'General'}\n\nMy current understanding: ${currentPara?.content || 'Still learning'}`;
    currentUnderstanding = doc.selfAssessment || 'I am still learning this topic from your guidance.';
  } else if (state.currentCase) {
    // Old workflow
    context = `Topic: ${state.currentCase.title}`;
    currentUnderstanding = state.currentCase.activeBelief || 'I am learning from your notes.';
  }

  // If Gemini API is configured, generate live response
  if (gemini.hasValidKey() && !gemini.isMockMode) {
    try {
      const systemInstruction = `You are Dr. John Watson, a bright student with general knowledge but no domain-specific expertise about this topic yet.
You are learning from your mentor (Sherlock Holmes) who is teaching you.
Your tone should be that of a smart university student/researcher: respectful, engaged, and modern.
DO NOT use archaic Victorian language (no "By Jove", "Good heavens", or 19th-century slang). Use the clean, technical language of the topic.
The user is your mentor. Respond in 1-2 concise sentences showing your current understanding or asking for clarification.`;

      const response = await gemini.generateContent({
        systemInstruction,
        prompt: `Context: ${context}\n\nMy current understanding: ${currentUnderstanding}\n\nMy mentor says: "${text}". How do I respond?`,
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

  // Contextual fallback
  setTimeout(() => {
    if (state.watsonDocument) {
      const doc = state.watsonDocument;
      const currentPara = doc.paragraphs[state.currentParagraphIndex];
      addChatMessage('watson', `I see. That helps clarify my understanding of ${currentPara?.topic || 'this topic'}. Can you tell me more about how this works?`);
    } else {
      addChatMessage('watson', `That makes sense. I'm still learning this concept from your guidance. Could you explain how this applies to what we're studying?`);
    }
    el.watsonStatusText.textContent = 'Active Dialogue';
  }, 500);
}

/* ==========================================================================
   MORIARTY'S SHADOW DOSSIER (PHASE 5)
   ========================================================================== */
async function openMoriartyDossier() {
  const debrief = state.currentCase?.moriartyDebrief || {
    verdict: 'No case data available.',
    acuityScore: 0,
    bloomLevel: 0,
    unobservedClues: 'No unobserved clues.'
  };

  let evaluation = null;
  if (state.watsonDocument) {
    evaluation = await evaluateWatsonDocument({
      watsonDocument: state.watsonDocument,
      sourceMaterial: state.watsonDocument.sourceMaterial || state.currentCase?.sourceMaterial || state.currentCase?.watsonInitialDraft || '',
      inlineData: state.watsonDocument.sourceInlineData
    });
  }

  const userErrors = summarizeUserErrors({
    annotations: state.annotations,
    flawedSentences: state.currentCase?.seededMisconceptions || [],
    evaluation: evaluation?.userTeachingEvaluation ? evaluation : null
  });
  const missedErrors = evaluation?.userTeachingEvaluation?.missedErrors;
  const missedErrorsAvailable = Array.isArray(missedErrors) && evaluation?.userTeachingEvaluation?.analysisAvailable !== false;
  const teachingEvaluation = evaluation?.userTeachingEvaluation || {};
  const correctionsMade = Number.isFinite(teachingEvaluation.correctionsMade) ? teachingEvaluation.correctionsMade : null;
  const accurateCorrections = Number.isFinite(teachingEvaluation.accurateCorrections) ? teachingEvaluation.accurateCorrections : null;
  const falsePositives = Number.isFinite(teachingEvaluation.falsePositives) ? teachingEvaluation.falsePositives : null;
  const finalAccuracy = Number.isFinite(evaluation?.watsonFinalDocument?.overallAccuracy)
    ? `${Math.round(evaluation.watsonFinalDocument.overallAccuracy * 100)}%`
    : 'Not assessed';
  const paragraphLabel = (paragraphId) => {
    const match = /^p(\d+)$/.exec(paragraphId || '');
    return match ? `Paragraph ${match[1]}: ` : '';
  };

  el.moriartyDossierContent.innerHTML = `
    <div style="background: rgba(214, 158, 46, 0.08); border: 1px solid var(--border-gold); border-radius: var(--radius-md); padding: 18px;">
      <span style="font-size: 11px; font-weight: 800; color: var(--accent-gold); letter-spacing: 1px;">
        MORIARTY REVIEW
      </span>
      <p style="color: #f0ede6; font-size: 13px; line-height: 1.6; margin-top: 8px; margin-bottom: 0;">
        ${evaluation?.overallVerdict || debrief.verdict}
      </p>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 14px; border-radius: var(--radius-md);">
        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">WATSON'S FINAL ACCURACY</span>
        <div style="font-size: 24px; font-weight: 900; color: var(--accent-emerald); font-family: var(--font-mono); margin-top: 4px;">${finalAccuracy}</div>
        <p style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Compared with the uploaded study material.</p>
      </div>
      <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 14px; border-radius: var(--radius-md);">
        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">CORRECTIONS</span>
        <div style="font-size: 24px; font-weight: 900; color: var(--accent-cyan); font-family: var(--font-mono); margin-top: 4px;">${accurateCorrections ?? '—'} / ${correctionsMade ?? '—'}</div>
        <p style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Source-verified corrections made by the user.</p>
      </div>
    </div>

    <div style="background: rgba(229, 62, 62, 0.08); border: 1px solid var(--border-crimson); border-radius: var(--radius-md); padding: 16px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <strong style="font-size: 12px; color: var(--text-crimson);">
          IMPORTANT ERRORS
        </strong>
      </div>
      <ul style="margin: 0; padding-left: 18px; color: #ffd8d8; font-size: 12px; line-height: 1.7;">
        ${userErrors.length ? userErrors.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('') : `<li>No clear errors were flagged in this review.</li>`}
      </ul>
    </div>

    <div style="background: rgba(229, 62, 62, 0.05); border: 1px solid var(--border-crimson); border-radius: var(--radius-md); padding: 16px;">
      <strong style="font-size: 12px; color: var(--text-crimson);">ERRORS YOU MISSED</strong>
      <ul style="margin: 8px 0 0; padding-left: 18px; color: #ffd8d8; font-size: 12px; line-height: 1.7;">
        ${missedErrorsAvailable
          ? (missedErrors.length
            ? missedErrors.map((issue) => `<li><strong>${escapeHtml(paragraphLabel(issue.paragraphId))}${escapeHtml(issue.claim || 'Uncorrected issue')}</strong> ${escapeHtml(issue.correctUnderstanding || issue.explanation || '')}${issue.whyItMatters ? ` ${escapeHtml(issue.whyItMatters)}` : ''}</li>`).join('')
            : '<li>No uncorrected errors were identified against the uploaded material.</li>')
          : '<li>Detailed missed-error analysis is unavailable. Check the AI connection and reopen this report.</li>'}
      </ul>
    </div>

    <div style="background: rgba(56, 189, 248, 0.06); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: var(--radius-md); padding: 14px; margin-top: 12px;">
      <div style="font-size: 11px; font-weight: 800; color: var(--accent-cyan); letter-spacing: 0.5px; margin-bottom: 8px;">
        WHAT THESE RESULTS MEAN
      </div>
      <ul style="margin: 0; padding-left: 18px; color: var(--text-secondary); font-size: 12px; line-height: 1.7;">
        <li>Errors caught: ${accurateCorrections ?? 'Not assessed'} of ${correctionsMade ?? 'Not assessed'} user corrections were judged accurate.</li>
        <li>Errors missed: ${missedErrorsAvailable ? missedErrors.length : 'Not assessed'} issues in Watson's original draft were not corrected.</li>
        <li>False alarms: ${falsePositives ?? 'Not assessed'} corrections were judged inconsistent with the source.</li>
        <li>Final accuracy: ${finalAccuracy} of Watson's revised document matched the uploaded material.</li>
      </ul>
    </div>

    <div style="margin-top: 12px; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
      <label for="moriartyQuestionInput" style="display: block; font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">Clarify this report</label>
      <div style="display: flex; gap: 8px;">
        <input id="moriartyQuestionInput" type="text" placeholder="Ask about an error or evaluation..." style="flex: 1; min-width: 0; background: var(--bg-surface-elevated); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 9px 10px;">
        <button class="btn btn-primary" id="askMoriartyTutorBtn" type="button">Ask</button>
      </div>
      <p id="moriartyTutorResponse" aria-live="polite" style="margin: 10px 0 0; font-size: 12px; color: var(--text-secondary); line-height: 1.6;"></p>
    </div>

    <div style="margin-top: 12px;">
      <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">
        EVENT STREAM
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

  const tutorInput = document.getElementById('moriartyQuestionInput');
  const tutorButton = document.getElementById('askMoriartyTutorBtn');
  const tutorResponse = document.getElementById('moriartyTutorResponse');
  tutorButton.onclick = async () => {
    const question = tutorInput.value.trim();
    if (!question) return;

    tutorButton.disabled = true;
    tutorResponse.textContent = 'Checking the report and source material...';
    const answer = await askMoriartyTutor({
      question,
      watsonDocument: state.watsonDocument || { paragraphs: [] },
      sourceMaterial: state.watsonDocument?.sourceMaterial || state.currentCase?.sourceMaterial || '',
      evaluation: evaluation || { overallVerdict: debrief.verdict, userTeachingEvaluation: {} }
    });
    tutorResponse.textContent = answer;
    recordSessionEvent('MORIARTY_REPORT_QUESTION', { message: question });
    tutorButton.disabled = false;
  };

  el.moriartySlideoverBackdrop.classList.add('open');
}

function closeMoriartyDossier() {
  el.moriartySlideoverBackdrop.classList.remove('open');
}

function recordSessionEvent(type, detail = {}) {
  state.eventLog.push({
    type,
    time: new Date().toISOString(),
    detail
  });
  logTelemetry(type, detail.message || JSON.stringify(detail));
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
  showToast(`Generating Watson's document from notes using ${gemini.model}...`, 'info');

  try {
    const watsonDoc = await generateWatsonDocument({ title, content, inlineData });
    watsonDoc.sourceMaterial = content || state.attachedFile?.textContent || '';
    watsonDoc.sourceInlineData = inlineData || null;
    state.watsonDocument = watsonDoc;
    state.currentParagraphIndex = 0;
    renderWatsonDocument(watsonDoc);
    closeIngestionModal();
    showToast(`Watson's document generated: "${watsonDoc.title}"!`, 'success');
    logTelemetry('WATSON_DOCUMENT_GENERATED', `Generated ${watsonDoc.paragraphs.length} paragraphs from uploaded notes.`);
  } catch (err) {
    console.error('Watson document generation error:', err);
    showToast(`Failed to generate Watson document: ${err.message}`, 'error');
  }

  el.processIngestionBtn.disabled = false;
  el.ingestSpinner.style.display = 'none';
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

async function autoGitPush(message) {
  try {
    // Note: Auto git push from browser requires backend service
    // This is a placeholder for the functionality
    // Implementation options:
    // 1. Backend API endpoint that runs git commands
    // 2. GitHub Actions triggered via API
    // 3. Client-side git library (isomorphic-git)
    console.log(`[Git Auto-push] Would commit: ${message}`);
    showToast('Changes saved (auto-push pending backend)', 'info');
  } catch (err) {
    console.warn('Auto git push failed:', err.message);
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', init);
