import { Settings } from "src/settings";

describe("Settings", () => {
  test("parses values", () => {
    const settings = Settings.createNull({
      "coverage-token": "test-token",
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
      coverageToken: "test-token",
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
    test("fails when OIDC and coverage token are both missing", () => {
      const settings = Settings.createNull({
        "coverage-token": "",
        oidc: false,
      });

      expect(() => settings.validate()).toThrow(
        "Either 'oidc' or 'coverage-token' must be provided."
      );
    });

    test("fails when OIDC and coverage token are both present", () => {
      const settings = Settings.createNull({
        "coverage-token": "test-token",
        oidc: true,
      });

      expect(() => settings.validate()).toThrow(
        "Both 'oidc' and 'coverage-token' cannot be provided at the same time."
      );
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
        token: "test-token",
        oidc: false,
      });
      expect(await settings.getToken()).toEqual("test-token");
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
        token: "test-token",
        "coverage-token": "test-coverage-token",
        oidc: false,
      });
      expect(await settings.getToken()).toEqual("test-token");
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
  });
});
