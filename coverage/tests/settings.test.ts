import { Settings } from "src/settings";

describe("Settings", () => {
  test("parses values", () => {
    const settings = Settings.createNull({
      "coverage-token": "qltcp_1234567890",
      files: "  whitespace  ",
      "add-prefix": "test-prefix",
      "strip-prefix": "test-strip-prefix",
      "skip-errors": true,
      "skip-missing-files": true,
      tag: "test-tag",
      "total-parts-count": "10",
      oidc: true,
      verbose: true,
      "cli-version": "1.2.3",
      format: "simplecov",
      "dry-run": true,
      incomplete: true,
      name: "test-name",
      validate: true,
    });

    expect(settings.input).toMatchObject({
      coverageToken: "qltcp_1234567890",
      files: "whitespace",
      addPrefix: "test-prefix",
      stripPrefix: "test-strip-prefix",
      skipErrors: true,
      skipMissingFiles: true,
      tag: "test-tag",
      totalPartsCount: 10,
      oidc: true,
      verbose: true,
      cliVersion: "1.2.3",
      format: "simplecov",
      dryRun: true,
      incomplete: true,
      name: "test-name",
      validate: true,
    });
  });

  test("parses missing values", () => {
    const settings = Settings.createNull({
      "coverage-token": "",
      files: " whitespace  ",
      "add-prefix": "",
      "strip-prefix": "",
      tag: "",
      "total-parts-count": "",
      incomplete: false,
      name: "",
    });

    expect(settings.input).toMatchObject({
      coverageToken: undefined,
      files: "whitespace",
      tag: undefined,
      addPrefix: undefined,
      stripPrefix: undefined,
      totalPartsCount: undefined,
      format: undefined,
      dryRun: false,
      incomplete: false,
      name: undefined,
      validate: false,
    });
  });

  describe("format", () => {
    test("allows missing", () => {
      const settings = Settings.createNull({
        oidc: true,
        format: "",
      });
      expect(settings.input.format).toBeUndefined();
    });

    test("allows known values", () => {
      const settings = Settings.createNull({
        oidc: true,
        format: "simplecov",
      });
      expect(settings.input.format).toEqual("simplecov");
    });

    test("rejects unknown values", () => {
      expect(() => {
        Settings.createNull({
          oidc: true,
          format: "unknown",
        });
      }).toThrow();
    });
  });

  describe("validation", () => {
    test("allows valid cases", () => {
      expect(
        Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          oidc: false,
        }).validate(),
      ).toEqual([]);

      expect(
        Settings.createNull({
          token: "qltcp_1234567890",
          oidc: false,
        }).validate(),
      ).toEqual([]);

      expect(
        Settings.createNull({
          "coverage-token": "",
          token: "",
          oidc: true,
        }).validate(),
      ).toEqual([]);
    });

    test("fails when OIDC and token are both missing", () => {
      const settings = Settings.createNull({
        token: "",
        oidc: false,
      });

      expect(settings.validate()).toEqual([
        "Either 'oidc' or 'token' must be provided.",
      ]);
    });

    test("fails when OIDC and token are both present", () => {
      const settings = Settings.createNull({
        token: "qltcp_1234567890",
        oidc: true,
      });

      expect(settings.validate()).toEqual([
        "Both 'oidc' and 'token' cannot be provided at the same time.",
      ]);
    });

    test("validates token", () => {
      expect(
        Settings.createNull({
          token: "wrong",
        }).validate(),
      ).toEqual([
        "The provided token is invalid. It should begin with 'qltcp_' or 'qltcw_' followed by alphanumerics.",
      ]);

      expect(
        Settings.createNull({
          "coverage-token": "wrong",
        }).validate(),
      ).toEqual([
        "The provided token is invalid. It should begin with 'qltcp_' or 'qltcw_' followed by alphanumerics.",
      ]);

      expect(
        Settings.createNull({
          "coverage-token": "qltcp_1234567890",
        }).validate(),
      ).toEqual([]);
    });

    test("allows missing token and OIDC when dry-run is true", () => {
      const settings = Settings.createNull({
        token: "",
        oidc: false,
        "dry-run": true,
      });

      expect(settings.validate()).toEqual([]);
    });

    test("allows invalid token format when dry-run is true", () => {
      const settings = Settings.createNull({
        token: "invalid-token",
        oidc: false,
        "dry-run": true,
      });

      expect(settings.validate()).toEqual([]);
    });

    test("allows both token and OIDC when dry-run is true", () => {
      const settings = Settings.createNull({
        token: "qltcp_1234567890",
        oidc: true,
        "dry-run": true,
      });

      expect(settings.validate()).toEqual([]);
    });
  });

  describe("getFiles", () => {
    test("accepts comma separated patterns", async () => {
      const settings = Settings.createNull({
        files: "foo, bar",
      });
      expect(await settings.getFiles()).toEqual(["bar", "foo"]);
    });

    test("accepts newline separated patterns", async () => {
      const settings = Settings.createNull({
        files: "foo\nbar",
      });
      expect(await settings.getFiles()).toEqual(["bar", "foo"]);
    });
  });

  describe("getToken", () => {
    test("returns the token", async () => {
      const settings = Settings.createNull({
        token: "qltcp_1234567890",
        oidc: false,
      });
      expect(await settings.getToken()).toEqual("qltcp_1234567890");
    });

    test("returns the coverage token", async () => {
      const settings = Settings.createNull({
        "coverage-token": "test-coverage-token",
        oidc: false,
      });

      expect(await settings.getToken()).toEqual("test-coverage-token");
    });

    test("prefers token over coverage-token", async () => {
      const settings = Settings.createNull({
        token: "qltcp_1234567890",
        "coverage-token": "test-coverage-token",
        oidc: false,
      });
      expect(await settings.getToken()).toEqual("qltcp_1234567890");
    });

    test("generates an ID token", async () => {
      const settings = Settings.createNull({
        "coverage-token": "",
        oidc: true,
      });

      expect(await settings.getToken()).toEqual(
        "oidc-token:audience=https://qlty.sh",
      );
    });

    test("raises when token is missing", async () => {
      const settings = Settings.createNull({
        "coverage-token": "",
        token: "",
        oidc: false,
      });

      await expect(settings.getToken()).rejects.toThrow(
        "'token' is required when 'oidc' is false.",
      );
    });

    test("returns null when in dry-run mode with no token", async () => {
      const settings = Settings.createNull({
        "coverage-token": "",
        token: "",
        oidc: false,
        "dry-run": true,
      });

      expect(await settings.getToken()).toBeNull();
    });

    test("returns the token when in dry-run mode with a token", async () => {
      const settings = Settings.createNull({
        token: "qltcp_1234567890",
        oidc: false,
        "dry-run": true,
      });

      expect(await settings.getToken()).toEqual("qltcp_1234567890");
    });

    test("returns an ID token when in dry-run mode with oidc enabled", async () => {
      const settings = Settings.createNull({
        "coverage-token": "",
        token: "",
        oidc: true,
        "dry-run": true,
      });

      expect(await settings.getToken()).toEqual(
        "oidc-token:audience=https://qlty.sh",
      );
    });
  });

  describe("getVersion", () => {
    test("returns undefined for empty version", () => {
      const settings = Settings.createNull({
        "cli-version": "",
      });
      expect(settings.getVersion()).toBeUndefined();
    });

    test("returns version without v prefix", () => {
      const settings = Settings.createNull({
        "cli-version": "1.2.3",
      });
      expect(settings.getVersion()).toEqual("1.2.3");
    });

    test("strips v prefix from version", () => {
      const settings = Settings.createNull({
        "cli-version": "v1.2.3",
      });
      expect(settings.getVersion()).toEqual("1.2.3");
    });
  });
});
