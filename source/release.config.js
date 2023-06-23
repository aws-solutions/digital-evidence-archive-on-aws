module.exports = {
  branches: 'main',
  repositoryUrl: 'git@github.com:aws-solutions/digital-evidence-archive-on-aws.git',
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/github',
  ],
};
