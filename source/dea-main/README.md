# `dea-main`

⚠️ $\textcolor{red}{\text{Experimental}}$ ⚠️ : Not for use in any critical, production, or otherwise important deployments

# Code Coverage

| Statements                                                                               | Branches                                                                             | Functions                                                                              | Lines                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Statements](https://img.shields.io/badge/statements-96.29%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-85.71%25-yellow.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-96.22%25-brightgreen.svg?style=flat) |

## Useful commands

- `rushx build` compile and build this project
- `rushx test` perform the jest unit, integration and CDK tests and update the coverage badge on readme
- `rushx cdk:deploy` compile and deploy this stack to your default AWS account/region
- `rushx cdk:synth` emits the synthesized CloudFormation template

## Description

Parent Infrastructure stack for DEA

### Deployment

1. Configure environment variables

```sh
export DOMAIN_PREFIX={unique sub-domain for cognito hosted UI}
```

2. Run the following commands in this directory to deploy DEA

- `rushx cdk bootstrap aws://{aws id}/{region}`
- `rushx cdk deploy`

#### Common issues

| Command | Issue | Fix|
| --- | ----------- | ----------- |
| `rushx cdk bootstrap aws://{aws id}/{region}` | `Resolution error: ID components may not include unresolved tokens` | `export DOMAIN_PREFIX=<cognito-domain-prefix>` |
| `rushx cdk deploy` | `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Cannot read properties of undefined (reading '...source/common/config/rush')` | `npm install -g pnpm@7.16.0`|
