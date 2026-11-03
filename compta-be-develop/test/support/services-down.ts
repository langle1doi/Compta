// Imported first by infra-down.e2e-spec.ts: nothing listens on these ports.
process.env.RABBITMQ_URL = 'amqp://compte:secret-broker-password@localhost:1';
process.env.S3_ENDPOINT = 'http://localhost:1';
