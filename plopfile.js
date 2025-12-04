/**
 * Plop Generator for Golden Orchestrator Services
 *
 * Supports two service types:
 * - crud: Services that manage entities (users, orders, products)
 * - calculation: Services that compute results (scoring, analysis, transformation)
 *
 * Usage:
 *   npm run generate              - Interactive generator
 *   npm run generate:service      - Generate service directly
 *   npm run generate:operation    - Add operation to existing service
 *   npm run generate:route        - Generate standalone route
 *
 * CLI Generator (non-interactive):
 *   node scripts/gen-service.mjs <ServiceName> <crud|calculation> [operations...]
 *
 * Documentation:
 *   See docs/GETTING_STARTED.md for setup and usage
 *   See docs/ARCHITECTURE.md for pattern details
 */

// @ts-nocheck
export default function (plop) {
  // Helper to convert to PascalCase
  plop.setHelper('pascalCase', (text) => {
    return text.charAt(0).toUpperCase() + text.slice(1).replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
  });

  // Helper to convert to camelCase
  plop.setHelper('camelCase', (text) => {
    return text.charAt(0).toLowerCase() + text.slice(1).replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
  });

  // Helper to convert to kebab-case
  plop.setHelper('kebabCase', (text) => {
    return text.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  });

  // Service Generator
  plop.setGenerator('service', {
    description: 'Generate a new service with Golden Orchestrator pattern',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Service name (e.g., Order, User, Payment):',
        validate: (value) => {
          if (!value) return 'Service name is required';
          if (!/^[A-Z][a-zA-Z]*$/.test(value)) {
            return 'Service name must be PascalCase (e.g., OrderService, not order-service)';
          }
          return true;
        },
      },
      {
        type: 'list',
        name: 'serviceType',
        message: 'Service type:',
        choices: [
          { name: 'CRUD (entity management: users, orders, products)', value: 'crud' },
          { name: 'Calculation (compute: scoring, analysis, transformation)', value: 'calculation' }
        ],
        default: 'crud'
      },
      {
        type: 'input',
        name: 'operations',
        message: 'Operation names (comma-separated):',
        default: (answers) => {
          return answers.serviceType === 'calculation'
            ? 'validate,calculate,format'
            : 'validate,create,notify';
        }
      },
      {
        type: 'confirm',
        name: 'includePrisma',
        message: 'Include Prisma model?',
        default: (answers) => answers.serviceType === 'crud',
      },
      {
        type: 'confirm',
        name: 'includeRoute',
        message: 'Include API route?',
        default: (answers) => answers.serviceType === 'crud',
      },
      {
        type: 'confirm',
        name: 'includeTests',
        message: 'Include tests?',
        default: true,
      },
    ],
    actions: (data) => {
      const actions = [];
      const serviceName = data.name;
      const servicePath = `src/services/{{kebabCase name}}`;
      const routePath = `src/routes/{{kebabCase name}}`;
      const operations = data.operations.split(',').map((op) => op.trim());
      const isCalculation = data.serviceType === 'calculation';

      // 1. Create types (different template per service type)
      actions.push({
        type: 'add',
        path: `${servicePath}/types/index.ts`,
        templateFile: isCalculation
          ? 'plop-templates/service/types-calculation.hbs'
          : 'plop-templates/service/types-crud.hbs',
      });

      // 2. Create operations (different template per service type)
      operations.forEach((operation) => {
        actions.push({
          type: 'add',
          path: `${servicePath}/operations/{{kebabCase operation}}.ts`,
          templateFile: isCalculation
            ? 'plop-templates/service/operation-calculation.hbs'
            : 'plop-templates/service/operation-crud.hbs',
          data: { operation, isCalculation, name: data.name },
        });
      });

      // 3. Create operations index (barrel export)
      actions.push({
        type: 'add',
        path: `${servicePath}/operations/index.ts`,
        templateFile: 'plop-templates/service/operations-index.hbs',
        data: { operations },
      });

      // 4. Create orchestrator (different template per service type)
      actions.push({
        type: 'add',
        path: `${servicePath}/orchestrator.ts`,
        templateFile: isCalculation
          ? 'plop-templates/service/orchestrator-calculation.hbs'
          : 'plop-templates/service/orchestrator-crud.hbs',
        data: { operations },
      });

      // 5. Create service facade (different template per service type)
      actions.push({
        type: 'add',
        path: `${servicePath}/index.ts`,
        templateFile: isCalculation
          ? 'plop-templates/service/facade-calculation.hbs'
          : 'plop-templates/service/facade-crud.hbs',
      });

      // 6. Create route (if requested)
      if (data.includeRoute) {
        actions.push({
          type: 'add',
          path: `${routePath}/index.ts`,
          templateFile: 'plop-templates/service/route.hbs',
        });

        // Auto-register route in app.ts
        const kebabName = serviceName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        const camelName = serviceName.charAt(0).toLowerCase() + serviceName.slice(1);

        actions.push({
          type: 'modify',
          path: 'src/app.ts',
          pattern: /(import todoRoutes from '.\/routes\/todos\/index';)/g,
          template: `$1\nimport ${camelName}Routes from './routes/${kebabName}/index';`,
        });

        actions.push({
          type: 'modify',
          path: 'src/app.ts',
          pattern: /(\/\/ Todo routes \(demonstrates Golden Orchestrator pattern\)\s+await fastify\.register\(todoRoutes, { prefix: '\/todos' }\);)/g,
          template: `$1\n\n      // ${serviceName} routes\n      await fastify.register(${camelName}Routes, { prefix: '/${kebabName}' });`,
        });
      }

      // 7. Create tests (if requested)
      if (data.includeTests) {
        operations.forEach((operation) => {
          actions.push({
            type: 'add',
            path: `${servicePath}/__tests__/operations/{{kebabCase operation}}.test.ts`,
            templateFile: 'plop-templates/service/test-operation.hbs',
            data: { operation, isCalculation, name: data.name },
          });
        });

        actions.push({
          type: 'add',
          path: `${servicePath}/__tests__/orchestrator.test.ts`,
          templateFile: 'plop-templates/service/test-orchestrator.hbs',
          data: { isCalculation },
        });

        actions.push({
          type: 'add',
          path: `${servicePath}/__tests__/integration.test.ts`,
          templateFile: 'plop-templates/service/test-integration.hbs',
          data: { isCalculation },
        });
      }

      // 8. Create Prisma model (if requested)
      if (data.includePrisma) {
        actions.push({
          type: 'append',
          path: 'prisma/schema.prisma',
          pattern: /(\/\/ Add models below)/gi,
          template: '\n// {{pascalCase name}} model\nmodel {{pascalCase name}} {\n  id        String   @id @default(cuid())\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@map("{{kebabCase name}}")\n}\n',
        });
      }

      // 9. Success message
      actions.push(() => {
        const kebabName = serviceName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        const serviceTypeLabel = isCalculation ? 'Calculation' : 'CRUD';

        console.log(`\n✨ ${serviceTypeLabel} Service created successfully!\n`);
        console.log(`📁 Service: src/services/${kebabName}/`);
        if (data.includeRoute) {
          console.log(`🛣️  Route: src/routes/${kebabName}/`);
          console.log(`✅ Auto-registered in src/app.ts`);
        }
        if (data.includeTests) {
          console.log(`🧪 Tests: src/services/${kebabName}/__tests__/`);
        }

        console.log('\n📝 Next steps:\n');
        console.log('1️⃣  Implement business logic in operations/\n');

        if (data.includePrisma) {
          console.log('2️⃣  Run database migration:');
          console.log(`   \x1b[36mnpm run db:migrate\x1b[0m\n`);
        }

        console.log('3️⃣  Restart dev server (or it auto-restarts)\n');

        console.log('4️⃣  View in Swagger:');
        console.log(`   \x1b[36mhttp://localhost:3000/documentation\x1b[0m`);
        console.log(`   \x1b[90m(Tags auto-detected - no manual config needed!)\x1b[0m\n`);

        return 'Generator completed!';
      });

      return actions;
    },
  });

  // Operation Generator (add operation to existing service)
  plop.setGenerator('operation', {
    description: 'Add an operation to an existing service',
    prompts: [
      {
        type: 'input',
        name: 'service',
        message: 'Service name (PascalCase):',
        validate: (value) => {
          if (!value) return 'Service name is required';
          return true;
        },
      },
      {
        type: 'input',
        name: 'operation',
        message: 'Operation name (camelCase):',
        validate: (value) => {
          if (!value) return 'Operation name is required';
          return true;
        },
      },
      {
        type: 'list',
        name: 'serviceType',
        message: 'Service type:',
        choices: [
          { name: 'CRUD', value: 'crud' },
          { name: 'Calculation', value: 'calculation' }
        ],
        default: 'crud'
      },
    ],
    actions: (data) => {
      const isCalculation = data.serviceType === 'calculation';
      const actions = [
        // Create operation file
        {
          type: 'add',
          path: 'src/services/{{kebabCase service}}/operations/{{kebabCase operation}}.ts',
          templateFile: isCalculation
            ? 'plop-templates/service/operation-calculation.hbs'
            : 'plop-templates/service/operation-crud.hbs',
          data: { name: data.service, operation: data.operation },
        },
        // Create test file
        {
          type: 'add',
          path: 'src/services/{{kebabCase service}}/__tests__/operations/{{kebabCase operation}}.test.ts',
          templateFile: 'plop-templates/service/test-operation.hbs',
          data: { name: data.service, operation: data.operation },
        },
        // Append to operations index
        {
          type: 'append',
          path: 'src/services/{{kebabCase service}}/operations/index.ts',
          template: "export { {{camelCase operation}} } from './{{kebabCase operation}}.js';",
        },
        // Add to orchestrator pipeline
        {
          type: 'modify',
          path: 'src/services/{{kebabCase service}}/orchestrator.ts',
          pattern: /(protected getPipeline\(\)[^{]*\{\s*return \[)/,
          template: `$1
      {
        name: '{{kebabCase operation}}',
        operation: ops.{{camelCase operation}},
        critical: true,
        timeout: 2000,
      },`,
        },
        // Success message
        () => {
          const kebabService = data.service.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          const kebabOp = data.operation.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

          console.log('\n✨ Operation added successfully!\n');
          console.log(`📁 Operation: src/services/${kebabService}/operations/${kebabOp}.ts`);
          console.log(`🧪 Test: src/services/${kebabService}/__tests__/operations/${kebabOp}.test.ts`);
          console.log(`✅ Auto-added to orchestrator pipeline`);
          console.log(`✅ Auto-exported from operations/index.ts\n`);

          return 'Generator completed!';
        },
      ];
      return actions;
    },
  });

  // Route Generator (standalone)
  plop.setGenerator('route', {
    description: 'Generate a standalone route (without orchestrator)',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Route name:',
      },
      {
        type: 'confirm',
        name: 'requireAuth',
        message: 'Require authentication?',
        default: true,
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'src/routes/{{kebabCase name}}/index.ts',
        templateFile: 'plop-templates/route/index.hbs',
      },
    ],
  });
}
