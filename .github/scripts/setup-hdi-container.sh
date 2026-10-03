cf create-service hana hdi-shared $CONTAINER_NAME --wait
cf create-service-key $CONTAINER_NAME $CONTAINER_NAME-key --wait
