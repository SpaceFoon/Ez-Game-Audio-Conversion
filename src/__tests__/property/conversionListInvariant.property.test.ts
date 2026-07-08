import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { join } from 'path';
import { mockDefaultCreateConversionListAnswers } from '../test-utils/createConversionListAnswers.js';
import { createConversionListFsMock } from '../test-utils/mockCreateConversionListFs.js';

/**
 * Property test for the conversion-list invariant that B1/KB-004 violated:
 *
 *   1. Every output path produced is UNIQUE (no two jobs write to the same file).
 *   2. No input is silently lost — every distinct output target that the inputs
 *      map to is represented by exactly one surviving job, and every dropped
 *      input is announced with a duplicate warning.
 *
 * This drives the REAL createConversionList so the generated adversarial sets
 * (same basename across folders, same basename with different source
 * extensions, exact duplicate paths, outside-root paths) exercise the actual
 * de-duplication logic — the exact bug class the manual tests missed.
 */

jest.unstable_mockModule('fs', () => createConversionListFsMock());

jest.unstable_mockModule('chalk', () => {
  const makeFn = () => {
    const fn = jest.fn((...args: string[]) => args.join(' ')) as jest.Mock & {
      italic: jest.Mock;
      bold: jest.Mock;
    };
    fn.italic = jest.fn((a) => a);
    fn.bold = jest.fn((a) => a);
    return fn;
  };
  const base = {
    blue: { bold: jest.fn((...a: string[]) => a.join(' ')) },
    blueBright: jest.fn((...a: string[]) => a.join(' ')),
    green: makeFn(),
    cyanBright: jest.fn((...a: string[]) => a.join(' ')),
    cyan: jest.fn((...a: string[]) => a.join(' ')),
    redBright: Object.assign(
      jest.fn((a: string) => a),
      {
        bold: jest.fn((...a: string[]) => a.join(' ')),
      }
    ),
    red: Object.assign(
      jest.fn((a: string) => a),
      {
        bold: jest.fn((a: string) => a),
      }
    ),
    yellow: jest.fn((a: string) => a),
    gray: jest.fn((a: string) => a),
  };
  return { default: base, ...base };
});

jest.unstable_mockModule('../../utils.js', () => ({
  getAnswer: jest.fn(),
  settings: {},
  handleExit: jest.fn(),
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  reportSearchErrors: jest.fn(async () => {}),
}));

const fs = await import('fs');
const { getAnswer, settings } = await import('../../utils.js');
const { default: createConversionList, buildOutputPath } =
  await import('../../createConversionList.js');

const existsSyncMock = fs.existsSync as unknown as jest.MockedFunction<
  typeof fs.existsSync
>;
const getAnswerMock = getAnswer as unknown as jest.MockedFunction<
  typeof getAnswer
>;

const INPUT_ROOT = '/input-root';
const OUTPUT_ROOT = '/output-root';

// Small pools so collisions are common, not rare.
const folder = fc.constantFrom('', 'sub', 'a/b', 'outside', '..');
const baseName = fc.constantFrom('song', 'track', 'theme');
const sourceExt = fc.constantFrom('wav', 'flac', 'mp3', 'ogg', 'aiff');

const fileArb = fc
  .record({ folder, baseName, sourceExt })
  .map(({ folder: f, baseName: b, sourceExt: e }) =>
    f.startsWith('..')
      ? join('/elsewhere', `${b}.${e}`) // genuinely outside the input root
      : join(INPUT_ROOT, f, `${b}.${e}`)
  );

describe('property: conversion-list integrity (B1/KB-004 guard)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settings.inputFilePath = INPUT_ROOT;
    settings.outputFilePath = OUTPUT_ROOT;
    settings.outputFormats = ['mp3'];
    settings.oggCodec = 'vorbis';
    settings.singleFileMode = false;
    // No pre-existing files → no overwrite/rename prompts; final confirm = yes.
    existsSyncMock.mockReturnValue(false);
    mockDefaultCreateConversionListAnswers(getAnswerMock);
    // Silence the chatty batch logging during fuzzing.
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('produces unique outputs and never silently drops an input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fileArb, { minLength: 1, maxLength: 8 }),
        async (files) => {
          // Capture warnings per-run so we can prove drops are announced, not
          // silent — the actual defect in B1 (the deduped RESULT was already
          // correct; the bug was that losers vanished without a word).
          const dupWarnings: string[] = [];
          const warnSpy = jest
            .spyOn(console, 'warn')
            .mockImplementation((...args: unknown[]) => {
              const text = args.map(String).join(' ');
              if (/duplicate output|Skipping duplicate/i.test(text)) {
                dupWarnings.push(text);
              }
            });

          try {
            const result = await createConversionList(files);
            const outputs = result.map((r) => r.outputFile);

            // Invariant 1: every output path is unique.
            expect(new Set(outputs).size).toBe(outputs.length);

            // Full set of output targets the inputs map to.
            const expectedOutputs = new Set(
              files.map((f) =>
                buildOutputPath(f, INPUT_ROOT, OUTPUT_ROOT, 'mp3')
              )
            );

            // Invariant 2: surviving outputs are exactly the distinct targets —
            // no collision slips through, no whole target vanishes.
            expect(new Set(outputs)).toEqual(expectedOutputs);

            // Invariant 3: exact accounting; every survivor is a real input.
            expect(result.length).toBe(expectedOutputs.size);
            for (const item of result) {
              expect(files).toContain(item.inputFile);
            }

            // Invariant 4 (the B1 guard with teeth): the number of dropped
            // inputs equals the number of duplicate warnings emitted. A silent
            // drop — the original bug — would make these diverge.
            const droppedCount = files.length - expectedOutputs.size;
            expect(dupWarnings.length).toBe(droppedCount);
          } finally {
            warnSpy.mockRestore();
          }
        }
      ),
      { numRuns: 60 }
    );
  });
});
