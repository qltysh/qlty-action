interface Input {
  name: string;
}

interface SettingsFunctions {
  greet(): Promise<string[]>;
}

type WrappedSettings = Input & SettingsFunctions;

// function createSettingsFunctions(input: Input): SettingsFunctions {
//   return;
// }

function buildProxy(input: Input): WrappedSettings {
  const settingsFunctions = {
    greet: async () => {
      return Promise.resolve(["Hello", input.name]);
    },
  }; //createSettingsFunctions(input);

  return new Proxy(input, {
    get(target, prop, receiver) {
      const key = String(prop);

      if (key in target) {
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }

      if (key in settingsFunctions) {
        const value = settingsFunctions[key as keyof SettingsFunctions];
        return value;
      }
    },
  }) as WrappedSettings;
}

describe("Settings", () => {
  test("works", async () => {
    const input = {
      name: "Bryan",
    };
    const proxy = buildProxy(input);
    expect(proxy.name).toEqual("Bryan");
    expect(await proxy.greet()).toEqual(["Hello", "Bryan"]);
  });
});
