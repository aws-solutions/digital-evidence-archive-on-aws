# `DEA Root Directory`

⚠️ $\textcolor{red}{\text{Experimental}}$ ⚠️ : Not for use in any critical, production, or otherwise important deployments

## Useful commands

- `rushx compile` compile
- `rushx build` compile and build this project
- `rushx test` perform the jest unit tests for Infrastructure Stack and update the coverage badge on readme
- `rushx cdk:deploy` compile and deploy this stack to your default AWS account/region
- `rushx cdk:synth` emits the synthesized CloudFormation template

## Description

To install for the first time, run the following commands:

Update & build rush

```
rush cupdate
rush build
```

In the future, if you are building dea-backend or any single package sepficially. Run the following command

- `rush build -f @aws/dea-backend`

-f indicates forward 1 directory
