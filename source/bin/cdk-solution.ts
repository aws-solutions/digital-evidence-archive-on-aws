#!/usr/bin/env node

import 'source-map-support/register';
import { LambdaAspect } from '../lib/aspects/apply-to-lambda';
import { HelloSolutionsConstructsStack } from '../lib/cdk-solution-stack';
import { App, Aspects } from 'aws-cdk-lib';

const app = new App();
const helloConstructsStack = new HelloSolutionsConstructsStack(
    app,
    'CdkSolutionStack'
);
Aspects.of(app).add(new LambdaAspect(helloConstructsStack, 'Layer'));
