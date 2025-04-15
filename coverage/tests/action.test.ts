import { CoverageAction } from "src/action";
import { Settings } from "src/settings";

//     try {
//       this._emitter.emit(EXEC_EVENT, ["qlty", ...uploadArgs]);
//       await this._executor.exec("qlty", uploadArgs, {
//         env: {
//           ...process.env,
//           QLTY_COVERAGE_TOKEN: token,
//         },
//         listeners: {
//           stdout: (data: Buffer) => {
//             qlytOutput += data.toString();
//           },
//           stderr: (data: Buffer) => {
//             qlytOutput += data.toString();
//           },
//         },
//       });
//     } catch {
//       if (this._settings.input.skipErrors) {
//         this._output.warning(
//           "Error uploading coverage, skipping due to skip-errors"
//         );
//         this._output.warning("Output:");
//         this._output.warning(qlytOutput);
//       } else {
//         throw new CoverageUploadError(qlytOutput);
//       }
//     }
//   }

//     if (this._settings.input.verbose) {
//       uploadArgs.push("--print");
//     }

//     const payload = this._context.payload;

//     // Github doesn't provide the head's sha for PRs, so we need to extract it from the event's payload
//     // https://github.com/orgs/community/discussions/26325
//     // https://www.kenmuse.com/blog/the-many-shas-of-a-github-pull-request/
//     if (payload.pull_request) {
//       uploadArgs.push(
//         "--override-commit-sha",
//         payload.pull_request["head"].sha
//       );
//       uploadArgs.push("--override-branch", payload.pull_request["head"].ref);
//     }

//     const files = await this._settings.getFiles();
//     return uploadArgs.concat(files);

describe("CoverageAction", () => {
  test("runs qlty coverage publish", async () => {
    const { action, commands } = createTrackedAction({
      settings: Settings.createNull({
        "coverage-token": "test-token",
        files: "info.lcov",
      }),
    });
    await action.run();
    expect(commands.clear()).toEqual([
      ["qlty", "coverage", "publish", "info.lcov"],
    ]);
  });

  test("adds arguments based on inputs", async () => {
    const { action, commands } = createTrackedAction({
      settings: Settings.createNull({
        "coverage-token": "test-token",
        files: "info.lcov",
        "skip-missing-files": true,
        "total-parts-count": "5",
        tag: "test-tag",
        "add-prefix": "prefix",
        "strip-prefix": "strip",
        verbose: true,
      }),
    });
    await action.run();
    expect(commands.clear()).toEqual([
      [
        "qlty",
        "coverage",
        "publish",
        "--print",
        "--transform-add-prefix",
        "prefix",
        "--transform-strip-prefix",
        "strip",
        "--tag",
        "test-tag",
        "--total-parts-count",
        "5",
        "--skip-missing-files",
        "info.lcov",
      ],
    ]);
  });

  function createTrackedAction({ settings = Settings.createNull() } = {}) {
    const action = CoverageAction.createNull({ settings });
    const commands = action.trackOutput();
    return { commands, action };
  }
});
