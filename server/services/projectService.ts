import path from 'path';
import { fileService } from './fileService';
import { terminalService } from './terminalService';
import { getUncachableGitHubClient } from '../githubClient';
import { spawn } from 'child_process';
import fs from 'fs/promises';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  files: { [path: string]: string };
  dependencies?: string[];
  scripts?: { [name: string]: string };
  instructions?: string;
}

export interface ProjectScaffoldResult {
  success: boolean;
  projectPath: string;
  message: string;
  error?: string;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  language: string;
  stargazers_count: number;
  updated_at: string;
}

export class ProjectService {
  private projectsDir: string;
  private templates: Map<string, ProjectTemplate> = new Map();

  constructor() {
    this.projectsDir = process.env.PROJECTS_DIR || path.join(process.cwd(), 'projects');
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // React TypeScript Template
    this.templates.set('react-typescript', {
      id: 'react-typescript',
      name: 'React TypeScript',
      description: 'Modern React application with TypeScript and Vite',
      category: 'Frontend',
      files: {
        'package.json': JSON.stringify({
          name: 'react-app',
          version: '1.0.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc && vite build',
            preview: 'vite preview'
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0'
          },
          devDependencies: {
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            '@vitejs/plugin-react': '^4.0.0',
            typescript: '^5.0.0',
            vite: '^4.0.0'
          }
        }, null, 2),
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx',
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true
          },
          include: ['src'],
          references: [{ path: './tsconfig.node.json' }]
        }, null, 2),
        'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    host: '0.0.0.0'
  }
})`,
        'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
        'src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
        'src/App.tsx': `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>React TypeScript App</h1>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
      <p>Edit <code>src/App.tsx</code> and save to test HMR</p>
    </div>
  )
}

export default App`,
        'src/index.css': `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #f0f0f0;
}`
      }
    });

    // Python Flask Template
    this.templates.set('python-flask', {
      id: 'python-flask',
      name: 'Python Flask API',
      description: 'RESTful API server with Flask and SQLAlchemy',
      category: 'Backend',
      files: {
        'requirements.txt': `Flask==2.3.2
Flask-SQLAlchemy==3.0.5
Flask-CORS==4.0.0
python-dotenv==1.0.0`,
        'app.py': `from flask import Flask, jsonify, request
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

@app.route('/')
def hello():
    return jsonify({'message': 'Hello from Flask API!'})

@app.route('/api/data', methods=['GET'])
def get_data():
    return jsonify({'data': [1, 2, 3, 4, 5]})

@app.route('/api/data', methods=['POST'])
def post_data():
    data = request.json
    return jsonify({'received': data}), 201

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)`,
        '.env': `FLASK_ENV=development
FLASK_DEBUG=1`,
        'README.md': `# Flask API

