// Applies the @nestjs/swagger CLI plugin (as `nest build` does) when ts-jest compiles the e2e tests,
// so DTO schemas exist in the OpenAPI document under test. Same options as nest-cli.json.
const transformer = require('@nestjs/swagger/plugin');

module.exports.name = 'nestjs-swagger-transformer';
module.exports.version = 1;
module.exports.factory = (cs) => transformer.before(require('../../nest-cli.json').compilerOptions.plugins[0].options, cs.program);
