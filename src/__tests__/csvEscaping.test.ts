/**
 * CSV Escaping and Cross-Platform String Tests
 *
 * These tests ensure that:
 * 1. CSV escaping works correctly for all edge cases
 * 2. String handling is consistent across Windows, Mac, and Linux
 * 3. File paths with special characters are handled properly
 * 4. Unicode and international characters work correctly
 */

import { describe, it, expect } from '@jest/globals';

// Import the function directly - it's pure string manipulation, no mocking needed
import { escapeCsvField } from '../utils.js';

describe('escapeCsvField', () => {
  describe('basic functionality', () => {
    it('should return simple strings unchanged', () => {
      expect(escapeCsvField('hello')).toBe('hello');
      expect(escapeCsvField('simple text')).toBe('simple text');
      expect(escapeCsvField('12345')).toBe('12345');
    });

    it('should wrap strings with commas in quotes', () => {
      expect(escapeCsvField('hello, world')).toBe('"hello, world"');
      expect(escapeCsvField('a,b,c')).toBe('"a,b,c"');
      expect(escapeCsvField(',leading comma')).toBe('",leading comma"');
      expect(escapeCsvField('trailing comma,')).toBe('"trailing comma,"');
    });

    it('should escape double quotes by doubling them', () => {
      expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
      expect(escapeCsvField('"quoted"')).toBe('"""quoted"""');
      expect(escapeCsvField('a"b"c')).toBe('"a""b""c"');
    });

    it('should handle strings with both commas and quotes', () => {
      expect(escapeCsvField('hello, "world"')).toBe('"hello, ""world"""');
      expect(escapeCsvField('"a", "b", "c"')).toBe('"""a"", ""b"", ""c"""');
    });
  });

  describe('newline handling', () => {
    it('should wrap strings with Unix newlines (LF) in quotes', () => {
      expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
      expect(escapeCsvField('a\nb\nc')).toBe('"a\nb\nc"');
    });

    it('should wrap strings with Windows newlines (CRLF) in quotes', () => {
      expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
      expect(escapeCsvField('a\r\nb\r\nc')).toBe('"a\r\nb\r\nc"');
    });

    it('should wrap strings with carriage returns (CR) in quotes', () => {
      expect(escapeCsvField('line1\rline2')).toBe('"line1\rline2"');
    });

    it('should handle mixed newline styles', () => {
      expect(escapeCsvField('unix\nwindows\r\nmac\r')).toBe(
        '"unix\nwindows\r\nmac\r"'
      );
    });
  });

  describe('cross-platform file paths', () => {
    it('should handle Windows-style paths', () => {
      expect(escapeCsvField('C:\\Users\\Test\\file.mp3')).toBe(
        'C:\\Users\\Test\\file.mp3'
      );
      expect(escapeCsvField('C:\\Program Files\\App\\file.mp3')).toBe(
        'C:\\Program Files\\App\\file.mp3'
      );
    });

    it('should handle Windows paths with commas in folder names', () => {
      expect(escapeCsvField('C:\\Users\\Test, User\\file.mp3')).toBe(
        '"C:\\Users\\Test, User\\file.mp3"'
      );
    });

    it('should handle Unix-style paths', () => {
      expect(escapeCsvField('/home/user/music/file.mp3')).toBe(
        '/home/user/music/file.mp3'
      );
      expect(escapeCsvField('/var/log/app.log')).toBe('/var/log/app.log');
    });

    it('should handle Unix paths with commas', () => {
      expect(escapeCsvField('/home/user/Music, Files/song.mp3')).toBe(
        '"/home/user/Music, Files/song.mp3"'
      );
    });

    it('should handle Mac-style paths', () => {
      expect(escapeCsvField('/Users/test/Music/file.mp3')).toBe(
        '/Users/test/Music/file.mp3'
      );
    });
  });

  describe('unicode and international characters', () => {
    it('should handle Japanese characters', () => {
      expect(escapeCsvField('音楽ファイル.mp3')).toBe('音楽ファイル.mp3');
      expect(escapeCsvField('日本語, テスト')).toBe('"日本語, テスト"');
    });

    it('should handle Chinese characters', () => {
      expect(escapeCsvField('音乐文件.mp3')).toBe('音乐文件.mp3');
      expect(escapeCsvField('中文, 测试')).toBe('"中文, 测试"');
    });

    it('should handle Korean characters', () => {
      expect(escapeCsvField('음악파일.mp3')).toBe('음악파일.mp3');
      expect(escapeCsvField('한국어, 테스트')).toBe('"한국어, 테스트"');
    });

    it('should handle European characters with diacritics', () => {
      expect(escapeCsvField('Ñoño.mp3')).toBe('Ñoño.mp3');
      expect(escapeCsvField('Café, Naïve, Résumé')).toBe(
        '"Café, Naïve, Résumé"'
      );
      expect(escapeCsvField('Müller.mp3')).toBe('Müller.mp3');
      expect(escapeCsvField('Größe')).toBe('Größe');
    });

    it('should handle Cyrillic characters', () => {
      expect(escapeCsvField('Привет.mp3')).toBe('Привет.mp3');
      expect(escapeCsvField('Русский, текст')).toBe('"Русский, текст"');
    });

    it('should handle Arabic characters', () => {
      expect(escapeCsvField('مرحبا.mp3')).toBe('مرحبا.mp3');
    });

    it('should handle emoji', () => {
      expect(escapeCsvField('🎵 music.mp3')).toBe('🎵 music.mp3');
      expect(escapeCsvField('🎵, 🎶, 🎤')).toBe('"🎵, 🎶, 🎤"');
    });
  });

  describe('ffmpeg error messages', () => {
    it('should handle typical ffmpeg error output', () => {
      const ffmpegError =
        'Error opening input: Invalid data found when processing input';
      expect(escapeCsvField(ffmpegError)).toBe(ffmpegError);
    });

    it('should handle ffmpeg errors with file paths containing commas', () => {
      const ffmpegError =
        'Error opening input file C:\\Music, Videos\\song.mp3';
      expect(escapeCsvField(ffmpegError)).toBe(`"${ffmpegError}"`);
    });

    it('should handle ffmpeg errors with technical details', () => {
      const ffmpegError =
        '[mp3 @ 0x0000017eac746bc0]Error opening input: Invalid data found';
      expect(escapeCsvField(ffmpegError)).toBe(ffmpegError);
    });

    it('should handle ffmpeg moov atom errors', () => {
      const ffmpegError = 'moov atom not found[in#0 @ 0x000001c4cd466a00]';
      expect(escapeCsvField(ffmpegError)).toBe(ffmpegError);
    });

    it('should handle complex ffmpeg output with special chars', () => {
      const ffmpegError =
        '[movmp4m4a3gp3g2mj2 @ 0x0000] moov atom not found, "invalid" data';
      expect(escapeCsvField(ffmpegError)).toBe(
        '"[movmp4m4a3gp3g2mj2 @ 0x0000] moov atom not found, ""invalid"" data"'
      );
    });
  });

  describe('formula injection (Excel)', () => {
    it('should prefix leading =, +, -, and @ with a single quote', () => {
      expect(escapeCsvField('=SUM(A1)')).toBe("'=SUM(A1)");
      expect(escapeCsvField('+cmd|calc')).toBe("'+cmd|calc");
      expect(escapeCsvField('-2+3')).toBe("'-2+3");
      expect(escapeCsvField('@evil')).toBe("'@evil");
    });

    it('should neutralize formulas before RFC-4180 quoting', () => {
      expect(escapeCsvField('=1+2, note')).toBe('"\'=1+2, note"');
      expect(escapeCsvField('=hello, world')).toBe('"\'=hello, world"');
    });

    it('should not double-prefix values already escaped', () => {
      expect(escapeCsvField("'=safe")).toBe("'=safe");
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(escapeCsvField('')).toBe('');
    });

    it('should handle string with only spaces', () => {
      expect(escapeCsvField('   ')).toBe('   ');
    });

    it('should handle string with only comma', () => {
      expect(escapeCsvField(',')).toBe('","');
    });

    it('should handle string with only quote', () => {
      expect(escapeCsvField('"')).toBe('""""');
    });

    it('should handle string with only newline', () => {
      expect(escapeCsvField('\n')).toBe('"\n"');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      expect(escapeCsvField(longString)).toBe(longString);

      const longStringWithComma = 'a'.repeat(5000) + ',' + 'b'.repeat(5000);
      expect(escapeCsvField(longStringWithComma)).toBe(
        `"${longStringWithComma}"`
      );
    });

    it('should handle strings with null characters', () => {
      // Null chars shouldn't trigger quoting but should pass through
      expect(escapeCsvField('hello\x00world')).toBe('hello\x00world');
    });

    it('should handle strings with tabs', () => {
      // Tabs don't need quoting in standard CSV
      expect(escapeCsvField('hello\tworld')).toBe('hello\tworld');
    });
  });

  describe('timestamp formats', () => {
    it('should handle timestamp without commas', () => {
      expect(escapeCsvField('25-01-2026 16:33:00')).toBe('25-01-2026 16:33:00');
    });

    it('should handle ISO timestamp', () => {
      expect(escapeCsvField('2026-01-25T16:33:00Z')).toBe(
        '2026-01-25T16:33:00Z'
      );
    });

    it('should handle timestamp with comma (unusual format)', () => {
      expect(escapeCsvField('January 25, 2026')).toBe('"January 25, 2026"');
    });
  });
});

