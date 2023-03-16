# Digital Evidence Archive UI

⚠️ $\textcolor{red}{\text{Experimental}}$ ⚠️ : Not for use in any critical, production, or otherwise important deployments

This is a prototype app and you should expect to modify the source code to reflect your project needs.

## Code Coverage

| Statements                                                                                   | Branches                                                                                 | Functions                                                                                  | Lines                                                                              |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| ![Statements](https://img.shields.io/badge/statements-78.42%25-red.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-66.26%25-red.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-76.07%25-red.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-78.58%25-red.svg?style=flat) |


## Deploying code changes

Navigate to dea-main and follow instructions in [README](../../README.md)

## Running locally

First, run the development server:

```sh
rushx dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. You'll need to navigate further to /{stage}/ui, e.g. [http://localhost:3000/chewbacca/ui](http://localhost:3000/chewbacca/ui)

The UI running locally will be configured to point to your deployed backend via the DEA_API_URL environment variable, which will be copied into a generated [.env.local](.env.local) for use by Nextjs.

You will need to visit the Cognito Hosted UI to authenticate your instance, for finding the URL you need you can run [getLoginUrls](./scripts/getLoginUrls.sh), oce you login with a cognito user ([Test User Generation for API requests](../../README.md)) you will be redirected to the UI which will now have credentials.
## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Design system

For the design system we are using Cloudscape. More information can be found [here](https://cloudscape.design/).
