import { Settings } from "src/settings";

class SettingsWrapper implements ProxyHandler<any> {
  get(target: any, property: string | symbol, receiver: any) {
    if (property === "getFiles") {
      return () => this.getFiles();
    }
    return Reflect.get(target, property, receiver);
  }
  getFiles() {
    return ["foo", "bar"];
  }
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
    expect(proxy.getFiles()).toEqual(["foo", "bar"]);
  });
});
