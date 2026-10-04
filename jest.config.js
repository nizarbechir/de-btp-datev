/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	clearMocks: true,
	collectCoverage: true,
	collectCoverageFrom: ["srv/**/*.{js,jsx,ts,tsx}"],
	coveragePathIgnorePatterns: ["/node_modules/", "/gen/", "/dist/"],
	coverageReporters: ["text"],
	globalSetup: "./test/setup.ts",
	preset: "ts-jest",
	setupFiles: ["./test/env.ts"],
	testEnvironment: "node",
	testPathIgnorePatterns: ["/node_modules/", "/dist/", "/gen/", "/app/"],
};
