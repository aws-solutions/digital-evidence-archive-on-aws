# `DEA Root Directory`

⚠️ $\textcolor{red}{\text{Experimental}}$ ⚠️ : Not for use in any critical, production, or otherwise important deployments

# Code Coverage

| Statements                                                                               | Branches                                                                             | Functions                                                                              | Lines                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Statements](https://img.shields.io/badge/statements-100%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-100%25-brightgreen.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-100%25-brightgreen.svg?style=flat) |

## Useful commands

- `rushx compile` compile
- `rushx build` compile and build this project
- `rushx test` perform the jest unit tests for Infrastructure Stack and update the coverage badge on readme
- `rushx cdk:deploy` compile and deploy this stack to your default AWS account/region
- `rushx cdk:synth` emits the synthesized CloudFormation template

## Description

To install for the first time, run the following commands:

Install git submodules

```
git submodule update --init --recursive --remote
```

Update & build rush

```
rush cupdate
rush build
```

In the future, if you are building dea-backend or any single package sepficially. Run the following command

- `rush build -f @aws/dea-backend`

-f indicates forward 1 directory
