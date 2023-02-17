# `dea-backend`

⚠️ $\textcolor{red}{\text{Experimental}}$ ⚠️ : Not for use in any critical, production, or otherwise important deployments

# Code Coverage

| Statements                                                                               | Branches                                                                             | Functions                                                                              | Lines                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Statements](https://img.shields.io/badge/statements-96.49%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-93.87%25-brightgreen.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-98.07%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-96.41%25-brightgreen.svg?style=flat) |


## Useful commands

- `rushx compile` compile
- `rushx build` compile and build this project
- `rushx test` perform the jest unit, integration and CDK tests and update the coverage badge on readme
- `rushx cdk:deploy` compile and deploy this stack to your default AWS account/region
- `rushx cdk:synth` emits the synthesized CloudFormation template

## Description

Infrastructure for sample express app

### Setting Up Configuration

The backend of this app get certain values from the configuration files. For each stage of your application (e.g. dev, alpha, gamma, prod), create a file named <STAGE>.yaml in the config folder underneath the src folder within the dea-backend directory. NOTE: each stage needs its separate yaml folder. Follow these steps:

1. Copy and paste the contents of example.yaml into the new file
2. Fill in the lines as specified.
3. Save the file, and commit to your local branch if you have one
4. Create a config file in the dea-ui folder, following the instructions in that folder's README under the section "Creating a stage file"

### Deployment

1. Follow the steps in the previous section, "Setting Up Configuration"
2. Build rush in the source directory. Refer to Source directory readme.
3. Run the following commands

- `STAGE=<dev, prod, beta>
- `STAGE=$STAGE rushx cdk bootstrap aws://{aws id}/{region}`
- `STAGE=$STAGE rushx cdk deploy`
