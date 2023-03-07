# `DEA Root Directory`

⚠️ $\textcolor{red}{\text{Experimental}}$ ⚠️ : Not for use in any critical, production, or otherwise important deployments

## Useful commands

- `rush build` compile and build this project
- `rush test` perform the jest unit tests for Infrastructure Stack and update the coverage badge on readme
- `rush purge` delete temporary files created by rush, such as caches, dependency packages, and build artifacts.
- `rush cupdate` install or update dependencies and git hooks

## Description

To install for the first time, run the following commands:

```
npm install -g @microsoft/rush
rush cupdate
rush build
```

Once complete, navigate to dea-main directory and follow instructions in README to install DEA in your AWS account