# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2024-03-21

### Added

- integration with DataSync for ingestion of large volumes of data
- the ability to use AWS Directory Service's Managed Microsoft Active Directory as an identity store in AWS Identity Center
- ability to track an auditing reason when case evidence is requested for download

### Upgrade Notes
- This version refactors our cdk stack into several nested stacks. If you are trying to upgrade from a previous version and use a custom domain you may run into issues during the deployment saying the domain already exists. As a workaround, deploy without the custom domain, then re-deploy with the custom domain.

## [1.0.7] - 2024-01-15

### Fixed

- when using identityStoreId, identityStoreRegion and identityStoreAccountId are also required
- split refresh_token to a new cookie

## [1.0.6] - 2023-12-15

### Added

- the ability to integrate with AWS Identity Center
- the ability to allow non Route 53 customer domains

### Fixed

- UI Upload issue for large files
- bump axios and crypto-js packages

## [1.0.5] - 2023-10-10

### Added

- Utilize Athena for Audit Queries

## [1.0.4] - 2023-08-15

### Added

- configuration to opt out of DynamoDB Dataplane events in CloudTrail

### Fixed

- bump semver and minimist packages
- improve custom domain support
- gov region one-click fix

## [1.0.3] - 2023-07-24

### Fixed

- oneclick generation fix

## [1.0.2] - 2023-07-21

### Fixed

- various UI/UX improvements
- cdk deployment for us-gov-east-1
- cloud formation template for us-gov-west-1

## [1.0.1] - 2023-06-30

### Fixed

- enhance authorization security
- various UI content improvements
- use single region trails for one-click deployments
- improvements to test reliability
- handle region correctly for custom domain deployments
- support disabling fips endpoints via config

## [1.0.0] - 2023-06-16

### Added

- DEA Initial release

## [0.0.1] - 2022-09-06

### Added

- Repo init
