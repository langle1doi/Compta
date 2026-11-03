// Imported first by platform-storage-down.e2e-spec.ts: nothing listens on this port, so every storage call really fails.
process.env.S3_ENDPOINT = 'http://localhost:1';
process.env.S3_PUBLIC_ENDPOINT = 'http://localhost:1';
