export const sampleNoteText =
  'The patient should repeat a CBC within seven days.';

export const validPythonResponse = {
  actions: [
    {
      title: 'Repeat CBC blood test',
      type: 'test' as const,
      deadline_text: 'within seven days',
      normalized_deadline: null,
      priority: 'high' as const,
      evidence: sampleNoteText,
      needs_review: false,
      uncertainty_reason: null,
    },
  ],
};

export const emptyPythonResponse = {
  actions: [] as [],
};

export const invalidPythonResponse = {
  actions: [
    {
      title: 'Missing fields',
    },
  ],
};
