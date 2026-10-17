import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAnnotationPayload, computeDiagnosticMetrics } from '../src/services/sessionMetrics.js';

test('buildAnnotationPayload serializes sentence-level audit events', () => {
  const payload = buildAnnotationPayload({
    caseId: 'physics_orbit_01',
    annotations: [
      { sentence_id: 's2', tag: 'CONCEPTUAL_FALLACY', holmes_note: 'Gravity is still about 90% at orbit.', severity: 'CRITICAL' }
    ],
    overallAssessment: 'Watson conflated weightlessness with zero gravity.'
  });

  assert.deepEqual(payload.case_id, 'physics_orbit_01');
  assert.equal(payload.annotations.length, 1);
  assert.equal(payload.overall_assessment, 'Watson conflated weightlessness with zero gravity.');
});

test('computeDiagnosticMetrics calculates recall and false alarms', () => {
  const metrics = computeDiagnosticMetrics({
    sentences: [
      { id: 's1', label: 'VALID' },
      { id: 's2', label: 'FLAWED' },
      { id: 's3', label: 'VALID' },
      { id: 's4', label: 'FLAWED' },
      { id: 's5', label: 'FLAWED' }
    ],
    annotations: [
      { sentence_id: 's2', tag: 'CONCEPTUAL_FALLACY' },
      { sentence_id: 's1', tag: 'BOUNDARY_CONDITION' }
    ]
  });

  assert.equal(metrics.flawed_total, 3);
  assert.equal(metrics.flawed_caught, 1);
  assert.equal(metrics.false_alarms, 1);
  assert.equal(metrics.missed.length, 2);
  assert.equal(metrics.recall, 0.3333333333333333);
});
