# `dea-backend`

⚠️ $\textcolor{red}{\text{Experimental}}$ ⚠️ : Not for use in any critical, production, or otherwise important deployments

# Code Coverage

| Statements                                                                               | Branches                                                                             | Functions                                                                              | Lines                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Statements](https://img.shields.io/badge/statements-97.22%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-80%25-yellow.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-97.14%25-brightgreen.svg?style=flat) |

## Useful commands

- `rushx compile` compile
- `rushx build` compile and build this project
- `rushx test` perform the jest unit, integration and CDK tests and update the coverage badge on readme
- `rushx cdk:deploy` compile and deploy this stack to your default AWS account/region
- `rushx cdk:synth` emits the synthesized CloudFormation template

## Description

Infrastructure for sample express app

To deploy, make sure to have built Rush in the source directory. Refer to Source directory readme.

- `rushx cdk synth`
- `rushx cdk bootstrap aws://{aws id}/{region}`
- `rushx cdk deploy`
