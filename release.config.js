const config = {
	branches: ["main"],
	plugins: [
		[
			"@semantic-release/commit-analyzer",
			{
				parserOpts: {
					noteKeywords: ["BREAKING CHANGE", "BREAKING CHANGES"],
				},
				preset: "angular",
				releaseRules: [{ release: "patch", scope: "deps", type: "chore" }],
			},
		],
		[
			"@semantic-release/exec",
			{
				prepareCmd: "./scripts/pre-release-updates.sh ${nextRelease.version}",
			},
		],
		[
			"@semantic-release/release-notes-generator",
			{
				/*  
              to introduce new sections in changelog
          */
				parserOpts: {
					noteKeywords: ["BREAKING CHANGE", "BREAKING CHANGES", "BREAKING"],
				},
				presetConfig: {
					types: [
						{ hidden: false, section: "Features", type: "feat" },
						{ hidden: false, section: "Bug Fixes", type: "fix" },
						{ hidden: false, section: "Miscellaneous Chores", type: "docs" },
						{ hidden: false, section: "Miscellaneous Chores", type: "perf" },
						{
							hidden: false,
							scope: "deps",
							section: "Dependency Updates",
							type: "chore",
						},
					],
				},
			},
		],
		"semantic-release-export-data",
		[
			"@semantic-release/git",
			{
				assets: ["mta.yaml", "version.json"],
				message: "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}",
			},
		],
		"@semantic-release/github",
	],
};

module.exports = config;
