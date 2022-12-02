/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import { RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { AttributeType, BillingMode, ProjectionType, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import {
  CfnSecurityGroup,
  FlowLog,
  FlowLogDestination,
  FlowLogResourceType,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { getConstants } from '../constants';

interface IBackendStackProps extends StackProps {
  kmsKey: Key;
}

export class DeaBackendConstruct extends Construct {
  public deaTable: Table;
  public deaVpc: Vpc;

  public constructor(scope: Construct, id: string, props: IBackendStackProps) {
    const { STACK_NAME } = getConstants();

    super(scope, STACK_NAME);

    //take a optional VPC from config, if not provided create one
    this.deaVpc = this._createVpc(props.kmsKey);

    //Dynamo
    this.deaTable = this._createDeaTable(props.kmsKey);
  }

  private _createDeaTable(key: Key): Table {
    const deaTable = new Table(this, 'DeaTable', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      // removalPolicy: RemovalPolicy.RETAIN,
      removalPolicy: RemovalPolicy.DESTROY,
      sortKey: { name: 'SK', type: AttributeType.STRING },
      encryption: TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: key,
      pointInTimeRecovery: true,
    });

    deaTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      projectionType: ProjectionType.ALL,
      partitionKey: { name: 'GSI1PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: AttributeType.STRING },
    });

    deaTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      projectionType: ProjectionType.ALL,
      partitionKey: { name: 'GSI2PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: AttributeType.STRING },
    });

    return deaTable;
  }

  private _createVpc(key: Key): Vpc {
    const vpc = new Vpc(this, 'dea-vpc', {
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Ingress',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    new CfnSecurityGroup(this, 'vpc-sg', {
      groupDescription: 'dea-vpc security group',
      securityGroupEgress: [
        {
          ipProtocol: 'tcp',

          // the properties below are optional
          cidrIp: '0.0.0.0/32',
          fromPort: 1,
          toPort: 1,
          description: 'egress rule for dea vpc',
        },
      ],
      vpcId: vpc.vpcId,
    });

    const logGroup = new LogGroup(this, 'dea-vpc-log-group', {
      encryptionKey: key,
    });

    const role = new Role(this, 'flow-log-role', {
      assumedBy: new ServicePrincipal('vpc-flow-logs.amazonaws.com'),
    });

    new FlowLog(this, 'FlowLog', {
      resourceType: FlowLogResourceType.fromVpc(vpc),
      destination: FlowLogDestination.toCloudWatchLogs(logGroup, role),
    });

    return vpc;
  }
}
