# https://nextjs.org/docs/basic-features/environment-variables
echo NEXT_PUBLIC_DEA_API_URL=$DEA_API_URL > .env.local
echo NEXT_PUBLIC_STAGE=${STAGE:-devsample} >> .env.local
echo NEXT_PUBLIC_IS_USING_CUSTOM_DOMAIN=${DEA_CUSTOM_DOMAIN} >> .env.local
echo NEXT_PUBLIC_AWS_REGION=${AWS_REGION} >> .env.local
echo NEXT_PUBLIC_FIPS_SUPPORTED=${FIPS_SUPPORTED:-false} >> .env.local
