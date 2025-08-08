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
      "validate-file-threshold": "75",
      command: "publish",
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
      validateFileThreshold: 75,
      command: "publish",
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
      validate: false,
      "validate-file-threshold": "",
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
      validateFileThreshold: undefined,
      command: "publish", // Default value
    });
  });

  describe("command", () => {
    test("sets default command to publish", () => {
      const settings = Settings.createNull({
        oidc: true,
        files: "info.lcov",
        command: "",
      });
      expect(settings.input.command).toEqual("publish");
    });

    test("parses valid commands", () => {
      let settings = Settings.createNull({
        oidc: true,
        files: "info.lcov",
        command: "publish",
      });
      expect(settings.input.command).toEqual("publish");

      settings = Settings.createNull({
        oidc: true,
        files: "info.lcov",
        command: "complete",
      });
      expect(settings.input.command).toEqual("complete");
    });

    test("rejects invalid commands", () => {
      expect(() => {
        Settings.createNull({
          oidc: true,
          files: "info.lcov",
          command: "invalid",
        });
      }).toThrow();
    });
  });

  describe("totalPartsCount", () => {
    test("allows missing", () => {
      const settings = Settings.createNull({
        oidc: true,
        "total-parts-count": "",
      });
      expect(settings.input.totalPartsCount).toBeUndefined();
    });

    test("parses numbers", () => {
      let settings = Settings.createNull({
        oidc: true,
        "total-parts-count": "1",
      });
      expect(settings.input.totalPartsCount).toEqual(1);

      settings = Settings.createNull({
        oidc: true,
        "total-parts-count": "2",
      });
      expect(settings.input.totalPartsCount).toEqual(2);
    });

    test("rejects invalid values", () => {
      expect(() => {
        Settings.createNull({
          oidc: true,
          "total-parts-count": "foo",
        });
      }).toThrow();

      expect(() => {
        Settings.createNull({
          oidc: true,
          "total-parts-count": "0",
        });
      }).toThrow();

      expect(() => {
        Settings.createNull({
          oidc: true,
          "total-parts-count": "-1",
        });
      }).toThrow();

      expect(() => {
        Settings.createNull({
          oidc: true,
          "total-parts-count": "1.1",
        });
      }).toThrow();
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

  describe("validateFileThreshold", () => {
    test("allows missing", () => {
      const settings = Settings.createNull({
        oidc: true,
        "validate-file-threshold": "",
      });
      expect(settings.input.validateFileThreshold).toBeUndefined();
    });

    test("parses valid threshold values", () => {
      let settings = Settings.createNull({
        oidc: true,
        "validate-file-threshold": "1",
      });
      expect(settings.input.validateFileThreshold).toEqual(1);

      settings = Settings.createNull({
        oidc: true,
        "validate-file-threshold": "50",
      });
      expect(settings.input.validateFileThreshold).toEqual(50);

      settings = Settings.createNull({
        oidc: true,
        "validate-file-threshold": "100",
      });
      expect(settings.input.validateFileThreshold).toEqual(100);
    });

    test("rejects threshold values below 1", () => {
      expect(() => {
        Settings.createNull({
          oidc: true,
          "validate-file-threshold": "0",
        });
      }).toThrow();

      expect(() => {
        Settings.createNull({
          oidc: true,
          "validate-file-threshold": "-10",
        });
      }).toThrow();
    });

    test("rejects threshold values above 100", () => {
      expect(() => {
        Settings.createNull({
          oidc: true,
          "validate-file-threshold": "101",
        });
      }).toThrow();

      expect(() => {
        Settings.createNull({
          oidc: true,
          "validate-file-threshold": "150",
        });
      }).toThrow();
    });

    test("rejects non-numeric threshold values", () => {
      expect(() => {
        Settings.createNull({
          oidc: true,
          "validate-file-threshold": "abc",
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
          files: "coverage.json",
        }).validate(),
      ).toEqual([]);

      expect(
        Settings.createNull({
          token: "qltcp_1234567890",
          oidc: false,
          files: "coverage.json",
        }).validate(),
      ).toEqual([]);

      expect(
        Settings.createNull({
          "coverage-token": "",
          token: "",
          oidc: true,
          files: "coverage.json",
        }).validate(),
      ).toEqual([]);

      // Validate with validate-file-threshold is allowed when validate=true
      expect(
        Settings.createNull({
          token: "qltcp_1234567890",
          oidc: false,
          validate: true,
          "validate-file-threshold": "80",
          files: "coverage.json",
        }).validate(),
      ).toEqual([]);
    });

    test("fails when files is missing", () => {
      const settings = Settings.createNull({
        token: "qltcp_1234567890",
        oidc: false,
        files: "",
      });
      expect(settings.validate()).toEqual([
        "The 'files' input is required when command is 'publish'.",
      ]);
    });

    test("fails when OIDC and token are both missing", () => {
      const settings = Settings.createNull({
        token: "",
        oidc: false,
        files: "coverage.json",
      });

      expect(settings.validate()).toEqual([
        "Either 'oidc' or 'token' must be provided.",
      ]);
    });

    test("fails when OIDC and token are both present", () => {
      const settings = Settings.createNull({
        token: "qltcp_1234567890",
        oidc: true,
        files: "coverage.json",
      });

      expect(settings.validate()).toEqual([
        "Both 'oidc' and 'token' cannot be provided at the same time.",
      ]);
    });

    test("validates token", () => {
      expect(
        Settings.createNull({
          token: "wrong",
          files: "coverage.json",
        }).validate(),
      ).toEqual([
        "The provided token is invalid. It should begin with 'qltcp_' or 'qltcw_' followed by alphanumerics.",
      ]);

      expect(
        Settings.createNull({
          "coverage-token": "wrong",
          files: "coverage.json",
        }).validate(),
      ).toEqual([
        "The provided token is invalid. It should begin with 'qltcp_' or 'qltcw_' followed by alphanumerics.",
      ]);

      expect(
        Settings.createNull({
          "coverage-token": "qltcp_1234567890",
          files: "coverage.json",
        }).validate(),
      ).toEqual([]);
    });

    test("allows missing token and OIDC when dry-run is true", () => {
      const settings = Settings.createNull({
        token: "",
        oidc: false,
        "dry-run": true,
        files: "coverage.json",
      });

      expect(settings.validate()).toEqual([]);
    });

    test("allows invalid token format when dry-run is true", () => {
      const settings = Settings.createNull({
        token: "invalid-token",
        oidc: false,
        "dry-run": true,
        files: "coverage.json",
      });

      expect(settings.validate()).toEqual([]);
    });

    test("allows both token and OIDC when dry-run is true", () => {
      const settings = Settings.createNull({
        token: "qltcp_1234567890",
        oidc: true,
        "dry-run": true,
        files: "coverage.json",
      });

      expect(settings.validate()).toEqual([]);
    });

    test("fails when validate-file-threshold is provided without validate", () => {
      const settings = Settings.createNull({
        token: "qltcp_1234567890",
        oidc: false,
        validate: false,
        "validate-file-threshold": "80",
        files: "coverage.json",
      });

      expect(settings.validate()).toEqual([
        "'validate-file-threshold' requires 'validate' to be set to true.",
      ]);
    });

    describe("command=complete validation", () => {
      test("valid complete command with minimal inputs", () => {
        const settings = Settings.createNull({
          token: "qltcp_1234567890",
          command: "complete",
          files: "",
        });

        expect(settings.validate()).toEqual([]);
      });

      test("fails when complete command has files", () => {
        const settings = Settings.createNull({
          token: "qltcp_1234567890",
          command: "complete",
          files: "coverage.json",
        });

        expect(settings.validate()).toContain(
          "'files' cannot be used when command is 'complete'.",
        );
      });

      test("fails when complete command has invalid inputs", () => {
        const settings = Settings.createNull({
          token: "qltcp_1234567890",
          command: "complete",
          files: "coverage.json",
          "add-prefix": "src/",
          "skip-missing-files": true,
          format: "lcov",
          "total-parts-count": "5",
          "dry-run": true,
          incomplete: true,
          name: "test",
          validate: true,
          "validate-file-threshold": "80",
        });

        const errors = settings.validate();

        expect(errors).toContain(
          "'files' cannot be used when command is 'complete'.",
        );
        expect(errors).toContain(
          "'add-prefix' cannot be used when command is 'complete'.",
        );
        expect(errors).toContain(
          "'skip-missing-files' cannot be used when command is 'complete'.",
        );
        expect(errors).toContain(
          "'format' cannot be used when command is 'complete'.",
        );
        expect(errors).toContain(
          "'total-parts-count' cannot be used when command is 'complete'.",
        );
        expect(errors).toContain(
          "'incomplete' cannot be used when command is 'complete'.",
        );
        expect(errors).toContain(
          "'name' cannot be used when command is 'complete'.",
        );
        // validate is no longer an error since it defaults to true and is just ignored
        expect(errors).not.toContain(
          "'validate' cannot be used when command is 'complete'.",
        );
        expect(errors).toContain(
          "'validate-file-threshold' cannot be used when command is 'complete'.",
        );
      });

      test("allows tag input with complete command", () => {
        const settings = Settings.createNull({
          token: "qltcp_1234567890",
          command: "complete",
          files: "",
          tag: "units",
        });

        expect(settings.validate()).toEqual([]);
      });
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
