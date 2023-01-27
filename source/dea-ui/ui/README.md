# Digital Evidence Archive UI

⚠️ $\textcolor{red}{\text{Experimental}}$ ⚠️ : Not for use in any critical, production, or otherwise important deployments

This is a prototype app and you should expect to modify the source code to reflect your project needs.

## Code Coverage

| Statements                                                                                   | Branches                                                                                 | Functions                                                                                  | Lines                                                                              |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| ![Statements](https://img.shields.io/badge/statements-92.28%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-82.85%25-yellow.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-85.82%25-yellow.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-92.8%25-brightgreen.svg?style=flat) |

## Creating a stage file

First, you will need to create a stage file. An example stage file (demo.yaml) can be found under dea-ui/ui/src/config. Create a stage file for your deployment with the stage name of your choice. Supply the stage name and region short name of your choice along with the aws region where you will deploy the UI (this will need to the same region where the DEA backend is deployed).

## Deploying the UI

One you have created your stage file run

```sh
STAGE=<stagename> rushx deploy-ui
```

## Deploying code changes

To deploy code changes without running the entire deployment script navigate to the infrastructure directory and run the deploy command directly:

```sh
cd infrastructure
STAGE=<stagename> rushx cdk deploy
```

## Running locally

First, run the development server:

```sh
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Design system

For the design system we are using Cloudscape. More information can be found [here](https://cloudscape.design/).
