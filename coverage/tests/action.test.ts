import { CoverageAction } from "src/action";
import { Settings } from "src/settings";

describe("CoverageAction", () => {
  test("works", async () => {
    const settings = Settings.createNull({
      coverageToken: "test-token",
      files: "**/coverage/**",
    });
    const action = CoverageAction.createNull({ settings });
    await action.run();
    // const { downloads, installer } = createTrackedInstaller({
    //   os: new StubbedOperatingSystem("linux", "x64"),
    // });
    // await installer.install();
    // expect(downloads.clear()).toEqual([
    //   "https://qlty-releases.s3.amazonaws.com/qlty/latest/qlty-x86_64-unknown-linux-gnu.tar.xz",
    // ]);
  });
});
