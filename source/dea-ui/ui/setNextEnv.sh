# https://nextjs.org/docs/basic-features/environment-variables
echo NEXT_PUBLIC_DEA_API_URL=$DEA_API_URL > .env.local
echo NEXT_PUBLIC_STAGE=${STAGE:-chewbacca} >> .env.local