## Setup
\`\`\`bash
pip install -r requirements.txt
python app.py
\`\`\`

## Endpoints
- GET / - Hello message
- GET /api/data - Get sample data
- POST /api/data - Send data
`
      }
    });

    // Node.js Express Template
    this.templates.set('node-express', {
      id: 'node-express',
      name: 'Node.js Express API',
      description: 'REST API with Express.js and TypeScript',
      category: 'Backend',
      files: {
        'package.json': JSON.stringify({
          name: 'express-api',
          version: '1.0.0',
          type: 'module',
          scripts: {
            dev: 'tsx watch src/index.ts',
            build: 'tsc',
            start: 'node dist/index.js'
          },
          dependencies: {
            express: '^4.18.2',
            cors: '^2.8.5',
            dotenv: '^16.3.1'
          },
          devDependencies: {
            '@types/express': '^4.17.17',
            '@types/cors': '^2.8.13',
            '@types/node': '^20.4.5',
            typescript: '^5.1.6',
            tsx: '^3.12.7'
          }
        }, null, 2),
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            outDir: 'dist'
          },
          include: ['src/**/*']
        }, null, 2),
        'src/index.ts': `import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express API!' });
});

app.get('/api/data', (req, res) => {
  res.json({ data: [1, 2, 3, 4, 5] });
});

app.post('/api/data', (req, res) => {
  const data = req.body;
  res.status(201).json({ received: data });
});

app.listen(port, '0.0.0.0', () => {
  console.log(\`Server running on port \${port}\`);
});`,
        '.env': `PORT=5000
NODE_ENV=development`
      }
    });

    // Next.js Template
    this.templates.set('nextjs', {
      id: 'nextjs',
      name: 'Next.js App',
      description: 'Full-stack React application with Next.js',
      category: 'Fullstack',
      files: {
        'package.json': JSON.stringify({
          name: 'nextjs-app',
          version: '1.0.0',
          scripts: {
            dev: 'next dev -p 5000 -H 0.0.0.0',
            build: 'next build',
            start: 'next start -p 5000 -H 0.0.0.0'
          },
          dependencies: {
            next: '^13.4.19',
            react: '^18.2.0',
            'react-dom': '^18.2.0'
          },
          devDependencies: {
            '@types/node': '^20.4.5',
            '@types/react': '^18.2.20',
            typescript: '^5.1.6'
          }
        }, null, 2),
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: 'es5',
            lib: ['dom', 'dom.iterable', 'es6'],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            paths: {
              '@/*': ['./src/*']
            }
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
          exclude: ['node_modules']
        }, null, 2),
        'next.config.js': `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
}

module.exports = nextConfig`,
        'src/app/page.tsx': `export default function Home() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Next.js App</h1>
      <p>Welcome to your new Next.js application!</p>
    </main>
  )
}`,
        'src/app/layout.tsx': `export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`
      }
    });

    // Python Data Science Template
    this.templates.set('python-datascience', {
      id: 'python-datascience',
      name: 'Python Data Science',
      description: 'Data analysis and visualization with Jupyter, Pandas, and Matplotlib',
      category: 'Data Science',
      files: {
        'requirements.txt': `jupyter==1.0.0
pandas==2.0.3
numpy==1.24.3
matplotlib==3.7.2
seaborn==0.12.2
scikit-learn==1.3.0
plotly==5.15.0`,
        'main.py': `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

def main():
    # Sample data analysis
    data = {
        'x': np.random.randn(100),
        'y': np.random.randn(100),
        'category': np.random.choice(['A', 'B', 'C'], 100)
    }
    
    df = pd.DataFrame(data)
    
    print("Data Summary:")
    print(df.describe())
    
    # Create visualizations
    plt.figure(figsize=(12, 4))
    
    plt.subplot(1, 2, 1)
    plt.scatter(df['x'], df['y'], c=df['category'].astype('category').cat.codes)
    plt.title('Scatter Plot')
    plt.xlabel('X')
    plt.ylabel('Y')
    
    plt.subplot(1, 2, 2)
    df['category'].value_counts().plot(kind='bar')
    plt.title('Category Distribution')
    
    plt.tight_layout()
    plt.savefig('analysis.png')
    print("Analysis saved as analysis.png")

if __name__ == "__main__":
    main()`,
        'notebook.ipynb': JSON.stringify({
          cells: [
            {
              cell_type: 'code',
              source: [
                'import pandas as pd\n',
                'import numpy as np\n',
                'import matplotlib.pyplot as plt\n',
                'import seaborn as sns\n',
                '\n',
                '# Your data analysis code here'
              ]
            }
          ],
          metadata: {
            kernelspec: {
              display_name: 'Python 3',
              language: 'python',
              name: 'python3'
            }
          },
          nbformat: 4,
          nbformat_minor: 4
        }, null, 2)
      }
    });
  }

  async createProject(name: string, templateId: string, customPath?: string): Promise<ProjectScaffoldResult> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      const projectPath = customPath || path.join(this.projectsDir, name);
      
      // Ensure projects directory exists
      await fs.mkdir(this.projectsDir, { recursive: true });
      
      // Check if project directory already exists
      try {
        await fs.access(projectPath);
        throw new Error('Project directory already exists');
      } catch (error) {
        // Directory doesn't exist, which is what we want
      }

      // Create project directory
      await fs.mkdir(projectPath, { recursive: true });

      // Create all template files
      for (const [filePath, content] of Object.entries(template.files)) {
        const fullFilePath = path.join(projectPath, filePath);
        const fileDir = path.dirname(fullFilePath);
        
        // Ensure subdirectories exist
        await fs.mkdir(fileDir, { recursive: true });
        
        // Write file content
        await fs.writeFile(fullFilePath, content, 'utf-8');
      }

      return {
        success: true,
        projectPath,
        message: `Project ${name} created successfully from template ${template.name}`
      };
    } catch (error) {
      return {
        success: false,
        projectPath: customPath || path.join(this.projectsDir, name),
        message: 'Failed to create project',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async installDependencies(projectPath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Check if package.json exists (Node.js project)
      const packageJsonPath = path.join(projectPath, 'package.json');
      const requirementsPath = path.join(projectPath, 'requirements.txt');

      let installCommand: string;
      let args: string[];

      if (await fs.access(packageJsonPath).then(() => true).catch(() => false)) {
        installCommand = 'npm';
        args = ['install'];
      } else if (await fs.access(requirementsPath).then(() => true).catch(() => false)) {
        installCommand = 'pip';
        args = ['install', '-r', 'requirements.txt'];
      } else {
        resolve(); // No dependencies to install
        return;
      }

      const installProcess = spawn(installCommand, args, {
        cwd: projectPath,
        stdio: 'pipe'
      });

      installProcess.stdout.on('data', (data) => {
        console.log(`Install: ${data}`);
      });

      installProcess.stderr.on('data', (data) => {
        console.error(`Install error: ${data}`);
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Dependency installation failed with code ${code}`));
        }
      });
    });
  }

  async cloneGitHubRepo(repoUrl: string, projectName?: string): Promise<ProjectScaffoldResult> {
    try {
      const name = projectName || path.basename(repoUrl, '.git');
      const projectPath = path.join(this.projectsDir, name);

      // Ensure projects directory exists
      await fs.mkdir(this.projectsDir, { recursive: true });

      return new Promise((resolve, reject) => {
        const cloneProcess = spawn('git', ['clone', repoUrl, projectPath], {
          stdio: 'pipe'
        });

        cloneProcess.stdout.on('data', (data) => {
          console.log(`Git clone: ${data}`);
        });

        cloneProcess.stderr.on('data', (data) => {
          console.error(`Git clone: ${data}`);
        });

        cloneProcess.on('close', (code) => {
          if (code === 0) {
            resolve({
              success: true,
              projectPath,
              message: `Repository cloned successfully to ${name}`
            });
          } else {
            reject({
              success: false,
              projectPath,
              message: 'Failed to clone repository',
              error: `Git clone failed with code ${code}`
            });
          }
        });
      });
    } catch (error) {
      return {
        success: false,
        projectPath: '',
        message: 'Failed to clone repository',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async searchGitHubRepos(query: string, language?: string): Promise<GitHubRepo[]> {
    try {
      const github = await getUncachableGitHubClient();
      
      let searchQuery = query;
      if (language) {
        searchQuery += ` language:${language}`;
      }

      const response = await github.rest.search.repos({
        q: searchQuery,
        sort: 'stars',
        order: 'desc',
        per_page: 20
      });

      return response.data.items.map((repo: any) => ({
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || '',
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        language: repo.language || '',
        stargazers_count: repo.stargazers_count,
        updated_at: repo.updated_at
      }));
    } catch (error) {
      console.error('Error searching GitHub repositories:', error);
      throw error;
    }
  }

  async getUserGitHubRepos(): Promise<GitHubRepo[]> {
    try {
      const github = await getUncachableGitHubClient();
      
      const response = await github.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 50
      });

      return response.data.map((repo: any) => ({
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || '',
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        language: repo.language || '',
        stargazers_count: repo.stargazers_count,
        updated_at: repo.updated_at
      }));
    } catch (error) {
      console.error('Error fetching user repositories:', error);
      throw error;
    }
  }

  getTemplates(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(id: string): ProjectTemplate | undefined {
    return this.templates.get(id);
  }

  async runProject(projectPath: string, command: string = 'dev'): Promise<string> {
    const sessionId = `project-${Date.now()}`;
    const session = terminalService.createSession(sessionId, projectPath);

    // Determine the appropriate run command based on project type
    const packageJsonPath = path.join(projectPath, 'package.json');
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    const appPyPath = path.join(projectPath, 'app.py');
    const mainPyPath = path.join(projectPath, 'main.py');

    let runCommand: string;

    try {
      await fs.access(packageJsonPath);
      runCommand = `npm run ${command}`;
    } catch {
      try {
        await fs.access(appPyPath);
        runCommand = 'python app.py';
      } catch {
        try {
          await fs.access(mainPyPath);
          runCommand = 'python main.py';
        } catch {
          runCommand = command;
        }
      }
    }

    await terminalService.executeCommand(sessionId, runCommand);
    return sessionId;
  }
}

export const projectService = new ProjectService();
