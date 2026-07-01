/** Default getAnswer mock for createConversionList tests (handles OGG codec prompt). */
export function defaultCreateConversionListAnswer(prompt: unknown): string {
  const text = String(prompt ?? '');
  if (/Which codec would you like to use for Ogg files/i.test(text)) {
    return 'vorbis';
  }
  return 'yes';
}

export function mockDefaultCreateConversionListAnswers(getAnswerMock: {
  mockImplementation: (fn: (prompt?: unknown) => Promise<string>) => unknown;
}): void {
  getAnswerMock.mockImplementation(async (prompt) =>
    defaultCreateConversionListAnswer(prompt)
  );
}
