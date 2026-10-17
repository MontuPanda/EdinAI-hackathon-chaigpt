export function buildAnnotationPayload({ caseId, annotations, overallAssessment }) {
  return {
    case_id: caseId,
    annotations: (annotations || []).map((annotation) => ({
      sentence_id: annotation.sentence_id || annotation.id || 'unknown_sentence',
      tag: annotation.tag || 'CONCEPTUAL_FALLACY',
      holmes_note: annotation.note || annotation.holmes_note || 'No margin note provided.',
      severity: annotation.severity || 'CRITICAL'
    })),
    overall_assessment: overallAssessment || ''
  };
}

export function computeDiagnosticMetrics({ sentences = [], annotations = [] }) {
  const flawedSentences = sentences.filter((sentence) => sentence.label === 'FLAWED');
  const flawedIds = new Set(flawedSentences.map((sentence) => sentence.id));
  const flaggedIds = new Set(
    annotations
      .map((annotation) => annotation.sentence_id || annotation.id)
      .filter(Boolean)
  );

  const flawedCaught = flawedSentences.filter((sentence) => flaggedIds.has(sentence.id)).length;
  const falseAlarms = annotations.filter((annotation) => {
    const sentenceId = annotation.sentence_id || annotation.id;
    return sentenceId && !flawedIds.has(sentenceId);
  }).length;

  const missed = flawedSentences
    .filter((sentence) => !flaggedIds.has(sentence.id))
    .map((sentence) => ({ sentence_id: sentence.id, misconception_id: sentence.misconception_id || null }));

  const recall = flawedSentences.length > 0 ? flawedCaught / flawedSentences.length : 0;

  return {
    flawed_total: flawedSentences.length,
    flawed_caught: flawedCaught,
    false_alarms: falseAlarms,
    missed,
    recall,
    false_alarm_rate: flawedSentences.length > 0 ? falseAlarms / flawedSentences.length : 0
  };
}
