import { StubbedCommandExecutor } from "../src/util/exec";

// The coverage action's tests rely on the stub failing the way @actions/exec
// does, so a dropped ignoreReturnCode shows up as a failing test.
describe("StubbedCommandExecutor", () => {
  test("returns the exit code with ignoreReturnCode", async () => {
    const executor = new StubbedCommandExecutor({ exitCode: 3 });

    await expect(
      executor.exec("qlty", [], { ignoreReturnCode: true }),
    ).resolves.toBe(3);
  });

  test("rejects a nonzero exit code without ignoreReturnCode", async () => {
    const executor = new StubbedCommandExecutor({ exitCode: 3 });

    await expect(executor.exec("qlty", [])).rejects.toThrow(
      "The process 'qlty' failed with exit code 3",
    );
  });

  test("rejects when the command cannot start, even with ignoreReturnCode", async () => {
    const executor = new StubbedCommandExecutor({ startError: "spawn ENOENT" });

    await expect(
      executor.exec("qlty", [], { ignoreReturnCode: true }),
    ).rejects.toThrow("spawn ENOENT");
  });
});
