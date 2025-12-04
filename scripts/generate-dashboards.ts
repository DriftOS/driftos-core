#!/usr/bin/env tsx
/**
 * Auto-Generate Grafana Dashboards from Orchestrators
 * 
 * Scans codebase for BaseOrchestrator implementations and automatically
 * generates Grafana dashboards with perfect 1:1 operation mapping.
 * 
 * Usage: npm run generate:dashboards
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import globCallback from 'glob';

// Simple promisified glob
function glob(pattern: string, options?: any): Promise<string[]> {
  return new Promise((resolve, reject) => {
    globCallback(pattern, options || {}, (err: Error | null, files: string[]) => {
      if (err) reject(err);
      else resolve(files);
    });
  });
}

interface Operation {
  name: string;
  displayName: string;
}

interface OrchestratorMetadata {
  serviceName: string;
  displayName: string;
  fileName: string;
  operations: Operation[];
  uid: string;
}

/**
 * Discover all orchestrators in the codebase
 */
async function discoverOrchestrators(): Promise<OrchestratorMetadata[]> {
  const orchestrators: OrchestratorMetadata[] = [];
  
  // Find all orchestrator files
  const files = await glob('src/services/**/*orchestrator.ts', {
    ignore: ['**/*.test.ts', '**/node_modules/**'],
  });
  
  console.log(`📁 Found ${files.length} orchestrator files\n`);
  
  for (const file of files) {
    try {
      const metadata = await extractOrchestratorMetadata(file);
      if (metadata) {
        orchestrators.push(metadata);
        console.log(`✅ ${metadata.serviceName} (${metadata.operations.length} operations)`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to parse ${file}:`, (error as Error).message);
    }
  }
  
  return orchestrators;
}

/**
 * Extract metadata from orchestrator file
 */
async function extractOrchestratorMetadata(filePath: string): Promise<OrchestratorMetadata | null> {
  const content = await fs.readFile(filePath, 'utf-8');
  
  // Check if it extends BaseOrchestrator
  if (!content.includes('extends BaseOrchestrator')) {
    return null;
  }
  
  // Extract class name
  const classNameMatch = content.match(/class (\w+)/);
  if (!classNameMatch) return null;
  
  const className = classNameMatch[1];
  const serviceName = className; // Use FULL class name for metrics matching
  const displayName = className.replace(/Orchestrator$/, ''); // Strip "Orchestrator" suffix only
  
  // Extract operations from getPipeline()
  const operations = extractOperations(content);
  
  if (operations.length === 0) return null;
  
  // Generate UID
  const uid = displayName.toLowerCase().replace(/\s+/g, '-') + '-performance';
  
  return {
    serviceName, // Full name: "CreateTodoOrchestrator"
    displayName: `${displayName} Performance`, // Display: "CreateTodo Performance"
    fileName: path.basename(filePath),
    operations,
    uid,
  };
}

/**
 * Extract operations from getPipeline() method
 */
function extractOperations(content: string): Operation[] {
  const operations: Operation[] = [];
  
  // Find getPipeline() method
  const pipelineMatch = content.match(/getPipeline\(\)[\s\S]*?return\s*\[([\s\S]*?)\];/);
  if (!pipelineMatch) return operations;
  
  const pipelineContent = pipelineMatch[1];
  
  // Extract each stage definition (name: 'xxx')
  const stageRegex = /name:\s*['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = stageRegex.exec(pipelineContent)) !== null) {
    const name = match[1];
    
    // Convert kebab-case to Display Name
    const displayName = name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    operations.push({
      name,
      displayName,
    });
  }
  
  return operations;
}

/**
 * Generate Grafana dashboard JSON (DriftOS Style)
 */
function generateDashboard(metadata: OrchestratorMetadata) {
  // Generate targets for timeseries chart
  // Keep original order (1, 2, 3) so stacking goes bottom to top
  const barTargets = metadata.operations.map((op, i) => ({
    expr: `avg(rate(orchestrator_stage_latency_ms_sum{service="${metadata.serviceName}",stage="${op.name}"}[$__rate_interval]) / rate(orchestrator_stage_latency_ms_count{service="${metadata.serviceName}",stage="${op.name}"}[$__rate_interval]))`,
    legendFormat: `${i + 1}. ${op.displayName}`,
    refId: String.fromCharCode(65 + i),
  }));
  
  return {
    uid: metadata.uid,
    title: metadata.displayName,
    tags: ['performance', 'orchestrator', metadata.serviceName.toLowerCase()],
    timezone: 'browser',
    schemaVersion: 38,
    refresh: '30s', // Auto-refresh every 30 seconds
    time: {
      from: 'now-5m', // Default: Last 5 minutes
      to: 'now',
    },
    editable: true,
    graphTooltip: 1,
    
    panels: [
      // Row Header
      {
        id: 1,
        title: `🎯 Pipeline Overview`,
        type: 'row',
        gridPos: { h: 1, w: 24, x: 0, y: 0 },
        collapsed: false,
      },
      
      // 1. Avg Response Time
      {
        datasource: 'Prometheus',
        gridPos: { h: 4, w: 6, x: 0, y: 1 },
        id: 2,
        targets: [
          {
            expr: `avg(rate(orchestrator_pipeline_duration_ms_sum{service="${metadata.serviceName}"}[$__rate_interval]) / rate(orchestrator_pipeline_duration_ms_count{service="${metadata.serviceName}"}[$__rate_interval]))`,
            legendFormat: 'Avg',
            refId: 'A',
          },
        ],
        title: 'Avg Response Time',
        type: 'stat',
        fieldConfig: {
          defaults: {
            unit: 'ms',
            decimals: 1,
            thresholds: {
              mode: 'absolute',
              steps: [
                { value: 0, color: 'green' },
                { value: 100, color: 'yellow' },
                { value: 500, color: 'red' },
              ],
            },
          },
        },
        options: {
          colorMode: 'background',
          graphMode: 'area',
          orientation: 'horizontal',
          textMode: 'value_and_name',
        },
      },
      
      // 2. Success Rate
      {
        datasource: 'Prometheus',
        gridPos: { h: 4, w: 6, x: 6, y: 1 },
        id: 3,
        targets: [
          {
            expr: `sum(rate(orchestrator_pipeline_duration_ms_count{service="${metadata.serviceName}",status="success"}[$__rate_interval])) / sum(rate(orchestrator_pipeline_duration_ms_count{service="${metadata.serviceName}"}[$__rate_interval])) * 100`,
            legendFormat: 'Success',
            refId: 'A',
          },
        ],
        title: 'Success Rate',
        type: 'stat',
        fieldConfig: {
          defaults: {
            unit: 'percent',
            decimals: 1,
            min: 0,
            max: 100,
            thresholds: {
              mode: 'absolute',
              steps: [
                { value: 0, color: 'red' },
                { value: 95, color: 'yellow' },
                { value: 99, color: 'green' },
              ],
            },
          },
        },
        options: {
          colorMode: 'value',
          graphMode: 'none',
          orientation: 'horizontal',
          textMode: 'value_and_name',
        },
      },
      
      // 3. P95 Latency
      {
        datasource: 'Prometheus',
        gridPos: { h: 4, w: 6, x: 12, y: 1 },
        id: 4,
        targets: [
          {
            expr: `histogram_quantile(0.95, sum(rate(orchestrator_pipeline_duration_ms_bucket{service="${metadata.serviceName}"}[$__rate_interval])) by (le))`,
            legendFormat: 'P95',
            refId: 'A',
          },
        ],
        title: 'P95 Latency',
        type: 'stat',
        fieldConfig: {
          defaults: {
            unit: 'ms',
            decimals: 1,
            thresholds: {
              mode: 'absolute',
              steps: [
                { value: 0, color: 'green' },
                { value: 300, color: 'yellow' },
                { value: 1500, color: 'red' },
              ],
            },
          },
        },
        options: {
          colorMode: 'value',
          graphMode: 'none',
          orientation: 'horizontal',
          textMode: 'value_and_name',
        },
      },
      
      // 4. Operations/min (time series for sparkline graph)
      {
        datasource: 'Prometheus',
        gridPos: { h: 4, w: 6, x: 18, y: 1 },
        id: 5,
        targets: [
          {
            expr: `(sum(rate(orchestrator_pipeline_duration_ms_count{service="${metadata.serviceName}"}[$__rate_interval])) or vector(0)) * 60`,
            legendFormat: 'ops/min',
            refId: 'A',
          },
        ],
        title: 'Avg Operations/min',
        type: 'stat',
        fieldConfig: {
          defaults: {
            unit: 'rpm',
            decimals: 1,
            thresholds: {
              mode: 'absolute',
              steps: [
                { value: 0, color: 'green' },
              ],
            },
          },
        },
        options: {
          colorMode: 'value',
          graphMode: 'area',
          orientation: 'horizontal',
          textMode: 'value_and_name',
          reduceOptions: {
            values: false,
            calcs: ['mean'], // Mean is more reliable for rate queries
          },
        },
      },
      
      // Operation Breakdown Row
      {
        id: 6,
        title: '⚙️ Operation Breakdown',
        type: 'row',
        gridPos: { h: 1, w: 24, x: 0, y: 5 },
        collapsed: false,
      },
      
      // Stacked Timeseries (full width - shows ALL operations in tooltip!)
      {
        datasource: 'Prometheus',
        title: `${metadata.displayName.replace(' Performance', '')} Operations`,
        type: 'timeseries',
        gridPos: { h: 10, w: 24, x: 0, y: 6 },
        id: 7,
        targets: barTargets,
        fieldConfig: {
          defaults: {
            unit: 'ms',
            decimals: 2,
            custom: {
              lineWidth: 1,
              fillOpacity: 70,
              gradientMode: 'opacity',
              axisPlacement: 'auto',
              axisLabel: '',
              scaleDistribution: {
                type: 'linear',
              },
              stacking: {
                mode: 'normal',
                group: 'A',
              },
              drawStyle: 'line',
              lineInterpolation: 'smooth',
              showPoints: 'never',
              spanNulls: false,
            },
          },
        },
        options: {
          legend: {
            calcs: ['mean', 'max'],
            displayMode: 'table',
            placement: 'right',
            showLegend: true,
          },
          tooltip: {
            mode: 'multi',
            sort: 'none', // Keep original order (1, 2, 3 from targets)
          },
        },
      },
    ],
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🎨 Grafana Dashboard Generator\n');
  console.log('Scanning for orchestrators...\n');
  
  const orchestrators = await discoverOrchestrators();
  
  if (orchestrators.length === 0) {
    console.log('\n❌ No orchestrators found!');
    console.log('   Create a service with: npm run generate\n');
    return;
  }
  
  console.log(`\n📊 Generating ${orchestrators.length} dashboard(s)...\n`);
  
  // Ensure output directory exists (inside provisioning folder, DriftOS pattern)
  const outputDir = 'docker/grafana/provisioning/dashboards/auto-generated';
  await fs.mkdir(outputDir, { recursive: true });
  
  // Generate dashboards
  for (const metadata of orchestrators) {
    const dashboard = generateDashboard(metadata);
    const outputPath = path.join(outputDir, `${metadata.uid}.json`);
    
    await fs.writeFile(
      outputPath,
      JSON.stringify(dashboard, null, 2),
      'utf-8'
    );
    
    console.log(`✅ ${metadata.serviceName} → ${outputPath}`);
  }
  
  console.log(`\n🎉 Generated ${orchestrators.length} dashboard(s)!`);
  console.log('\nNext steps:');
  console.log('  1. Restart Grafana: npm run docker:down && npm run docker:up');
  console.log('  2. Open http://localhost:3001');
  console.log('  3. Navigate to Dashboards → Browse\n');
}

main().catch(console.error);
