#!/usr/bin/env node
/**
 * Direct service generator bypassing plop's interactive mode
 *
 * Usage:
 *   node scripts/gen-service.mjs <ServiceName> <serviceType> [operation1] [operation2] ...
 *
 * Examples:
 *   node scripts/gen-service.mjs Order crud validate create notify
 *   node scripts/gen-service.mjs Scoring calculation validate calculate format
 *
 * Service Types:
 *   - crud: Entity management (users, orders, products)
 *   - calculation: Compute operations (scoring, analysis, transformation)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Helper functions
const pascalCase = (text) => {
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
};

const camelCase = (text) => {
  return text.charAt(0).toLowerCase() + text.slice(1).replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
};

const kebabCase = (text) => {
  return text.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
};

/**
 * Read and process a Handlebars template
 */
async function processTemplate(templatePath, data) {
  let content = await fs.readFile(templatePath, 'utf-8');

  // Replace Handlebars expressions
  content = content
    .replace(/\{\{pascalCase name\}\}/g, pascalCase(data.name))
    .replace(/\{\{camelCase name\}\}/g, camelCase(data.name))
    .replace(/\{\{kebabCase name\}\}/g, kebabCase(data.name));

  if (data.operation) {
    content = content
      .replace(/\{\{pascalCase operation\}\}/g, pascalCase(data.operation))
      .replace(/\{\{camelCase operation\}\}/g, camelCase(data.operation))
      .replace(/\{\{kebabCase operation\}\}/g, kebabCase(data.operation));
  }

  // Handle {{#each operations}} blocks
  if (data.operations) {
    const eachRegex = /\{\{#each operations\}\}([\s\S]*?)\{\{\/each\}\}/g;
    content = content.replace(eachRegex, (match, template) => {
      return data.operations.map(op => {
        return template
          .replace(/\{\{this\}\}/g, op)
          .replace(/\{\{camelCase this\}\}/g, camelCase(op))
          .replace(/\{\{kebabCase this\}\}/g, kebabCase(op))
          .replace(/\{\{pascalCase this\}\}/g, pascalCase(op));
      }).join('');
    });
  }

  return content;
}

async function generateService(name, serviceType, operations) {
  const servicePath = path.join(projectRoot, 'src/services', kebabCase(name));
  const templatesPath = path.join(projectRoot, 'plop-templates/service');

  console.log(`\n🚀 Generating ${serviceType} service: ${name}\n`);

  // Create service directory structure
  await fs.mkdir(servicePath, { recursive: true });
  await fs.mkdir(path.join(servicePath, 'types'), { recursive: true });
  await fs.mkdir(path.join(servicePath, 'operations'), { recursive: true });
  await fs.mkdir(path.join(servicePath, '__tests__/operations'), { recursive: true });

  // Determine which templates to use based on service type
  const typeSuffix = serviceType === 'calculation' ? '-calculation' : '-crud';

  // 1. Generate types
  const typesContent = await processTemplate(
    path.join(templatesPath, `types${typeSuffix}.hbs`),
    { name }
  );
  await fs.writeFile(path.join(servicePath, 'types/index.ts'), typesContent);
  console.log(`  ✅ Created types/index.ts`);

  // 2. Generate operations
  for (const operation of operations) {
    const opContent = await processTemplate(
      path.join(templatesPath, `operation${typeSuffix}.hbs`),
      { name, operation }
    );
    await fs.writeFile(
      path.join(servicePath, 'operations', `${kebabCase(operation)}.ts`),
      opContent
    );
    console.log(`  ✅ Created operations/${kebabCase(operation)}.ts`);
  }

  // 3. Generate operations index
  const opsIndexContent = await processTemplate(
    path.join(templatesPath, 'operations-index.hbs'),
    { name, operations }
  );
  await fs.writeFile(path.join(servicePath, 'operations/index.ts'), opsIndexContent);
  console.log(`  ✅ Created operations/index.ts`);

  // 4. Generate orchestrator
  const orchestratorContent = await processTemplate(
    path.join(templatesPath, `orchestrator${typeSuffix}.hbs`),
    { name, operations }
  );
  await fs.writeFile(path.join(servicePath, 'orchestrator.ts'), orchestratorContent);
  console.log(`  ✅ Created orchestrator.ts`);

  // 5. Generate facade
  const facadeContent = await processTemplate(
    path.join(templatesPath, `facade${typeSuffix}.hbs`),
    { name }
  );
  await fs.writeFile(path.join(servicePath, 'index.ts'), facadeContent);
  console.log(`  ✅ Created index.ts (facade)`);

  console.log(`\n✨ ${pascalCase(name)} service generated successfully!`);
  console.log(`\n📁 Location: src/services/${kebabCase(name)}/`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Implement business logic in operations/`);
  console.log(`   2. Add route if needed: npm run generate:route`);
  console.log(`   3. Run tests: npm test\n`);
}

// Parse command line arguments
const [,, serviceName, serviceType, ...operationArgs] = process.argv;

if (!serviceName || !serviceType) {
  console.log(`
Usage: node scripts/gen-service.mjs <ServiceName> <serviceType> [operations...]

Arguments:
  ServiceName   PascalCase name (e.g., Order, UserProfile, RiskScore)
  serviceType   Either 'crud' or 'calculation'
  operations    Space-separated operation names (optional)

Examples:
  node scripts/gen-service.mjs Order crud validate create notify
  node scripts/gen-service.mjs Scoring calculation validate calculate format
  node scripts/gen-service.mjs User crud  # Uses default operations
`);
  process.exit(1);
}

// Validate service type
if (!['crud', 'calculation'].includes(serviceType)) {
  console.error(`❌ Invalid service type: ${serviceType}`);
  console.error(`   Must be 'crud' or 'calculation'`);
  process.exit(1);
}

// Use default operations if none provided
const defaultOps = serviceType === 'calculation'
  ? ['validate', 'calculate', 'format']
  : ['validate', 'create', 'notify'];
const operations = operationArgs.length > 0 ? operationArgs : defaultOps;

generateService(serviceName, serviceType, operations)
  .catch(err => {
    console.error('❌ Error generating service:', err);
    process.exit(1);
  });
