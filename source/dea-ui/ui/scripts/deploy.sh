##This script can only be run by using the command `STAGE=<STAGE> rushx deploy-ui-and-api` from `/swb-ui` directory, running this script directly from this directory will not work correctly as it uses relative paths.
apiURL='' ##Get value from swb-reference/src/config/{STAGE}.json and replace all '"' and ',' with empty.

    (rushx build && NEXT_PUBLIC_API_BASE_URL=$apiURL rushx export) && 
    (
        cd ../infrastructure 
        rushx cdk bootstrap && rushx cdk-deploy
    )