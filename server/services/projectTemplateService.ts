
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: 'web' | 'mobile' | 'api' | 'ml' | 'desktop' | 'game';
  language: string;
  framework: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  features: string[];
  files: TemplateFile[];
}

export interface TemplateFile {
  path: string;
  content: string;
  executable?: boolean;
}

export class ProjectTemplateService {
  private templates: Map<string, ProjectTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates() {
    const templates: ProjectTemplate[] = [
      {
        id: 'react-app',
        name: 'React Application',
        description: 'Modern React app with TypeScript and Vite',
        category: 'web',
        language: 'TypeScript',
        framework: 'React',
        difficulty: 'beginner',
        features: ['TypeScript', 'Vite', 'Tailwind CSS', 'React Router'],
        files: [
          {
            path: 'package.json',
            content: JSON.stringify({
              name: 'react-app',
              version: '0.1.0',
              type: 'module',
              scripts: {
                dev: 'vite',
                build: 'tsc && vite build',
                preview: 'vite preview'
              },
              dependencies: {
                react: '^18.2.0',
                'react-dom': '^18.2.0',
                'react-router-dom': '^6.8.1'
              },
              devDependencies: {
                '@types/react': '^18.0.27',
                '@types/react-dom': '^18.0.10',
                '@vitejs/plugin-react': '^3.1.0',
                typescript: '^4.9.3',
                vite: '^4.1.0'
              }
            }, null, 2)
          },
          {
            path: 'index.html',
            content: `<!DOCTYPE html>
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
</html>`
          },
          {
            path: 'src/main.tsx',
            content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`
          },
          {
            path: 'src/App.tsx',
            content: `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <h1>Welcome to React!</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
    </div>
  )
}

export default App`
          },
          {
            path: 'vite.config.ts',
            content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000
  }
})`
          }
        ]
      },
      {
        id: 'express-api',
        name: 'Express API',
        description: 'RESTful API with Express.js and TypeScript',
        category: 'api',
        language: 'TypeScript',
        framework: 'Express',
        difficulty: 'intermediate',
        features: ['Express.js', 'TypeScript', 'MongoDB', 'JWT Auth'],
        files: [
          {
            path: 'package.json',
            content: JSON.stringify({
              name: 'express-api',
              version: '1.0.0',
              scripts: {
                start: 'node dist/index.js',
                dev: 'tsx src/index.ts',
                build: 'tsc'
              },
              dependencies: {
                express: '^4.18.2',
                cors: '^2.8.5',
                helmet: '^6.0.1',
                mongoose: '^7.0.3',
                jsonwebtoken: '^9.0.0',
                bcryptjs: '^2.4.3'
              },
              devDependencies: {
                '@types/express': '^4.17.17',
                '@types/cors': '^2.8.13',
                '@types/jsonwebtoken': '^9.0.1',
                '@types/bcryptjs': '^2.4.2',
                typescript: '^5.0.2',
                tsx: '^3.12.6'
              }
            }, null, 2)
          },
          {
            path: 'src/index.ts',
            content: `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'API is running!' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on port \${PORT}\`);
});`
          }
        ]
      },
      {
        id: 'python-flask',
        name: 'Flask API',
        description: 'Python Flask REST API with SQLite',
        category: 'api',
        language: 'Python',
        framework: 'Flask',
        difficulty: 'beginner',
        features: ['Flask', 'SQLite', 'REST API', 'CORS'],
        files: [
          {
            path: 'requirements.txt',
            content: `Flask==2.3.2
Flask-CORS==4.0.0
SQLAlchemy==2.0.15
Flask-SQLAlchemy==3.0.5`
          },
          {
            path: 'app.py',
            content: `from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Item(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

@app.route('/')
def home():
    return jsonify({'message': 'Flask API is running!'})

@app.route('/api/items', methods=['GET'])
def get_items():
    items = Item.query.all()
    return jsonify([{'id': item.id, 'name': item.name, 'created_at': item.created_at} for item in items])

@app.route('/api/items', methods=['POST'])
def create_item():
    data = request.get_json()
    item = Item(name=data['name'])
    db.session.add(item)
    db.session.commit()
    return jsonify({'id': item.id, 'name': item.name}), 201

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)`
          }
        ]
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  getTemplates(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(id: string): ProjectTemplate | undefined {
    return this.templates.get(id);
  }

  async createProjectFromTemplate(templateId: string, projectName: string, projectPath: string): Promise<boolean> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    try {
      // Create project directory
      await fs.mkdir(projectPath, { recursive: true });

      // Create all template files
      for (const file of template.files) {
        const filePath = path.join(projectPath, file.path);
        const fileDir = path.dirname(filePath);
        
        // Create directory if it doesn't exist
        await fs.mkdir(fileDir, { recursive: true });
        
        // Write file content
        await fs.writeFile(filePath, file.content);
        
        // Make executable if needed
        if (file.executable) {
          await fs.chmod(filePath, 0o755);
        }
      }

      // Install dependencies if package.json exists
      const packageJsonPath = path.join(projectPath, 'package.json');
      const requirementsPath = path.join(projectPath, 'requirements.txt');
      
      if (await this.fileExists(packageJsonPath)) {
        await this.runCommand('npm install', projectPath);
      } else if (await this.fileExists(requirementsPath)) {
        await this.runCommand('pip install -r requirements.txt', projectPath);
      }

      return true;
    } catch (error) {
      console.error('Error creating project from template:', error);
      return false;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private runCommand(command: string, cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, { cwd, stdio: 'pipe' });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }
}

export const projectTemplateService = new ProjectTemplateService();
