const { existsSync } = require("fs");
const { execSync } = require("child_process");
// Mock path.join to return predictable paths
jest.mock("path", () => ({
  join: jest.fn((...args) => args.join("/")),
  extname: jest.fn((file) => {
    const parts = file.split(".");
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
  }),
}));

// Mock the modules needed by metadataService
jest.mock("fs", () => ({
  existsSync: jest.fn(),
}));

jest.mock("child_process", () => ({
  spawnSync: jest.fn(),
  execSync: jest.fn(),
}));

// Import the functions to test
const {
  getMetaData,
  formatMetaDataField,
  formatMetaData,
  getLoopPoints,
  convertLoopPoints,
  formatLoopData,
} = require("../../src/metaDataService");

describe("metadataService", () => {
  // Save original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress all console output
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
  });

  describe("getMetaData", () => {
    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();

      // Mock fs.existsSync to return true for file existence check
      existsSync.mockReturnValue(true);
    });

    it("should extract metadata from a file using ffprobe", async () => {
      // Mock successful ffprobe execution
      const mockMetadata = {
        streams: [{ codec_type: "audio", channels: 2 }],
        format: { tags: { title: "Test Song" } },
      };

      const { spawnSync } = require("child_process");
      spawnSync.mockReturnValue({
        stdout: JSON.stringify(mockMetadata),
        error: null,
      });

      const result = await getMetaData("test.mp3");

      expect(result).toEqual(mockMetadata);
      expect(spawnSync).toHaveBeenCalledWith(
        expect.stringContaining("ffprobe"),
        expect.any(Array),
        expect.objectContaining({ encoding: "utf8" })
      );
    });

    it("should handle errors gracefully", async () => {
      // Mock spawnSync to throw an error
      const { spawnSync } = require("child_process");
      spawnSync.mockReturnValue({
        error: new Error("Command failed"),
        stdout: null,
      });

      const result = await getMetaData("test.mp3");

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error running ffprobe.exe"),
        expect.any(String)
      );
    });

    it("should handle file not found errors", async () => {
      // Mock file doesn't exist
      existsSync.mockReturnValue(false);

      // Mock spawnSync to still return something
      const { spawnSync } = require("child_process");
      spawnSync.mockReturnValue({
        stdout: JSON.stringify({}),
        error: null,
      });

      const result = await getMetaData("nonexistent.mp3");

      // Function should still work, but with different ffprobe path
      expect(spawnSync).toHaveBeenCalledWith(
        expect.stringContaining("bin/ffprobe"),
        expect.any(Array),
        expect.objectContaining({ encoding: "utf8" })
      );
    });

    it("should handle malformed JSON response", async () => {
      // Mock invalid JSON response
      const { spawnSync } = require("child_process");
      spawnSync.mockReturnValue({
        stdout: "Not valid JSON",
        error: null,
      });

      const result = await getMetaData("test.mp3");

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error running ffprobe.exe"),
        expect.any(String)
      );
    });
  });

  describe("formatMetaDataField", () => {
    it("should get metadata field from streamTags", () => {
      const streamTags = { title: "Test Title" };
      const formatTags = {};

      const result = formatMetaDataField(streamTags, formatTags, "title");

      expect(result).toBe("Test Title");
    });

    it("should get metadata field from formatTags if not in streamTags", () => {
      const streamTags = { title: "Test Title" };
      const formatTags = { artist: "Test Artist" };

      const result = formatMetaDataField(streamTags, formatTags, "artist");

      expect(result).toBe("Test Artist");
    });

    it("should handle case insensitive searches", () => {
      const streamTags = { TITLE: "Test Title" };
      const formatTags = { ARTIST: "Test Artist" };

      expect(formatMetaDataField(streamTags, formatTags, "title")).toBe(
        "Test Title"
      );
      expect(formatMetaDataField(streamTags, formatTags, "artist")).toBe(
        "Test Artist"
      );
    });

    it("should return empty string if field not found", () => {
      const streamTags = { title: "Test Title" };
      const formatTags = { artist: "Test Artist" };

      const result = formatMetaDataField(streamTags, formatTags, "album");

      expect(result).toBe("");
    });

    it("should handle null/undefined tags", () => {
      expect(formatMetaDataField(null, null, "title")).toBe("");
      expect(formatMetaDataField(undefined, undefined, "title")).toBe("");
    });
  });

  describe("formatMetaData", () => {
    it("should format metadata correctly", () => {
      const metadata = {
        streams: [
          {
            tags: {
              title: "Test Title",
              artist: "Test Artist",
            },
            channels: 2,
          },
        ],
        format: {
          tags: {
            album: "Test Album",
          },
        },
      };

      const { metaData, channels } = formatMetaData(metadata);

      expect(metaData).toContain('-metadata title="Test Title"');
      expect(metaData).toContain('-metadata artist="Test Artist"');
      expect(metaData).toContain('-metadata album="Test Album"');
      expect(channels).toBe(" -ac 2");
    });

    it("should handle special characters in metadata", () => {
      const metadata = {
        streams: [
          {
            tags: {
              title: 'Test "Title" with \\ backslash',
              artist: "Artist\nWith\nNewlines",
            },
            channels: 2,
          },
        ],
      };

      const { metaData } = formatMetaData(metadata);

      // Expect properly escaped double quotes and backslashes
      expect(metaData).toContain(
        '-metadata title="Test \\"Title\\" with \\\\ backslash"'
      );
      // Expect newlines to be escaped as \n
      expect(metaData).toContain('-metadata artist="Artist\\nWith\\nNewlines"');
    });

    it("should handle null/empty metadata", () => {
      const result = formatMetaData(null);
      expect(result.metaData).toBe("");
      expect(result.channels).toBe(" -ac 2");
    });

    it("should normalize track to trackNumber", () => {
      const metadata = {
        streams: [
          {
            tags: {
              track: "5",
            },
          },
        ],
      };

      const { metaData } = formatMetaData(metadata);

      expect(metaData).toContain('-metadata trackNumber="5"');
      expect(metaData).not.toContain('-metadata track="5"');
    });
  });

  describe("getLoopPoints", () => {
    it("should extract loop points from metadata format tags", () => {
      const metadata = {
        format: {
          tags: {
            LOOPSTART: "1000",
            LOOPLENGTH: "5000",
          },
        },
      };

      const { loopStart, loopLength } = getLoopPoints(metadata);
      expect(loopStart).toBe(1000);
      expect(loopLength).toBe(5000);
    });

    it("should extract loop points from metadata stream tags", () => {
      const metadata = {
        streams: [
          {
            tags: {
              LOOPSTART: "1000",
              LOOPLENGTH: "5000",
            },
          },
        ],
      };

      const { loopStart, loopLength } = getLoopPoints(metadata);
      expect(loopStart).toBe(1000);
      expect(loopLength).toBe(5000);
    });

    it("should handle alternative tag formats", () => {
      const metadata = {
        format: {
          tags: {
            LOOP_START: "1000",
            LOOP_LENGTH: "5000",
          },
        },
      };

      const { loopStart, loopLength } = getLoopPoints(metadata);
      expect(loopStart).toBe(1000);
      expect(loopLength).toBe(5000);
    });

    it("should handle iTunes metadata tags", () => {
      const metadata = {
        format: {
          tags: {
            iTunes_LOOPSTART: "1000",
            iTunes_LOOPLENGTH: "5000",
          },
        },
      };

      const { loopStart, loopLength } = getLoopPoints(metadata);
      expect(loopStart).toBe(1000);
      expect(loopLength).toBe(5000);
    });

    it("should return null if loop points not found", () => {
      const metadata = {
        format: {
          tags: {
            ARTIST: "Test",
          },
        },
      };

      const { loopStart, loopLength } = getLoopPoints(metadata);
      expect(loopStart).toBeNaN();
      expect(loopLength).toBeNaN();
    });
  });

  describe("convertLoopPoints", () => {
    it("should adjust loop points for opus format", () => {
      const metadata = {
        streams: [
          {
            sample_rate: "44100",
            tags: {
              LOOPSTART: "1000",
              LOOPLENGTH: "5000",
            },
          },
        ],
      };

      const result = convertLoopPoints(metadata, "ogg", "opus");

      // For 44.1kHz -> 48kHz conversion
      expect(result.newSampleRate).toBe(48000);
      expect(result.loopStart).toBeGreaterThan(1000); // Should be scaled up
      expect(result.loopLength).toBeGreaterThan(5000); // Should be scaled up
    });

    it("should not adjust loop points for non-opus formats", () => {
      const metadata = {
        streams: [
          {
            sample_rate: "44100",
            tags: {
              LOOPSTART: "1000",
              LOOPLENGTH: "5000",
            },
          },
        ],
      };

      const result = convertLoopPoints(metadata, "mp3", null);

      expect(result.newSampleRate).toBeNull();
      expect(result.loopStart).toBe(1000);
      expect(result.loopLength).toBe(5000);
    });

    it("should handle different sample rates correctly", () => {
      // Test different sample rate bands - following the exact ranges in metadataService.js
      const testCases = [
        // if (sampleRateNumber < 8000)
        { rate: "7000", expected: 8000 },

        // else if (sampleRateNumber >= 8000)
        { rate: "8000", expected: 12000 },
        { rate: "10000", expected: 12000 },

        // else if (sampleRateNumber > 12000)
        { rate: "12500", expected: 16000 },
        { rate: "16000", expected: 16000 },

        // else if (sampleRateNumber > 16000)
        { rate: "20000", expected: 24000 },

        // else if (sampleRateNumber >= 22050)
        { rate: "22050", expected: 24000 },
        { rate: "24000", expected: 24000 },

        // if (sampleRateNumber >= 32000)
        { rate: "32000", expected: 48000 },
        { rate: "44100", expected: 48000 },
        { rate: "48000", expected: 48000 },
        { rate: "96000", expected: 48000 },
      ];

      testCases.forEach(({ rate, expected }) => {
        const metadata = {
          streams: [
            {
              sample_rate: rate,
              tags: {
                LOOPSTART: "1000",
                LOOPLENGTH: "5000",
              },
            },
          ],
        };

        const result = convertLoopPoints(metadata, "ogg", "opus");
        expect(result.newSampleRate).toBe(expected);
      });
    });
  });

  describe("formatLoopData", () => {
    it("should format loop data correctly", () => {
      const result = formatLoopData(1000, 5000);

      // Check that result is a string containing the expected metadata tags
      expect(result).toContain("-metadata LOOPSTART=1000");
      expect(result).toContain("-metadata loopstart=1000");
      expect(result).toContain("-metadata LOOPLENGTH=5000");
      expect(result).toContain("-metadata looplength=5000");

      // Should not contain alternative/underscore formats we no longer use
      expect(result).not.toContain("LOOP_START");
      expect(result).not.toContain("LOOP_LENGTH");

      // Should not contain comment-based approaches
      expect(result).not.toContain("COMMENT=");
      expect(result).not.toContain("DESCRIPTION=");
    });

    it("should format loop data for OGG correctly", () => {
      const result = formatLoopData(1000, 5000, "ogg");

      // Check that result is a string containing the expected metadata tags
      expect(result).toContain("-metadata LOOPSTART=1000");
      expect(result).toContain("-metadata loopstart=1000");
      expect(result).toContain("-metadata LOOPLENGTH=5000");
      expect(result).toContain("-metadata looplength=5000");

      // Should not contain alternative/underscore formats we no longer use
      expect(result).not.toContain("LOOP_START");
      expect(result).not.toContain("LOOP_LENGTH");

      // Should not contain comment-based approaches
      expect(result).not.toContain("COMMENT=");
      expect(result).not.toContain("DESCRIPTION=");
    });

    it("should return empty string for invalid loop points", () => {
      expect(formatLoopData(NaN, 5000)).toBe("");
      expect(formatLoopData(1000, NaN)).toBe("");
      expect(formatLoopData(NaN, NaN)).toBe("");
    });
  });
});
