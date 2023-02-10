module.exports = {
  branches: "main",
  repositoryUrl: "ssh://git.amazon.com/pkg/Digital-evidence-archive",
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/github",
  ],
};
