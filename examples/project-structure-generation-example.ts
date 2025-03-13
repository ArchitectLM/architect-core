/**
 * Project Structure Generation Example
 * 
 * This example demonstrates how to use the enhanced RAG agent to generate
 * a project structure for a Todo application.
 */

import { System, createRuntime } from '../src';
import * as fs from 'fs';
import * as path from 'path';

// Mock RAGAgentConfig interface
interface RAGAgentConfig {
  provider: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  codebasePath?: string;
  useInMemoryVectorStore?: boolean;
}

// Mock RAGAgentExtension class
class MockRAGAgentExtension {
  private config: RAGAgentConfig;
  private runtime: any;

  constructor(config: Partial<RAGAgentConfig> = {}) {
    // Default configuration
    const defaultConfig: RAGAgentConfig = {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2000,
      codebasePath: './src',
      useInMemoryVectorStore: false,
      apiKey: process.env.OPENAI_API_KEY || '',
    };
    
    this.config = { ...defaultConfig, ...config };
  }

  async initialize(runtime: any): Promise<void> {
    this.runtime = runtime;
    console.log(`Mock RAG Agent initialized with provider: ${this.config.provider}, model: ${this.config.model}`);
  }

  // This would be one of the new methods we're proposing to add
  async generateProjectStructure(projectSpec: any, outputDir: string): Promise<string> {
    console.log('Preparing prompt for the LLM...');
    const prompt = `
      Generate a project structure for a ${projectSpec.name} with the following specifications:
      
      Frontend:
      - Framework: ${projectSpec.frontend?.framework || 'None'}
      - Styling: ${projectSpec.frontend?.styling || 'None'}
      
      Backend:
      - Framework: ${projectSpec.backend?.framework || 'None'}
      - Database: ${projectSpec.backend?.database || 'None'}
      - ORM: ${projectSpec.backend?.orm || 'None'}
      
      API:
      - Type: ${projectSpec.api?.type || 'None'}
      
      Include proper configuration files, directory structure, and README.
    `;
    
    console.log('Calling LLM to generate project structure...');
    // In a real implementation, this would call the LLM
    // For this example, we'll just create a hardcoded structure
    
    // Create the project directory
    const projectDir = path.join(outputDir, projectSpec.name.toLowerCase().replace(/\s+/g, '-'));
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    
    // Create README.md
    const readmeContent = `# ${projectSpec.name}

${projectSpec.description}

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- ${projectSpec.backend?.database || 'MongoDB'} (for the backend)

### Installation

1. Clone the repository
2. Install dependencies:

\`\`\`bash
npm install
\`\`\`

3. Start the development server:

\`\`\`bash
npm run dev
\`\`\`

## Project Structure

\`\`\`
${projectSpec.name.toLowerCase().replace(/\s+/g, '-')}/
├── frontend/           # ${projectSpec.frontend?.framework || 'React'} frontend
│   ├── public/         # Static files
│   │   ├── components/ # UI components
│   │   ├── pages/      # Page components
│   │   ├── styles/     # ${projectSpec.frontend?.styling || 'CSS'} styles
│   │   ├── App.tsx     # Main App component
│   │   └── index.tsx   # Entry point
│   ├── package.json    # Frontend dependencies
│   └── tsconfig.json   # TypeScript configuration
├── backend/            # ${projectSpec.backend?.framework || 'Express'} backend
│   ├── src/            # Source code
│   │   ├── models/     # ${projectSpec.backend?.orm || 'Mongoose'} models
│   │   ├── routes/     # API routes
│   │   ├── controllers/# Route controllers
│   │   ├── middleware/ # Express middleware
│   │   └── index.ts    # Entry point
│   ├── package.json    # Backend dependencies
│   └── tsconfig.json   # TypeScript configuration
├── package.json        # Root dependencies
└── README.md           # Project documentation
\`\`\`

## Features

- ${projectSpec.frontend?.framework || 'React'} frontend with ${projectSpec.frontend?.styling || 'CSS'} styling
- ${projectSpec.backend?.framework || 'Express'} backend with ${projectSpec.backend?.database || 'MongoDB'} database
- ${projectSpec.api?.type || 'REST'} API
- TypeScript for type safety

## License

MIT
`;
    fs.writeFileSync(path.join(projectDir, 'README.md'), readmeContent);
    
    // Create root package.json
    const rootPackageJson = {
      name: projectSpec.name.toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      description: projectSpec.description,
      scripts: {
        'dev': 'concurrently "npm run dev:frontend" "npm run dev:backend"',
        'dev:frontend': 'cd frontend && npm run dev',
        'dev:backend': 'cd backend && npm run dev',
        'build': 'concurrently "npm run build:frontend" "npm run build:backend"',
        'build:frontend': 'cd frontend && npm run build',
        'build:backend': 'cd backend && npm run build',
        'start': 'cd backend && npm run start'
      },
      keywords: ['todo', 'app', projectSpec.frontend?.framework || 'react', projectSpec.backend?.framework || 'express'],
      author: '',
      license: 'MIT',
      devDependencies: {
        'concurrently': '^7.6.0',
        'typescript': '^4.9.5'
      }
    };
    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify(rootPackageJson, null, 2));
    
