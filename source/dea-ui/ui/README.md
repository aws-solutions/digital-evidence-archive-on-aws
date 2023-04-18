# Digital Evidence Archive UI

⚠️ $\textcolor{red}{\text{Experimental}}$ ⚠️ : Not for use in any critical, production, or otherwise important deployments

This is a prototype app and you should expect to modify the source code to reflect your project needs.

## Code Coverage

| Statements                                                                                   | Branches                                                                                 | Functions                                                                                  | Lines                                                                              |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| ![Statements](https://img.shields.io/badge/statements-93.11%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-85.85%25-yellow.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-91.24%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-93.49%25-brightgreen.svg?style=flat) |

## Deploying code changes

Navigate to DEA root directory and follow instructions in [README](../../../README.md)

## Running locally

First, run the https proxy so your cookies will work:
```sh
rushx dev:https
```
In a separate tab or process, run the development server:

```sh
rushx dev
```

Open [https://localhost:3001](https://localhost:3001) with your browser to see the result. You'll need to navigate further to /{stage}/ui, e.g. [https://localhost:3001/chewbacca/ui](https://localhost:3001/chewbacca/ui)

The UI running locally will be configured to point to your deployed backend via the DEA_API_URL environment variable, which will be copied into a generated [.env.local](.env.local) for use by Nextjs.

You can generate cognito tests users by following the directions here:
([Test User Generation for API requests](../../README.md)) you will be redirected to the UI which will now have credentials.
## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Design system

For the design system we are using Cloudscape. More information can be found [here](https://cloudscape.design/).

#### Common issues

If ports 3000 or 3001 are already in use. Use the `npx kill-port` command to clear the port before running the https proxy or development server

example: `npx kill-port 3000`
