export default {
  '*.ts': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': 'prettier --write',
  // Multi-file schemas: a model file cannot be validated alone, so format the whole schema folder
  'prisma/control/**/*.prisma': () => 'prisma format --config prisma.control.config.ts',
  'prisma/tenant/**/*.prisma': () => 'prisma format --config prisma.tenant.config.ts',
};