    // Create frontend directory structure
    if (projectSpec.frontend) {
      const frontendDir = path.join(projectDir, 'frontend');
      fs.mkdirSync(frontendDir, { recursive: true });
      fs.mkdirSync(path.join(frontendDir, 'public'), { recursive: true });
      fs.mkdirSync(path.join(frontendDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(frontendDir, 'src', 'components'), { recursive: true });
      fs.mkdirSync(path.join(frontendDir, 'src', 'pages'), { recursive: true });
      fs.mkdirSync(path.join(frontendDir, 'src', 'styles'), { recursive: true });
      
      // Create frontend package.json
      const frontendPackageJson: any = {
        name: `${projectSpec.name.toLowerCase().replace(/\s+/g, '-')}-frontend`,
        version: '0.1.0',
        private: true,
        scripts: {
          'dev': 'vite',
          'build': 'tsc && vite build',
          'preview': 'vite preview'
        },
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0',
          'react-router-dom': '^6.8.1',
          'axios': '^1.3.3'
        },
        devDependencies: {
          '@types/react': '^18.0.28',
          '@types/react-dom': '^18.0.11',
          '@vitejs/plugin-react': '^3.1.0',
          'typescript': '^4.9.5',
          'vite': '^4.1.4'
        }
      };
      
      // Add styling dependencies
      if (projectSpec.frontend.styling === 'tailwind') {
        frontendPackageJson.devDependencies = {
          ...frontendPackageJson.devDependencies,
          'tailwindcss': '^3.2.7',
          'postcss': '^8.4.21',
          'autoprefixer': '^10.4.13'
        };
      }
      
      fs.writeFileSync(path.join(frontendDir, 'package.json'), JSON.stringify(frontendPackageJson, null, 2));
      
      // Create frontend tsconfig.json
      const frontendTsConfig = {
        compilerOptions: {
          target: 'ESNext',
          useDefineForClassFields: true,
          lib: ['DOM', 'DOM.Iterable', 'ESNext'],
          allowJs: false,
          skipLibCheck: true,
          esModuleInterop: false,
          allowSyntheticDefaultImports: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          module: 'ESNext',
          moduleResolution: 'Node',
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx'
        },
        include: ['src'],
        references: [{ path: './tsconfig.node.json' }]
      };
      fs.writeFileSync(path.join(frontendDir, 'tsconfig.json'), JSON.stringify(frontendTsConfig, null, 2));
      
      // Create frontend tsconfig.node.json
      const frontendTsConfigNode = {
        compilerOptions: {
          composite: true,
          module: 'ESNext',
          moduleResolution: 'Node',
          allowSyntheticDefaultImports: true
        },
        include: ['vite.config.ts']
      };
      fs.writeFileSync(path.join(frontendDir, 'tsconfig.node.json'), JSON.stringify(frontendTsConfigNode, null, 2));
      
      // Create vite.config.ts
      const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
`;
      fs.writeFileSync(path.join(frontendDir, 'vite.config.ts'), viteConfig);
      
      // Create index.html
      const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectSpec.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
`;
      fs.writeFileSync(path.join(frontendDir, 'index.html'), indexHtml);
      
      // Create App.tsx
      const appTsx = `import React from 'react';
import './styles/App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>${projectSpec.name}</h1>
        <p>${projectSpec.description}</p>
      </header>
    </div>
  );
}

export default App;
`;
      fs.writeFileSync(path.join(frontendDir, 'src', 'App.tsx'), appTsx);
      
      // Create index.tsx
      const indexTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
      fs.writeFileSync(path.join(frontendDir, 'src', 'index.tsx'), indexTsx);
      
      // Create CSS files
      const indexCss = `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
`;
      fs.writeFileSync(path.join(frontendDir, 'src', 'styles', 'index.css'), indexCss);
      
      const appCss = `.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
  color: white;
}
`;
      fs.writeFileSync(path.join(frontendDir, 'src', 'styles', 'App.css'), appCss);
      
      // Create tailwind.config.js if using tailwind
      if (projectSpec.frontend.styling === 'tailwind') {
        const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;
        fs.writeFileSync(path.join(frontendDir, 'tailwind.config.js'), tailwindConfig);
        
        const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
        fs.writeFileSync(path.join(frontendDir, 'postcss.config.js'), postcssConfig);
      }
    }
    
