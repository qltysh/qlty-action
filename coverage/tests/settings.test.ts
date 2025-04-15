import { Settings } from "src/settings";

class SettingsWrapper {
  // TODO
}

describe("Settings", () => {
  test("works", async () => {
    const target = {
      foo: "bar",
      baz: 42,
    };

    const proxy = new Proxy(target, new SettingsWrapper());
    expect(proxy.foo).toEqual("bar");
    expect(proxy.baz).toEqual(42);
  });
});
