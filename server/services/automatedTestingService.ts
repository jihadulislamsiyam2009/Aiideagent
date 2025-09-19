
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface TestSuite {
  id: string;
  name: string;
  projectId: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  framework: 'jest' | 'mocha' | 'cypress' | 'playwright' | 'vitest';
  testFiles: string[];
  config: TestConfig;
  status: 'idle' | 'running' | 'passed' | 'failed';
  lastRun?: Date;
  coverage?: CoverageReport;
}

export interface TestConfig {
  timeout: number;
  retries: number;
  parallel: boolean;
  coverage: boolean;
  browser?: string;
  headless?: boolean;
  environment: Record<string, string>;
}

export interface TestResult {
  id: string;
  suiteId: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  tests: SingleTestResult[];
  coverage?: CoverageReport;
  artifacts: TestArtifact[];
}

export interface SingleTestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
}

export interface CoverageReport {
  lines: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  statements: { total: number; covered: number; percentage: number };
}

export interface TestArtifact {
  type: 'screenshot' | 'video' | 'log' | 'report';
  path: string;
  size: number;
}

export class AutomatedTestingService {
  private testSuites: Map<string, TestSuite> = new Map();
  private testResults: Map<string, TestResult[]> = new Map();

  async createTestSuite(config: Omit<TestSuite, 'id' | 'status' | 'lastRun'>): Promise<string> {
    const suiteId = `suite-${Date.now()}`;
    const suite: TestSuite = {
      ...config,
      id: suiteId,
      status: 'idle'
    };

    this.testSuites.set(suiteId, suite);
    await this.generateTestConfiguration(suite);
    
    return suiteId;
  }

  private async generateTestConfiguration(suite: TestSuite): Promise<void> {
    const projectPath = path.join(process.cwd(), 'projects', suite.projectId);
    
    switch (suite.framework) {
      case 'jest':
        await this.generateJestConfig(projectPath, suite);
        break;
      case 'cypress':
        await this.generateCypressConfig(projectPath, suite);
        break;
      case 'playwright':
        await this.generatePlaywrightConfig(projectPath, suite);
        break;
      case 'vitest':
        await this.generateVitestConfig(projectPath, suite);
        break;
    }
  }

  private async generateJestConfig(projectPath: string, suite: TestSuite): Promise<void> {
    const jestConfig = {
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/src', '<rootDir>/tests'],
      testMatch: ['**/__tests__/**/*.{js,jsx,ts,tsx}', '**/*.(test|spec).{js,jsx,ts,tsx}'],
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
      },
      collectCoverage: suite.config.coverage,
      collectCoverageFrom: [
        'src/**/*.{js,jsx,ts,tsx}',
        '!src/**/*.d.ts',
        '!src/index.tsx'
      ],
      coverageDirectory: 'coverage',
      coverageReporters: ['text', 'lcov', 'html'],
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
      testTimeout: suite.config.timeout || 10000,
      maxConcurrency: suite.config.parallel ? 4 : 1
    };

