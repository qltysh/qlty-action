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
    });

    expect(settings.input).toMatchObject({
      coverageToken: undefined,
      files: "whitespace",
      tag: undefined,
      addPrefix: undefined,
      stripPrefix: undefined,
      totalPartsCount: undefined,
    });
  });

  describe("validation", () => {
    test("allows valid cases", () => {
      expect(
        Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          oidc: false,
        }).validate()
      ).toEqual([]);

      expect(
        Settings.createNull({
          token: "qltcp_1234567890",
          oidc: false,
        }).validate()
      ).toEqual([]);

      expect(
        Settings.createNull({
          "coverage-token": "",
          token: "",
          oidc: true,
        }).validate()
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
        }).validate()
      ).toEqual([
        "The provided token is invalid. It should begin with 'qltcp_' or 'qltcw_' followed by alphanumerics.",
      ]);

      expect(
        Settings.createNull({
          "coverage-token": "wrong",
        }).validate()
      ).toEqual([
        "The provided token is invalid. It should begin with 'qltcp_' or 'qltcw_' followed by alphanumerics.",
      ]);

      expect(
        Settings.createNull({
          "coverage-token": "qltcp_1234567890",
        }).validate()
      ).toEqual([]);
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
        "oidc-token:audience=https://qlty.sh"
      );
    });

    test("raises when token is missing", async () => {
      const settings = Settings.createNull({
        "coverage-token": "",
        token: "",
        oidc: false,
      });

      await expect(settings.getToken()).rejects.toThrow(
        "'token' is required when 'oidc' is false."
      );
    });
  });
});
