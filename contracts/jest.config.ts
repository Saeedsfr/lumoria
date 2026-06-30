import type { Config } from "jest";

const config: Config = {
    preset:          "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/*.spec.ts"],
    testTimeout:     30000,
    maxWorkers:      "50%",
    globals: {
        "ts-jest": {
            tsconfig: "tsconfig.json",
        },
    },
};

export default config;
