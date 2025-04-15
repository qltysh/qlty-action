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
    test("fails when OIDC and coverage token are both missing", () => {});
    test("fails when OIDC and coverage token are both present", () => {});
  });

  describe("getFiles", () => {
    test("accepts comma separated patterns", () => {});
    test("accepts newline separated patterns", () => {});
    test("returns sorted, unique paths", () => {});
  });

  describe("getToken", () => {
    test("returns the coverage token", () => {});
    test("generates an ID token", () => {});
  });
});
