
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface ApiEndpoint {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  tests: ApiTest[];
  documentation: string;
}

export interface ApiTest {
  id: string;
  name: string;
  assertions: ApiAssertion[];
  preScript?: string;
  postScript?: string;
}

export interface ApiAssertion {
  type: 'status' | 'header' | 'body' | 'response_time';
  field?: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  expected: any;
}

export interface TestResult {
  endpointId: string;
  testId: string;
  passed: boolean;
  responseTime: number;
  status: number;
  response: any;
  errors: string[];
}

export class ApiTestingService {
  private testSuites: Map<string, ApiEndpoint[]> = new Map();
  private resultsDir: string;

  constructor() {
    this.resultsDir = path.join(process.cwd(), 'test-results');
  }

  async createTestSuite(projectId: string, endpoints: ApiEndpoint[]): Promise<void> {
    this.testSuites.set(projectId, endpoints);
    
    // Generate Postman collection
    await this.generatePostmanCollection(projectId, endpoints);
    
    // Generate OpenAPI documentation
    await this.generateOpenApiDocs(projectId, endpoints);
  }

  async runTests(projectId: string): Promise<TestResult[]> {
    const endpoints = this.testSuites.get(projectId);
    if (!endpoints) throw new Error('Test suite not found');

    const results: TestResult[] = [];

    for (const endpoint of endpoints) {
      for (const test of endpoint.tests) {
        try {
          const result = await this.executeTest(endpoint, test);
          results.push(result);
        } catch (error) {
          results.push({
            endpointId: endpoint.id,
            testId: test.id,
            passed: false,
            responseTime: 0,
            status: 0,
            response: null,
            errors: [error instanceof Error ? error.message : 'Unknown error']
          });
        }
      }
    }

    await this.saveResults(projectId, results);
    return results;
  }

  private async executeTest(endpoint: ApiEndpoint, test: ApiTest): Promise<TestResult> {
    const startTime = Date.now();
    
    const response = await fetch(endpoint.url, {
      method: endpoint.method,
      headers: endpoint.headers,
      body: endpoint.body
    });

    const responseTime = Date.now() - startTime;
    const responseData = await response.json().catch(() => response.text());

    const errors: string[] = [];
    let passed = true;

    for (const assertion of test.assertions) {
      const assertionPassed = this.validateAssertion(assertion, response, responseData, responseTime);
      if (!assertionPassed) {
        passed = false;
        errors.push(`Assertion failed: ${assertion.type} ${assertion.operator} ${assertion.expected}`);
      }
    }

    return {
      endpointId: endpoint.id,
      testId: test.id,
      passed,
      responseTime,
      status: response.status,
      response: responseData,
      errors
    };
  }

  private validateAssertion(assertion: ApiAssertion, response: Response, data: any, responseTime: number): boolean {
    switch (assertion.type) {
      case 'status':
        return this.compareValues(response.status, assertion.operator, assertion.expected);
      case 'response_time':
        return this.compareValues(responseTime, assertion.operator, assertion.expected);
      case 'header':
        const headerValue = response.headers.get(assertion.field!);
        return this.compareValues(headerValue, assertion.operator, assertion.expected);
      case 'body':
        const bodyValue = assertion.field ? data[assertion.field] : data;
        return this.compareValues(bodyValue, assertion.operator, assertion.expected);
      default:
        return false;
    }
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals': return actual === expected;
      case 'contains': return String(actual).includes(String(expected));
      case 'greater_than': return Number(actual) > Number(expected);
      case 'less_than': return Number(actual) < Number(expected);
      default: return false;
    }
  }

  private async generatePostmanCollection(projectId: string, endpoints: ApiEndpoint[]): Promise<void> {
    const collection = {
      info: { name: `API Tests - ${projectId}`, schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
      item: endpoints.map(endpoint => ({
        name: endpoint.name,
        request: {
          method: endpoint.method,
          header: Object.entries(endpoint.headers).map(([key, value]) => ({ key, value })),
          body: endpoint.body ? { mode: 'raw', raw: endpoint.body } : undefined,
          url: endpoint.url
        },
        event: endpoint.tests.map(test => ({
          listen: 'test',
          script: { exec: [`pm.test("${test.name}", function () { pm.response.to.have.status(200); });`] }
        }))
      }))
    };

    await fs.mkdir(this.resultsDir, { recursive: true });
    await fs.writeFile(
      path.join(this.resultsDir, `${projectId}-collection.json`),
      JSON.stringify(collection, null, 2)
    );
  }

  private async generateOpenApiDocs(projectId: string, endpoints: ApiEndpoint[]): Promise<void> {
    const openApiDoc = {
      openapi: '3.0.0',
      info: { title: `${projectId} API`, version: '1.0.0' },
      paths: endpoints.reduce((paths, endpoint) => {
        const urlPath = new URL(endpoint.url).pathname;
        paths[urlPath] = {
          [endpoint.method.toLowerCase()]: {
            summary: endpoint.name,
            description: endpoint.documentation,
            responses: { '200': { description: 'Success' } }
          }
        };
        return paths;
      }, {} as any)
    };

    await fs.writeFile(
      path.join(this.resultsDir, `${projectId}-openapi.json`),
      JSON.stringify(openApiDoc, null, 2)
    );
  }

  private async saveResults(projectId: string, results: TestResult[]): Promise<void> {
    await fs.mkdir(this.resultsDir, { recursive: true });
    await fs.writeFile(
      path.join(this.resultsDir, `${projectId}-results.json`),
      JSON.stringify(results, null, 2)
    );
  }
}

export const apiTestingService = new ApiTestingService();
