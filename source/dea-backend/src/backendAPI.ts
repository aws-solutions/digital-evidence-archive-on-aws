import { generateRouter, ApiRouteConfig } from "@aws/dea-app";

import { AuditService, BaseAuditPlugin } from "@aws/workbench-core-audit";
import { AwsService, AuditLogger } from "@aws/workbench-core-base";
import {
  DataSetService,
  S3DataSetStoragePlugin,
  DdbDataSetMetadataPlugin,
} from "@aws/workbench-core-datasets";
import { LoggingService } from "@aws/workbench-core-logging";
import { Express } from "express";
import HelloWorldService from "./services/helloWorldService";

const logger: LoggingService = new LoggingService();
const aws: AwsService = new AwsService({
  region: process.env.AWS_REGION!,
  ddbTableName: process.env.STACK_NAME!,
});

const apiRouteConfig: ApiRouteConfig = {
  routes: [
    {
      path: "/hi",
      serviceAction: "sayHello",
      httpMethod: "get",
      service: new HelloWorldService(),
    },
    {
      path: "/bye",
      serviceAction: "sayBye",
      httpMethod: "get",
      service: new HelloWorldService(),
    },
  ],
  dataSetService: new DataSetService(
    new AuditService(new BaseAuditPlugin(new AuditLogger(logger))),
    logger,
    new DdbDataSetMetadataPlugin(aws, "DATASET", "ENDPOINT")
  ),
  dataSetsStoragePlugin: new S3DataSetStoragePlugin(aws),
  allowedOrigins: JSON.parse(process.env.ALLOWED_ORIGINS || "[]"),
};

const backendAPIApp: Express = generateRouter(apiRouteConfig);

export default backendAPIApp;
