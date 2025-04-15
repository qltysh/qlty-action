interface Input {
  name: string;
}

interface SettingsFunctions {
  greet(): Promise<string[]>;
}

type WrappedSettings = Input & SettingsFunctions;

function createSettingsFunctions(input: Input): SettingsFunctions {
  return {
    greet: async () => {
      return Promise.resolve(["Hello", input.name]);
    },
  };
}

const input = {
  name: "Bryan",
};

function buildProxy(input: Input): WrappedSettings {
  const settingsFunctions = createSettingsFunctions(input);

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

      // return (...args: unknown[]) => extraMethods.fallback(key, ...args);
    },
  }) as WrappedSettings;
}

// const proxy: WrappedSettings = new Proxy(input, {
//   get(target, prop, receiver) {
//     const key = String(prop);

//     if (key in target) {
//       const value = Reflect.get(target, prop, receiver);
//       return typeof value === "function" ? value.bind(target) : value;
//     }

//     if (key in settingsFunctions) {
//       const value = settingsFunctions[key as keyof SettingsFunctions];
//       return value;
//     }

//     // return (...args: unknown[]) => extraMethods.fallback(key, ...args);
//   },
// });

// class SettingsWrapper<T extends object> implements ProxyHandler<T> {
//   get(target: T, property: PropertyKey, receiver: unknown) {
//     if (property === "getFiles") {
//       return () => this.getFiles();
//     }
//     return Reflect.get(target, property, receiver);
//   }
//   async getFiles(): Promise<string[]> {
//     return Promise.resolve(["foo", "bar"]);
//   }
// }

describe("Settings", () => {
  test("works", async () => {
    const input = {
      name: "Bryan",
    };
    const proxy = buildProxy(input); // as unknown as WrappedSettings;
    expect(proxy.name).toEqual("Bryan");
    expect(await proxy.greet()).toEqual(["Hello", "Bryan"]);

    // const target = {
    //   foo: "bar",
    //   baz: 42,
    // };
    // const proxy = new Proxy(
    //   target,
    //   new SettingsWrapper<typeof target>()
    // ) as typeof target & { getFiles(): string[] };
    // expect(proxy.foo).toEqual("bar");
    // expect(proxy.baz).toEqual(42);
    // expect(await proxy.getFiles()).toEqual(["foo", "bar"]);
  });
});