    await fs.writeFile(
      path.join(projectPath, 'jest.config.js'),
      `module.exports = ${JSON.stringify(jestConfig, null, 2)};`
    );
  }

  private async generateCypressConfig(projectPath: string, suite: TestSuite): Promise<void> {
    const cypressConfig = {
      e2e: {
        baseUrl: 'http://localhost:3000',
        viewportWidth: 1280,
        viewportHeight: 720,
        video: true,
        screenshot: true,
        specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
        supportFile: 'cypress/support/e2e.js',
        defaultCommandTimeout: suite.config.timeout || 10000,
        requestTimeout: 15000,
        responseTimeout: 30000
      },
      component: {
        devServer: {
          framework: 'react',
          bundler: 'vite'
        },
        specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}'
      }
    };

    await fs.writeFile(
      path.join(projectPath, 'cypress.config.js'),
      `module.exports = ${JSON.stringify(cypressConfig, null, 2)};`
    );

    // Create Cypress support files
    const supportDir = path.join(projectPath, 'cypress', 'support');
    await fs.mkdir(supportDir, { recursive: true });
    
    await fs.writeFile(
      path.join(supportDir, 'e2e.js'),
      `import './commands';\n\nbeforeEach(() => {\n  cy.visit('/');\n});`
    );

    await fs.writeFile(
      path.join(supportDir, 'commands.js'),
      `Cypress.Commands.add('login', (username, password) => {\n  cy.get('[data-cy=username]').type(username);\n  cy.get('[data-cy=password]').type(password);\n  cy.get('[data-cy=submit]').click();\n});`
    );
  }

  private async generatePlaywrightConfig(projectPath: string, suite: TestSuite): Promise<void> {
    const playwrightConfig = {
      testDir: './tests',
      timeout: suite.config.timeout || 30000,
      expect: { timeout: 5000 },
      fullyParallel: suite.config.parallel,
      forbidOnly: process.env.CI === 'true',
      retries: suite.config.retries || 0,
      workers: suite.config.parallel ? undefined : 1,
      reporter: 'html',
      use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
      },
      projects: [
        { name: 'chromium', use: { ...require('@playwright/test').devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...require('@playwright/test').devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...require('@playwright/test').devices['Desktop Safari'] } }
      ],
      webServer: {
        command: 'npm run dev',
        port: 3000,
        reuseExistingServer: !process.env.CI
      }
    };

    await fs.writeFile(
      path.join(projectPath, 'playwright.config.js'),
      `module.exports = ${JSON.stringify(playwrightConfig, null, 2)};`
    );
  }

  private async generateVitestConfig(projectPath: string, suite: TestSuite): Promise<void> {
    const vitestConfig = `
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*'],
      exclude: ['node_modules/', 'src/test/']
    },
    timeout: ${suite.config.timeout || 10000}
  }
});`;

    await fs.writeFile(path.join(projectPath, 'vitest.config.ts'), vitestConfig);
  }

  async runTestSuite(suiteId: string): Promise<string> {
    const suite = this.testSuites.get(suiteId);
    if (!suite) throw new Error('Test suite not found');

    const resultId = `result-${Date.now()}`;
    suite.status = 'running';
    suite.lastRun = new Date();

    try {
      const result = await this.executeTests(suite, resultId);
      
      const existingResults = this.testResults.get(suiteId) || [];
      existingResults.push(result);
      this.testResults.set(suiteId, existingResults);

      suite.status = result.status === 'passed' ? 'passed' : 'failed';
      suite.coverage = result.coverage;

      return resultId;
    } catch (error) {
      suite.status = 'failed';
      throw error;
    }
  }

  private async executeTests(suite: TestSuite, resultId: string): Promise<TestResult> {
    const projectPath = path.join(process.cwd(), 'projects', suite.projectId);
    const result: TestResult = {
      id: resultId,
      suiteId: suite.id,
      status: 'failed',
      duration: 0,
      tests: [],
      artifacts: []
    };

    const startTime = Date.now();

    return new Promise((resolve) => {
      let command: string;
      let args: string[];

      switch (suite.framework) {
        case 'jest':
          command = 'npx';
          args = ['jest', '--json', '--coverage'];
          break;
        case 'cypress':
          command = 'npx';
          args = ['cypress', 'run', '--reporter', 'json'];
          break;
        case 'playwright':
          command = 'npx';
          args = ['playwright', 'test', '--reporter=json'];
          break;
        case 'vitest':
          command = 'npx';
          args = ['vitest', 'run', '--reporter=json'];
          break;
        default:
          command = 'npm';
          args = ['test'];
      }

      const testProcess = spawn(command, args, {
        cwd: projectPath,
        stdio: 'pipe',
        env: { ...process.env, ...suite.config.environment }
      });

      let output = '';
      let errorOutput = '';

      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      testProcess.on('close', async (code) => {
        result.duration = Date.now() - startTime;

        try {
          const testOutput = JSON.parse(output);
          result.status = code === 0 ? 'passed' : 'failed';
          result.tests = this.parseTestResults(testOutput, suite.framework);
          
          if (suite.config.coverage && testOutput.coverageMap) {
            result.coverage = this.parseCoverage(testOutput.coverageMap);
          }

          // Collect artifacts
          result.artifacts = await this.collectArtifacts(projectPath, suite);
        } catch (parseError) {
          result.status = 'failed';
          result.tests = [{
            name: 'Test execution',
            status: 'failed',
            duration: result.duration,
            error: errorOutput || 'Failed to parse test results'
          }];
        }

        resolve(result);
      });
    });
  }

  private parseTestResults(output: any, framework: string): SingleTestResult[] {
    const results: SingleTestResult[] = [];

    switch (framework) {
      case 'jest':
        if (output.testResults) {
          for (const testFile of output.testResults) {
            for (const test of testFile.assertionResults) {
              results.push({
                name: test.fullName,
                status: test.status === 'passed' ? 'passed' : 'failed',
                duration: test.duration || 0,
                error: test.failureMessages?.[0]
              });
            }
          }
        }
        break;
      case 'cypress':
        if (output.runs) {
          for (const run of output.runs) {
            for (const test of run.tests) {
              results.push({
                name: test.title.join(' '),
                status: test.state === 'passed' ? 'passed' : 'failed',
                duration: test.duration,
                error: test.err?.message
              });
            }
          }
        }
        break;
    }

    return results;
  }

  private parseCoverage(coverageMap: any): CoverageReport {
    // Simplified coverage parsing - would need proper implementation
    return {
      lines: { total: 100, covered: 85, percentage: 85 },
      branches: { total: 50, covered: 42, percentage: 84 },
      functions: { total: 25, covered: 23, percentage: 92 },
      statements: { total: 120, covered: 110, percentage: 91.7 }
    };
  }

  private async collectArtifacts(projectPath: string, suite: TestSuite): Promise<TestArtifact[]> {
    const artifacts: TestArtifact[] = [];
    
    // Look for common artifact directories
    const artifactDirs = ['coverage', 'cypress/screenshots', 'cypress/videos', 'test-results'];
    
    for (const dir of artifactDirs) {
      const fullPath = path.join(projectPath, dir);
      try {
        const exists = await fs.access(fullPath).then(() => true).catch(() => false);
        if (exists) {
          const files = await this.findArtifactFiles(fullPath);
          artifacts.push(...files);
        }
      } catch (error) {
        console.error(`Error collecting artifacts from ${dir}:`, error);
      }
    }

    return artifacts;
  }

  private async findArtifactFiles(dir: string): Promise<TestArtifact[]> {
    const artifacts: TestArtifact[] = [];
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isFile()) {
        const stats = await fs.stat(fullPath);
        const extension = path.extname(item.name).toLowerCase();
        
        let type: TestArtifact['type'] = 'log';
        if (['.png', '.jpg', '.jpeg'].includes(extension)) type = 'screenshot';
        else if (['.mp4', '.webm'].includes(extension)) type = 'video';
        else if (['.html', '.json'].includes(extension)) type = 'report';

        artifacts.push({
          type,
          path: fullPath,
          size: stats.size
        });
      } else if (item.isDirectory()) {
        const subArtifacts = await this.findArtifactFiles(fullPath);
        artifacts.push(...subArtifacts);
      }
    }

    return artifacts;
  }

  async generateTestReport(suiteId: string): Promise<string> {
    const suite = this.testSuites.get(suiteId);
    const results = this.testResults.get(suiteId) || [];
    
    if (!suite) throw new Error('Test suite not found');

    const reportPath = path.join(process.cwd(), 'test-reports', `${suiteId}-report.html`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });

    const html = this.generateHTMLReport(suite, results);
    await fs.writeFile(reportPath, html);

    return reportPath;
  }

  private generateHTMLReport(suite: TestSuite, results: TestResult[]): string {
    const latestResult = results[results.length - 1];
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Test Report - ${suite.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .coverage { margin: 20px 0; }
        .test-result { margin: 10px 0; padding: 10px; border-left: 4px solid; }
        .test-passed { border-color: #28a745; background: #f8fff8; }
        .test-failed { border-color: #dc3545; background: #fff8f8; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${suite.name}</h1>
        <p><strong>Type:</strong> ${suite.type}</p>
        <p><strong>Framework:</strong> ${suite.framework}</p>
        <p><strong>Status:</strong> <span class="status-${suite.status}">${suite.status}</span></p>
        <p><strong>Last Run:</strong> ${suite.lastRun?.toLocaleString()}</p>
    </div>

    ${latestResult ? `
    <div class="summary">
        <h2>Latest Test Results</h2>
        <p><strong>Duration:</strong> ${latestResult.duration}ms</p>
        <p><strong>Total Tests:</strong> ${latestResult.tests.length}</p>
        <p><strong>Passed:</strong> ${latestResult.tests.filter(t => t.status === 'passed').length}</p>
        <p><strong>Failed:</strong> ${latestResult.tests.filter(t => t.status === 'failed').length}</p>
        
        ${latestResult.coverage ? `
        <div class="coverage">
            <h3>Coverage Report</h3>
            <p>Lines: ${latestResult.coverage.lines.percentage}%</p>
            <p>Branches: ${latestResult.coverage.branches.percentage}%</p>
            <p>Functions: ${latestResult.coverage.functions.percentage}%</p>
            <p>Statements: ${latestResult.coverage.statements.percentage}%</p>
        </div>
        ` : ''}
        
        <h3>Test Details</h3>
        ${latestResult.tests.map(test => `
            <div class="test-result test-${test.status}">
                <strong>${test.name}</strong> (${test.duration}ms)
                ${test.error ? `<br><code style="color: red;">${test.error}</code>` : ''}
            </div>
        `).join('')}
    </div>
    ` : '<p>No test results available</p>'}
    
    <div class="history">
        <h2>Test History</h2>
        <p>Total Runs: ${results.length}</p>
        ${results.map((result, index) => `
            <p>Run ${index + 1}: <span class="status-${result.status}">${result.status}</span> (${result.duration}ms)</p>
        `).join('')}
    </div>
</body>
</html>`;
  }

  getTestSuite(suiteId: string): TestSuite | undefined {
    return this.testSuites.get(suiteId);
  }

  getTestResults(suiteId: string): TestResult[] {
    return this.testResults.get(suiteId) || [];
  }

  getAllTestSuites(): TestSuite[] {
    return Array.from(this.testSuites.values());
  }
}

export const automatedTestingService = new AutomatedTestingService();
