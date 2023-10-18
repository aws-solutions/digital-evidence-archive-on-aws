/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Duration, NestedStack } from 'aws-cdk-lib';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import {
  Alarm,
  Color,
  ComparisonOperator,
  Dashboard,
  GraphWidget,
  MathExpression,
  Metric,
  TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import { Operation, Table } from 'aws-cdk-lib/aws-dynamodb';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { IFilterPattern, ILogGroup, MetricFilter } from 'aws-cdk-lib/aws-logs';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { ApiGatewayRoute } from '../resources/api-gateway-route-config';

const ALARM_EVALUATION_PERIOD_MINUTES = 2;
const ALARM_EVALUATION_PERIODS = 2;
const DEFAULT_LATENCY_THRESHOLD_MS = 2000;
const DASHBOARD_AGGREGATION_PERIOD_MINUTES = 2;
const API_ERROR_RATE_THRESHOLD_PERCENT = 3;
const LAMBDA_THROTTLE_THRESHOLD = 1;
const TABLE_SYSTEM_ERROR_THRESHOLD = 1;
const TABLE_THROTTLE_THRESHOLD = 1;
// we should expect DLQs to be always empty
const DEADLETTERQUEUE_MESSAGE_THRESHOLD = 0;
const DEADLETTERQUEUE_ALARM_EVALUATION_PERIODS = 1;

export class DeaOperationalDashboard extends NestedStack {
  private apiDashboard: Dashboard;
  private lambdaDashboard: Dashboard;
  private tableDashboard: Dashboard;

  private casesLatencyWidget: GraphWidget;
  private casesErrorRateWidget: GraphWidget;
  private authLatencyWidget: GraphWidget;
  private authErrorRateWidget: GraphWidget;
  private auditLatencyWidget: GraphWidget;
  private auditErrorRateWidget: GraphWidget;
  private miscLatencyWidget: GraphWidget;
  private miscErrorRateWidget: GraphWidget;

  private casesLambdaErrorWidget: GraphWidget;
  private casesLambdaThrottleWidget: GraphWidget;
  private authLambdaErrorWidget: GraphWidget;
  private authLambdaThrottleWidget: GraphWidget;
  private auditLambdaErrorWidget: GraphWidget;
  private auditLambdaThrottleWidget: GraphWidget;
  private miscLambdaErrorWidget: GraphWidget;
  private miscLambdaThrottleWidget: GraphWidget;

  private tableLatencyGraph: GraphWidget;
  private tableThroughputGraph: GraphWidget;
  private tableSystemErrorsGraph: GraphWidget;
  private tableThrottleGraph: GraphWidget;

  public constructor(scope: Construct, stackName: string) {
    super(scope, stackName);

    this.apiDashboard = new Dashboard(this, 'dea-api-dashboard');
    this.lambdaDashboard = new Dashboard(this, 'dea-lambda-dashboard');
    this.tableDashboard = new Dashboard(this, 'dea-dynamodb-dashboard');

    // resources
    this.casesLatencyWidget = this.graphWidget('Cases API latency (ms)', 10000);
    this.casesErrorRateWidget = this.graphWidget('Cases APIs Invocations & Errors');
    this.apiDashboard.addWidgets(this.casesLatencyWidget, this.casesErrorRateWidget);

    this.authLatencyWidget = this.graphWidget('Auth API latency (ms)', 10000);
    this.authErrorRateWidget = this.graphWidget('Auth APIs Invocations & Errors');
    this.apiDashboard.addWidgets(this.authLatencyWidget, this.authErrorRateWidget);

    this.auditLatencyWidget = this.graphWidget('Audit API latency (ms)', 10000);
    this.auditErrorRateWidget = this.graphWidget('Audit APIs Invocations & Errors');
    this.apiDashboard.addWidgets(this.auditLatencyWidget, this.auditErrorRateWidget);

    this.miscLatencyWidget = this.graphWidget('Misc API latency (ms)', 10000);
    this.miscErrorRateWidget = this.graphWidget('Misc APIs Invocations & Errors');
    this.apiDashboard.addWidgets(this.miscLatencyWidget, this.miscErrorRateWidget);

    // lambdas
    this.casesLambdaErrorWidget = this.graphWidget('Cases Lambda Invocations & Errors');
    this.casesLambdaThrottleWidget = this.graphWidget('Cases Lambda Throttle Count');
    this.lambdaDashboard.addWidgets(this.casesLambdaErrorWidget, this.casesLambdaThrottleWidget);

    this.authLambdaErrorWidget = this.graphWidget('Auth Lambda Invocations & Errors');
    this.authLambdaThrottleWidget = this.graphWidget('Auth Lambda Throttle Count');
    this.lambdaDashboard.addWidgets(this.authLambdaErrorWidget, this.authLambdaThrottleWidget);

    this.auditLambdaErrorWidget = this.graphWidget('Audit Lambda Invocations & Errors');
    this.auditLambdaThrottleWidget = this.graphWidget('Audit Lambda Throttle Count');
    this.lambdaDashboard.addWidgets(this.auditLambdaErrorWidget, this.auditLambdaThrottleWidget);

    this.miscLambdaErrorWidget = this.graphWidget('Misc Lambda Invocations & Errors');
    this.miscLambdaThrottleWidget = this.graphWidget('Misc Lambda Throttle Count');
    this.lambdaDashboard.addWidgets(this.miscLambdaErrorWidget, this.miscLambdaThrottleWidget);

    // dynamodb
    this.tableLatencyGraph = this.graphWidget('DEA DynamoDB Table Latency (ms)', 10000);
    this.tableThroughputGraph = this.graphWidget('DEA DynamoDB Table Throughput');
    this.tableSystemErrorsGraph = this.graphWidget('DEA DynamoDB Table Errors');
    this.tableThrottleGraph = this.graphWidget('DEA DynamoDB Table Throttle Count');
    this.tableDashboard.addWidgets(
      this.tableLatencyGraph,
      this.tableThroughputGraph,
      this.tableSystemErrorsGraph,
      this.tableThrottleGraph
    );
  }

  private graphWidget(label: string, maxUnit?: number): GraphWidget {
    return new GraphWidget({
      width: 12,
      leftYAxis: {
        min: 0,
        max: maxUnit,
        label,
        showUnits: true,
      },
    });
  }

  public addMethodOperationalComponents(restApi: RestApi, route: ApiGatewayRoute): void {
    const dimensionsMap = {
      ApiName: restApi.restApiName,
      Method: route.httpMethod,
      Resource: route.path,
      Stage: restApi.deploymentStage.stageName,
    };
    const p99LatencyMetric = new Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      statistic: 'p99',
      label: `${route.eventName}_p99`,
      period: Duration.minutes(ALARM_EVALUATION_PERIOD_MINUTES),
      dimensionsMap,
    });

    const countMetric = new Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      statistic: 'sum',
      color: Color.BLUE,
      label: `${route.eventName}_count`,
      period: Duration.minutes(DASHBOARD_AGGREGATION_PERIOD_MINUTES),
      dimensionsMap,
    });

    const error4xxMetric = new Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4XXError',
      statistic: 'sum',
      color: Color.ORANGE,
      label: `${route.eventName}_4XX`,
      period: Duration.minutes(DASHBOARD_AGGREGATION_PERIOD_MINUTES),
      dimensionsMap,
    });

    const error5xxMetric = new Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XXError',
      statistic: 'sum',
      color: Color.RED,
      label: `${route.eventName}_5XX`,
      period: Duration.minutes(DASHBOARD_AGGREGATION_PERIOD_MINUTES),
      dimensionsMap,
    });

    const latencyThreshold = route.latencyAlarmThreshold ?? DEFAULT_LATENCY_THRESHOLD_MS;
    new Alarm(this, `${route.eventName}-latency-alarm`, {
      metric: p99LatencyMetric,
      alarmDescription: `P99 Latency above ${latencyThreshold}ms`,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      threshold: latencyThreshold,
      evaluationPeriods: ALARM_EVALUATION_PERIODS,
      treatMissingData: TreatMissingData.IGNORE,
    });

    new Alarm(this, `${route.eventName}-error-alarm`, {
      alarmDescription: `Api Errors above ${API_ERROR_RATE_THRESHOLD_PERCENT}%`,
      evaluationPeriods: 1,
      threshold: API_ERROR_RATE_THRESHOLD_PERCENT,
      treatMissingData: TreatMissingData.IGNORE,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      metric: new MathExpression({
        expression: '((errors4xx + errors5xx) / invocations) * 100',
        label: 'Error Rate (%)',
        usingMetrics: {
          invocations: countMetric,
          errors4xx: error4xxMetric,
          errors5xx: error5xxMetric,
        },
      }).with({
        period: Duration.minutes(ALARM_EVALUATION_PERIOD_MINUTES),
      }),
    });

    if (route.path.includes('audit')) {
      this.auditLatencyWidget.addLeftMetric(p99LatencyMetric);
      this.auditErrorRateWidget.addLeftMetric(countMetric);
      this.auditErrorRateWidget.addLeftMetric(error4xxMetric);
      this.auditErrorRateWidget.addLeftMetric(error5xxMetric);
    } else if (route.path.includes('cases')) {
      this.casesLatencyWidget.addLeftMetric(p99LatencyMetric);
      this.casesErrorRateWidget.addLeftMetric(countMetric);
      this.casesErrorRateWidget.addLeftMetric(error4xxMetric);
      this.casesErrorRateWidget.addLeftMetric(error5xxMetric);
    } else if (route.path.includes('auth')) {
      this.authLatencyWidget.addLeftMetric(p99LatencyMetric);
      this.authErrorRateWidget.addLeftMetric(countMetric);
      this.authErrorRateWidget.addLeftMetric(error4xxMetric);
      this.authErrorRateWidget.addLeftMetric(error5xxMetric);
    } else {
      this.miscLatencyWidget.addLeftMetric(p99LatencyMetric);
      this.miscErrorRateWidget.addLeftMetric(countMetric);
      this.miscErrorRateWidget.addLeftMetric(error4xxMetric);
      this.miscErrorRateWidget.addLeftMetric(error5xxMetric);
    }
  }

  public addDynamoTableOperationalComponents(table: Table) {
    this.tableThroughputGraph.addLeftMetric(table.metricConsumedReadCapacityUnits());
    this.tableThroughputGraph.addLeftMetric(table.metricConsumedWriteCapacityUnits());

    for (const Operation in [
      'GetItem',
      'PutItem',
      'DeleteItem',
      'UpdateItem',
      'BatchGetItem',
      'Query',
      'TransactWriteItems',
      'ExecuteTransaction',
    ]) {
      this.tableLatencyGraph.addLeftMetric(
        table.metricSuccessfulRequestLatency({
          label: Operation,
          dimensionsMap: {
            Operation,
          },
        })
      );
    }

    const operations = [
      Operation.GET_ITEM,
      Operation.PUT_ITEM,
      Operation.DELETE_ITEM,
      Operation.UPDATE_ITEM,
      Operation.BATCH_GET_ITEM,
      Operation.QUERY,
      Operation.TRANSACT_WRITE_ITEMS,
      Operation.EXECUTE_TRANSACTION,
    ];

    this.tableSystemErrorsGraph.addLeftMetric(
      table.metricSystemErrorsForOperations({ operations, label: 'System Errors' })
    );
    this.tableSystemErrorsGraph.addLeftMetric(table.metricUserErrors());
    this.tableThrottleGraph.addLeftMetric(
      table.metricThrottledRequestsForOperations({ operations, label: 'Throttled Requests' })
    );

    new Alarm(this, `dea-table-system-errors-alarm`, {
      alarmDescription: `DynamoDB Table System Errors above ${TABLE_SYSTEM_ERROR_THRESHOLD}`,
      evaluationPeriods: 1,
      threshold: API_ERROR_RATE_THRESHOLD_PERCENT,
      treatMissingData: TreatMissingData.IGNORE,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      metric: table.metricSystemErrorsForOperations({
        operations,
        period: Duration.minutes(ALARM_EVALUATION_PERIOD_MINUTES),
      }),
    });

    new Alarm(this, `dea-table-user-errors-alarm`, {
      alarmDescription: `DynamoDB Table User Errors above ${TABLE_SYSTEM_ERROR_THRESHOLD}`,
      evaluationPeriods: 1,
      threshold: API_ERROR_RATE_THRESHOLD_PERCENT,
      treatMissingData: TreatMissingData.IGNORE,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      metric: table.metricUserErrors({
        period: Duration.minutes(ALARM_EVALUATION_PERIOD_MINUTES),
      }),
    });

    new Alarm(this, `dea-table-throttle-alarm`, {
      alarmDescription: `DynamoDB Table Throttle Count above ${TABLE_THROTTLE_THRESHOLD}`,
      evaluationPeriods: 1,
      threshold: TABLE_THROTTLE_THRESHOLD,
      treatMissingData: TreatMissingData.IGNORE,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      metric: table.metricThrottledRequestsForOperations({
        operations,
        period: Duration.minutes(ALARM_EVALUATION_PERIOD_MINUTES),
      }),
    });
  }

  public addLambdaOperationalComponents(
    lambda: NodejsFunction,
    identifier: string,
    route: ApiGatewayRoute | undefined = undefined,
    includeAlarms = false
  ) {
    if (route) {
      if (route.path.includes('audit')) {
        this.addLambdaMetricsToWidget(
          lambda,
          identifier,
          this.auditLambdaErrorWidget,
          this.auditLambdaThrottleWidget
        );
      } else if (route.path.includes('cases')) {
        this.addLambdaMetricsToWidget(
          lambda,
          identifier,
          this.casesLambdaErrorWidget,
          this.casesLambdaThrottleWidget
        );
      } else if (route.path.includes('auth')) {
        this.addLambdaMetricsToWidget(
          lambda,
          identifier,
          this.authLambdaErrorWidget,
          this.authLambdaThrottleWidget
        );
      } else {
        this.addLambdaMetricsToWidget(
          lambda,
          identifier,
          this.miscLambdaErrorWidget,
          this.miscLambdaThrottleWidget
        );
      }
    } else {
      this.addLambdaMetricsToWidget(
        lambda,
        identifier,
        this.miscLambdaErrorWidget,
        this.miscLambdaThrottleWidget
      );
    }

    if (includeAlarms) {
      new Alarm(this, `${identifier}-lambda-error-alarm`, {
        alarmDescription: `Api Errors above ${API_ERROR_RATE_THRESHOLD_PERCENT}%`,
        evaluationPeriods: 1,
        threshold: API_ERROR_RATE_THRESHOLD_PERCENT,
        treatMissingData: TreatMissingData.IGNORE,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        metric: new MathExpression({
          expression: '(errors / invocations) * 100',
          label: 'Error Rate (%)',
          usingMetrics: {
            invocations: lambda.metricInvocations(),
            errors: lambda.metricErrors(),
          },
        }).with({
          period: Duration.minutes(ALARM_EVALUATION_PERIOD_MINUTES),
        }),
      });

      new Alarm(this, `${identifier}-lambda-throttles-alarm`, {
        alarmDescription: `Throttles above threshold of ${LAMBDA_THROTTLE_THRESHOLD}`,
        evaluationPeriods: 1,
        threshold: LAMBDA_THROTTLE_THRESHOLD,
        treatMissingData: TreatMissingData.IGNORE,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        metric: lambda.metricThrottles({
          period: Duration.minutes(ALARM_EVALUATION_PERIOD_MINUTES),
        }),
      });
    }
  }

  private addLambdaMetricsToWidget(
    lambda: NodejsFunction,
    eventName: string,
    errorWidget: GraphWidget,
    throttleWidget: GraphWidget
  ) {
    errorWidget.addLeftMetric(
      lambda.metricInvocations().with({ label: `${eventName}_invocations`, color: Color.BLUE })
    );
    errorWidget.addLeftMetric(lambda.metricErrors().with({ color: Color.RED, label: `${eventName}_errors` }));
    throttleWidget.addLeftMetric(lambda.metricThrottles().with({ label: `${eventName}_throttles` }));
  }

  public addMetricFilterAlarmForLogGroup(
    logGroup: ILogGroup,
    filterPattern: IFilterPattern,
    metricName: string
  ) {
    const metricFilter = new MetricFilter(this, `${metricName}Filter`, {
      logGroup,
      metricNamespace: 'DEALogErrors',
      metricName,
      filterPattern,
      metricValue: '1',
    });

    new Alarm(this, `${metricName}Alarm`, {
      alarmDescription: `Alarm for ${metricName}`,
      evaluationPeriods: 1,
      threshold: 0,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      metric: metricFilter.metric({
        period: Duration.days(1),
        statistic: 'sum',
      }),
    });
  }

  public addAuditLambdaErrorAlarm(lambda: NodejsFunction, identifier: string) {
    new Alarm(this, `${identifier}FailuresAlarm`, {
      alarmDescription: `${identifier} Failures encountered`,
      evaluationPeriods: 1,
      threshold: 0,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      metric: lambda.metricErrors({
        period: Duration.days(1),
      }),
    });
  }

  public addDeadLetterQueueOperationalComponents(identifier: string, queue: Queue) {
    new Alarm(this, `${identifier}Alarm`, {
      alarmDescription: `Number of messages visible above ${DEADLETTERQUEUE_MESSAGE_THRESHOLD}`,
      evaluationPeriods: DEADLETTERQUEUE_ALARM_EVALUATION_PERIODS,
      threshold: DEADLETTERQUEUE_MESSAGE_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      metric: queue.metricApproximateNumberOfMessagesVisible(),
    });
  }
}
