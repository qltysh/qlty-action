import { Settings } from "src/settings";

class SettingsWrapper<T extends object> implements ProxyHandler<T> {
  get(target: T, property: PropertyKey, receiver: unknown) {
    if (property === "getFiles") {
      return () => this.getFiles();
    }
    return Reflect.get(target, property, receiver);
  }
  async getFiles(): Promise<string[]> {
    return Promise.resolve(["foo", "bar"]);
  }
}

describe("Settings", () => {
  test("works", async () => {
    const target = {
      foo: "bar",
      baz: 42,
    };

    const proxy = new Proxy(
      target,
      new SettingsWrapper<typeof target>()
    ) as typeof target & { getFiles(): string[] };
    expect(proxy.foo).toEqual("bar");
    expect(proxy.baz).toEqual(42);
    expect(await proxy.getFiles()).toEqual(["foo", "bar"]);
  });
});