    // Create backend directory structure
    if (projectSpec.backend) {
      const backendDir = path.join(projectDir, 'backend');
      fs.mkdirSync(backendDir, { recursive: true });
      fs.mkdirSync(path.join(backendDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(backendDir, 'src', 'models'), { recursive: true });
      fs.mkdirSync(path.join(backendDir, 'src', 'routes'), { recursive: true });
      fs.mkdirSync(path.join(backendDir, 'src', 'controllers'), { recursive: true });
      fs.mkdirSync(path.join(backendDir, 'src', 'middleware'), { recursive: true });
      
      // Create backend package.json
      const backendPackageJson: any = {
        name: `${projectSpec.name.toLowerCase().replace(/\s+/g, '-')}-backend`,
        version: '0.1.0',
        private: true,
        scripts: {
          'dev': 'ts-node-dev --respawn --transpile-only src/index.ts',
          'build': 'tsc',
          'start': 'node dist/index.js'
        },
        dependencies: {
          'express': '^4.18.2',
          'cors': '^2.8.5',
          'dotenv': '^16.0.3',
          'helmet': '^6.0.1'
        },
        devDependencies: {
          '@types/express': '^4.17.17',
          '@types/cors': '^2.8.13',
          '@types/node': '^18.14.0',
          'ts-node-dev': '^2.0.0',
          'typescript': '^4.9.5'
        }
      };
      
      // Add database dependencies
      if (projectSpec.backend.database === 'mongodb' && projectSpec.backend.orm === 'mongoose') {
        backendPackageJson.dependencies = {
          ...backendPackageJson.dependencies,
          'mongoose': '^7.0.0'
        };
        backendPackageJson.devDependencies = {
          ...backendPackageJson.devDependencies,
          '@types/mongoose': '^5.11.97'
        };
      } else if (projectSpec.backend.database === 'postgresql' && projectSpec.backend.orm === 'typeorm') {
        backendPackageJson.dependencies = {
          ...backendPackageJson.dependencies,
          'typeorm': '^0.3.12',
          'pg': '^8.9.0',
          'reflect-metadata': '^0.1.13'
        };
        backendPackageJson.devDependencies = {
          ...backendPackageJson.devDependencies,
          '@types/pg': '^8.6.6'
        };
      }
      
      fs.writeFileSync(path.join(backendDir, 'package.json'), JSON.stringify(backendPackageJson, null, 2));
      
      // Create backend tsconfig.json
      const backendTsConfig = {
        compilerOptions: {
          target: 'es2018',
          module: 'commonjs',
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist']
      };
      fs.writeFileSync(path.join(backendDir, 'tsconfig.json'), JSON.stringify(backendTsConfig, null, 2));
      
      // Create .env file
      const envFile = `PORT=5000
NODE_ENV=development
${projectSpec.backend.database === 'mongodb' 
  ? 'MONGODB_URI=mongodb://localhost:27017/' + projectSpec.name.toLowerCase().replace(/\s+/g, '-')
  : projectSpec.backend.database === 'postgresql'
    ? 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/' + projectSpec.name.toLowerCase().replace(/\s+/g, '-')
    : ''}
`;
      fs.writeFileSync(path.join(backendDir, '.env'), envFile);
      
      // Create index.ts
      const indexTs = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
${projectSpec.backend.database === 'mongodb' && projectSpec.backend.orm === 'mongoose'
  ? "import mongoose from 'mongoose';"
  : projectSpec.backend.database === 'postgresql' && projectSpec.backend.orm === 'typeorm'
    ? "import { createConnection } from 'typeorm';\nimport 'reflect-metadata';"
    : ''}

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Connect to database
${projectSpec.backend.database === 'mongodb' && projectSpec.backend.orm === 'mongoose'
  ? `mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/${projectSpec.name.toLowerCase().replace(/\s+/g, '-')}')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));`
  : projectSpec.backend.database === 'postgresql' && projectSpec.backend.orm === 'typeorm'
    ? `createConnection()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Could not connect to PostgreSQL', err));`
    : '// No database connection configured'}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(\`Server running in \${process.env.NODE_ENV} mode on port \${PORT}\`);
});
`;
      fs.writeFileSync(path.join(backendDir, 'src', 'index.ts'), indexTs);
    }
    
    return projectDir;
  }
}

// Mock createRAGAgent function
function createMockRAGAgent(config: Partial<RAGAgentConfig> = {}): MockRAGAgentExtension {
  return new MockRAGAgentExtension(config);
}

// This is a conceptual example of how the project structure generation would work
async function main() {
  console.log('Starting Project Structure Generation Example...');
  
  // Initialize the RAG agent with configuration
  const config: Partial<RAGAgentConfig> = {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY || '',
    temperature: 0.7,
    codebasePath: './src',
    useInMemoryVectorStore: true
  };
  
  // Create the mock RAG agent
  const ragAgent = createMockRAGAgent(config);
  
  // Create a simple system
  const systemConfig = System.create('todo-system')
    .withName('Todo System')
    .withDescription('A system for managing todo items')
    .build();
  
  // Initialize the runtime and the agent
  const runtime = createRuntime(systemConfig);
  await ragAgent.initialize(runtime);
  
  // Create output directory
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('\n--- Generating Project Structure ---');
  
  // Define the project specification
  const todoProjectSpec = {
    name: 'Todo App',
    description: 'A simple todo application with React frontend and Express backend',
    frontend: {
      framework: 'react',
      components: ['TodoList', 'TodoItem', 'AddTodo'],
      styling: 'tailwind'
    },
    backend: {
      framework: 'express',
      database: 'mongodb',
      orm: 'mongoose'
    },
    api: {
      type: 'rest',
      endpoints: ['todos']
    }
  };
  
  try {
    // Generate the project structure
    const projectPath = await ragAgent.generateProjectStructure(todoProjectSpec, outputDir);
    console.log(`\nProject structure generated at: ${projectPath}`);
    
    // List the generated files
    console.log('\nGenerated project structure:');
    const listFiles = (dir: string, prefix = '') => {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          console.log(`${prefix}${file}/`);
          listFiles(filePath, `${prefix}  `);
        } else {
          console.log(`${prefix}${file}`);
        }
      });
    };
    listFiles(projectPath);
  } catch (error) {
    console.error('Error generating project structure:', error);
  }
  
  console.log('\n--- Example Complete ---');
  console.log('Note: This is a simulation. The actual implementation would be part of the RAGAgentExtension class.');
}

// Run the example
if (require.main === module) {
  main().catch(error => {
    console.error('Error in project structure generation example:', error);
    process.exit(1);
  });
}

export default main; 