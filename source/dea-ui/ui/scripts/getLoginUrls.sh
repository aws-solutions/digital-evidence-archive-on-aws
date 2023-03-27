echo local:
echo https://${DOMAIN_PREFIX}.auth.${AWS_REGION:-us-east-1}.amazoncognito.com/login?client_id=${USER_POOL_CLIENT_ID}\&response_type=code\&scope=aws.cognito.signin.user.admin+email+openid+phone+profile\&redirect_uri=http%3A%2F%2Flocalhost:3000%2F${STAGE:-chewbacca}%2Fui%2Flogin
echo deployed: 
echo https://${DOMAIN_PREFIX}.auth.${AWS_REGION:-us-east-1}.amazoncognito.com/login?client_id=${USER_POOL_CLIENT_ID}\&response_type=code\&scope=aws.cognito.signin.user.admin+email+openid+phone+profile\&redirect_uri=${DEA_API_URL}${STAGE:-chewbacca}%2Fui%2Flogin