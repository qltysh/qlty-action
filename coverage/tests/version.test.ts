import Version from "src/version";

describe("Version", () => {
  const nullConsole = {
    error: vi.fn(),
  };

  test("returns a semver", () => {
    const version = Version.readVersion();
    expect(version).toMatch(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*)?(?:\+(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/,
    );
  });

  test("returns null when package.json is invalid", () => {
    const version = Version.readVersion({
      readFileSync: () => '{ "version": "123.456.789" }',
    });
    expect(version).toEqual("123.456.789");
  });

  test("returns null when package.json cannot be read", () => {
    const version = Version.readVersion(
      {
        readFileSync: () => {
          throw new Error("File not found");
        },
      },
      nullConsole,
    );
    expect(version).toBeNull();
  });

  test("returns null when package.json is invalid", () => {
    const version = Version.readVersion(
      {
        readFileSync: () => "NOT JSON",
      },
      nullConsole,
    );
    expect(version).toBeNull();
  });
});