describe('CSV row generation', () => {
  it('should create valid CSV rows with escaped fields', () => {
    const fields = [
      escapeCsvField('25-01-2026 16:33:00'),
      escapeCsvField('Error opening input, invalid data'),
      escapeCsvField('C:\\Users\\Test\\music.mp3'),
      escapeCsvField('C:\\Output\\music.ogg'),
    ];
    const csvRow = fields.join(',');

    expect(csvRow).toBe(
      '25-01-2026 16:33:00,"Error opening input, invalid data",C:\\Users\\Test\\music.mp3,C:\\Output\\music.ogg'
    );
  });

  it('should create valid CSV rows with complex data', () => {
    const fields = [
      escapeCsvField('25-01-2026 16:33:00'),
      escapeCsvField('moov atom not found, "invalid" format'),
      escapeCsvField('/home/user/Music, Songs/日本語.mp3'),
      escapeCsvField('/output/日本語.ogg'),
    ];
    const csvRow = fields.join(',');

    expect(csvRow).toBe(
      '25-01-2026 16:33:00,"moov atom not found, ""invalid"" format","/home/user/Music, Songs/日本語.mp3",/output/日本語.ogg'
    );
  });

  it('should handle all fields needing escaping', () => {
    const fields = [
      escapeCsvField('January 25, 2026'),
      escapeCsvField('Error: "file not found"'),
      escapeCsvField('path, with, commas'),
      escapeCsvField('output\nwith\nnewlines'),
    ];
    const csvRow = fields.join(',');

    expect(csvRow).toBe(
      '"January 25, 2026","Error: ""file not found""","path, with, commas","output\nwith\nnewlines"'
    );
  });
});

describe('cross-platform consistency', () => {
  it('should produce identical output regardless of platform line endings in source', () => {
    // These should all produce quoted output
    const unixNewline = escapeCsvField('line1\nline2');
    const windowsNewline = escapeCsvField('line1\r\nline2');
    const macNewline = escapeCsvField('line1\rline2');

    // All should be quoted
    expect(unixNewline.startsWith('"')).toBe(true);
    expect(windowsNewline.startsWith('"')).toBe(true);
    expect(macNewline.startsWith('"')).toBe(true);

    // Content should be preserved exactly
    expect(unixNewline).toBe('"line1\nline2"');
    expect(windowsNewline).toBe('"line1\r\nline2"');
    expect(macNewline).toBe('"line1\rline2"');
  });

  it('should handle path separators from any platform', () => {
    const windowsPath = escapeCsvField('C:\\Users\\Test\\file.mp3');
    const unixPath = escapeCsvField('/home/user/file.mp3');

    // Neither should be quoted (no special CSV chars)
    expect(windowsPath).toBe('C:\\Users\\Test\\file.mp3');
    expect(unixPath).toBe('/home/user/file.mp3');
  });
});
