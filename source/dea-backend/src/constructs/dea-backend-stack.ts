/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import { CfnResource, RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { AttributeType, BillingMode, ProjectionType, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

interface IBackendStackProps extends StackProps {
  kmsKey: Key;
}

export class DeaBackendConstruct extends Construct {
  public deaTable: Table;

  public constructor(scope: Construct, id: string, props: IBackendStackProps) {
    super(scope, id);

    //Dynamo
    this.deaTable = this._createDeaTable(props.kmsKey);
  }

  private _createDeaTable(key: Key): Table {
    const deaTable = new Table(this, 'DeaTable', {
      tableName: 'DeaTable',
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      //should probably be RETAIN later
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

    const tableNode = deaTable.node.defaultChild;
    if (tableNode instanceof CfnResource) {
      tableNode.addMetadata('cfn_nag', {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        rules_to_suppress: [
          {
            id: 'W28',
            reason: 'Table requires an explicit name to be referenced by Onetable',
          }
        ],
      });
    }

    return deaTable;
  }
}
