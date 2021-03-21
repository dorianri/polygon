#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { PolygoneAppStack } from '../lib/polygone-app-stack';

const app = new cdk.App();
new PolygoneAppStack(app, 'PolygoneAppStack');
