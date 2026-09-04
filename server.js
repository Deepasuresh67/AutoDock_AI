const express = require('express');
const axios = require('axios');
require('dotenv').config();

let GoogleGenerativeAI = null;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (e) {}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHOB_TOKEN || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

async function githubGet(url, responseType = 'json') {
  const baseHeaders = {
    'User-Agent': 'Auto-Dock-It-App',
    'Accept': responseType === 'text' ? 'application/vnd.github.v3.raw' : 'application/vnd.github.v3+json'
  };

  if (GITHUB_TOKEN && GITHUB_TOKEN.trim() !== '') {
    const token = GITHUB_TOKEN.trim();
    const authHeader = token.startsWith('github_pat_') ? `Bearer ${token}` : `token ${token}`;
    try {
      return await axios.get(url, {
        headers: { ...baseHeaders, 'Authorization': authHeader },
        responseType,
        timeout: 8000
      });
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        console.warn(`GitHub auth issue (${err.response.status}) on ${url}. Retrying unauthenticated...`);
      } else {
        throw err;
      }
    }
  }

  return await axios.get(url, {
    headers: baseHeaders,
    responseType,
    timeout: 8000
  });
}

function parseGithubUrl(rawUrl) {
  if (!rawUrl) return null;
  let cleanUrl = rawUrl.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  
  const fullMatch = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)/i);
  if (fullMatch) {
    return { owner: fullMatch[1], repo: fullMatch[2] };
  }
  
  const shortMatch = cleanUrl.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }
  
  const parts = cleanUrl.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
  }
  return null;
}

// Generate smart Dockerfile fallback
function generateSmartDockerfile(primaryLang, keyFiles, languages) {
  if (keyFiles['Dockerfile']) {
    return keyFiles['Dockerfile'];
  }

  const lang = (primaryLang || 'javascript').toLowerCase();

  if (lang.includes('javascript') || lang.includes('typescript') || keyFiles['package.json']) {
    let pkg = {};
    try {
      if (keyFiles['package.json']) {
        pkg = JSON.parse(keyFiles['package.json']);
      }
    } catch (e) {}

    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const isNext = !!(deps['next']);
    const isReact = !!(deps['react'] && !deps['express']);
    const isVue = !!(deps['vue'] || deps['@vue/cli-service']);

    if (isNext) {
      return `# Auto-generated Dockerfile for Next.js
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]`;
    }

    if (isReact || isVue) {
      return `# Auto-generated Dockerfile for Single Page Application
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html || COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
    }

    return `# Auto-generated Dockerfile for Node.js Application
FROM node:18-alpine

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

EXPOSE 3000

USER node
CMD ["npm", "start"]`;
  }

  if (lang.includes('python') || keyFiles['requirements.txt'] || keyFiles['Pipfile'] || keyFiles['pyproject.toml']) {
    const reqs = (keyFiles['requirements.txt'] || '').toLowerCase();
    const isDjango = reqs.includes('django');
    const isFastAPI = reqs.includes('fastapi');
    const isFlask = reqs.includes('flask');

    let port = '8000';
    let cmd = '["python", "app.py"]';

    if (isDjango) {
      port = '8000';
      cmd = '["python", "manage.py", "runserver", "0.0.0.0:8000"]';
    } else if (isFastAPI) {
      port = '8000';
      cmd = '["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]';
    } else if (isFlask) {
      port = '5000';
      cmd = '["flask", "run", "--host=0.0.0.0"]';
    }

    return `# Auto-generated Dockerfile for Python Application
FROM python:3.10-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt || true

# Copy project files
COPY . .

EXPOSE ${port}

CMD ${cmd}`;
  }

  if (lang.includes('java') || keyFiles['pom.xml'] || keyFiles['build.gradle']) {
    if (keyFiles['pom.xml']) {
      return `# Auto-generated Dockerfile for Java Maven Application
FROM maven:3.8-openjdk-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests

FROM openjdk:17-slim
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]`;
    }

    return `# Auto-generated Dockerfile for Java Gradle Application
FROM gradle:7-jdk17 AS build
WORKDIR /app
COPY build.gradle settings.gradle ./
COPY src ./src
RUN gradle bootJar --no-daemon -x test || gradle build --no-daemon -x test

FROM openjdk:17-slim
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]`;
  }

  if (lang.includes('go') || keyFiles['go.mod']) {
    return `# Auto-generated Dockerfile for Go Application
FROM golang:1.20-alpine AS build
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server .

FROM alpine:latest
WORKDIR /app
RUN apk --no-cache add ca-certificates
COPY --from=build /app/server .
EXPOSE 8080
CMD ["./server"]`;
  }

  if (lang.includes('php') || keyFiles['composer.json']) {
    return `# Auto-generated Dockerfile for PHP Application
FROM php:8.1-apache
WORKDIR /var/www/html
RUN a2enmod rewrite
COPY . .
EXPOSE 80
CMD ["apache2-foreground"]`;
  }

  if (lang.includes('ruby') || keyFiles['Gemfile']) {
    return `# Auto-generated Dockerfile for Ruby Application
FROM ruby:3.1-slim
WORKDIR /app
COPY Gemfile* ./
RUN bundle install
COPY . .
EXPOSE 3000
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]`;
  }

  if (lang.includes('rust') || keyFiles['Cargo.toml']) {
    return `# Auto-generated Dockerfile for Rust Application
FROM rust:1.70-alpine AS builder
WORKDIR /app
COPY Cargo.* ./
COPY src ./src
RUN cargo build --release

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/target/release/* /app/
EXPOSE 8080
CMD ["/app/app"]`;
  }

  return `# Auto-generated Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`;
}

function detectTechStack(primaryLang, keyFiles, languages) {
  const parts = [];
  if (primaryLang) parts.push(primaryLang);

  if (keyFiles['package.json']) {
    try {
      const pkg = JSON.parse(keyFiles['package.json']);
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.react) parts.push('React');
      if (deps.vue) parts.push('Vue');
      if (deps.next) parts.push('Next.js');
      if (deps.express) parts.push('Express.js');
      if (deps.tailwindcss) parts.push('Tailwind CSS');
      if (deps.typescript) parts.push('TypeScript');
      if (deps.prisma) parts.push('Prisma');
    } catch (e) {}
  }

  if (keyFiles['requirements.txt']) {
    const reqs = keyFiles['requirements.txt'].toLowerCase();
    if (reqs.includes('django')) parts.push('Django');
    if (reqs.includes('flask')) parts.push('Flask');
    if (reqs.includes('fastapi')) parts.push('FastAPI');
    if (reqs.includes('torch') || reqs.includes('pytorch')) parts.push('PyTorch');
    if (reqs.includes('tensorflow')) parts.push('TensorFlow');
  }

  if (keyFiles['pom.xml'] && keyFiles['pom.xml'].includes('spring-boot')) {
    parts.push('Spring Boot');
  }

  return parts.length > 0 ? parts.join(' • ') : (primaryLang || 'General Purpose');
}

function determineComplexity(fileCount, languages, keyFiles) {
  const langCount = Object.keys(languages || {}).length;
  const hasDocker = !!(keyFiles['Dockerfile'] || keyFiles['docker-compose.yml']);
  
  if (fileCount > 25 || langCount > 4 || hasDocker) {
    return 'Advanced / High (Multi-layered architecture)';
  } else if (fileCount > 8 || langCount > 2) {
    return 'Intermediate (Standard modular architecture)';
  } else {
    return 'Compact / Starter (Streamlined single-purpose codebase)';
  }
}

function generateImprovements(primaryLang, keyFiles) {
  const suggestions = [];
  if (!keyFiles['Dockerfile']) {
    suggestions.push('Add multi-stage Dockerfile for minimized production image footprints.');
  }
  if (!keyFiles['docker-compose.yml']) {
    suggestions.push('Add docker-compose.yml for one-click local multi-service orchestration.');
  }
  if (!keyFiles['.github/workflows'] && !keyFiles['.gitlab-ci.yml']) {
    suggestions.push('Set up automated CI/CD workflows for testing and container image publishing.');
  }
  if (keyFiles['package.json'] && !keyFiles['package.json'].includes('"test"')) {
    suggestions.push('Add automated unit and integration tests (e.g. Jest, Vitest, Pytest).');
  }
  suggestions.push('Configure container healthcheck probes for zero-downtime rolling deployments.');
  return suggestions.slice(0, 3).join(' ');
}

async function runGeminiPrompt(prompt) {
  if (!GEMINI_API_KEY || !GoogleGenerativeAI) return null;
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.trim());
  const candidateModels = ['gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-2.5-flash-native-audio-latest'];

  for (const mName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: mName });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text) return { text, modelName: mName };
    } catch (err) {
      console.warn(`Gemini model ${mName} error:`, err.message);
    }
  }
  return null;
}

// LLM Generator (Gemini / OpenAI with smart fallback)
async function generateLLMAnalysis(owner, repo, languages, keyFiles, repoData) {
  const langSummary = Object.entries(languages).map(([k, v]) => `${k} (${v} bytes)`).join(', ');
  const detectedConfigFiles = Object.keys(keyFiles).join(', ') || 'None';

  // 1. Try Google Gemini API
  if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== '' && GoogleGenerativeAI) {
    try {
      const prompt = `You are an expert Cloud DevOps & Software Architect.
Analyze this GitHub repository and provide concise, high-value structured insights:
Repository: ${owner}/${repo}
Description: ${repoData.description || 'None'}
Primary Language: ${repoData.language || 'Unknown'}
Languages breakdown: ${langSummary}
Configuration Files detected: ${detectedConfigFiles}
Sample key files content preview:
${Object.entries(keyFiles).map(([k, v]) => `--- ${k} ---\n${v.slice(0, 400)}`).join('\n')}

Respond with a JSON object strictly in this format:
{
  "tech_stack": "<concise detected tech stack, e.g. Node.js with Express & TypeScript>",
  "complexity": "<Complexity rating e.g. Intermediate (Microservices pattern)>",
  "improvements": "<2-3 actionable DevOps, performance, and containerization suggestions>",
  "dockerfile": "<Complete, multi-stage, production-optimized Dockerfile for this repo>",
  "security_insights": "<1-2 security best practice recommendations for containerizing this repo>"
}`;

      const geminiRes = await runGeminiPrompt(prompt);
      if (geminiRes && geminiRes.text) {
        const jsonMatch = geminiRes.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            ...parsed,
            ai_provider: `Google ${geminiRes.modelName}`
          };
        }
      }
    } catch (geminiErr) {
      console.warn('Gemini API call error:', geminiErr.message);
    }
  }

  // 2. Try OpenAI API
  if (OPENAI_API_KEY && OPENAI_API_KEY.trim() !== '') {
    try {
      const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'You are an expert Cloud DevOps Architect. Return only valid JSON.'
        }, {
          role: 'user',
          content: `Analyze repository ${owner}/${repo} (${repoData.description}). Languages: ${langSummary}. Detected configs: ${detectedConfigFiles}. Provide JSON: {"tech_stack":"","complexity":"","improvements":"","dockerfile":"","security_insights":""}`
        }],
        temperature: 0.2
      }, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY.trim()}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const text = res.data.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...parsed,
          ai_provider: 'OpenAI GPT-4o-mini'
        };
      }
    } catch (openaiErr) {
      console.warn('OpenAI API call error:', openaiErr.message);
    }
  }

  // 3. Fallback: High-Speed Smart Heuristic AI Engine
  const primaryLang = Object.keys(languages)[0] || repoData.language || 'JavaScript';
  return {
    tech_stack: detectTechStack(primaryLang, keyFiles, languages),
    complexity: determineComplexity(Object.keys(keyFiles).length, languages, keyFiles),
    improvements: generateImprovements(primaryLang, keyFiles),
    dockerfile: generateSmartDockerfile(primaryLang, keyFiles, languages),
    security_insights: 'Use non-root user in container execution, pin base image versions, and scan dependencies with Snyk or Trivy.',
    ai_provider: 'Smart Heuristic Engine'
  };
}

// POST /analyze
app.post('/analyze', async (req, res) => {
  try {
    const { repo_url, ai_analysis } = req.body;
    const parsed = parseGithubUrl(repo_url);

    if (!parsed) {
      return res.status(400).json({ error: 'Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo)' });
    }

    const { owner, repo } = parsed;

    // 1. Fetch Repository Details
    let repoData;
    try {
      const repoRes = await githubGet(`https://api.github.com/repos/${owner}/${repo}`);
      repoData = repoRes.data;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return res.status(404).json({ error: `Repository "${owner}/${repo}" was not found or is private.` });
      } else if (err.response && err.response.status === 403) {
        console.warn('GitHub API rate limit hit or forbidden:', err.response.data);
        return res.json({
          owner: {
            login: owner,
            avatar_url: `https://github.com/${owner}.png`,
            type: 'User',
            url: `https://github.com/${owner}`,
            repo_url: `https://github.com/${owner}/${repo}`,
            repo_name: repo,
            description: 'Public GitHub Repository',
            stars: 0,
            forks: 0
          },
          languages: [{ name: 'JavaScript', percent: '100.0' }],
          ai_analysis: {
            tech_stack: 'JavaScript / Web Application',
            complexity: 'Standard Application',
            improvements: 'Add automated containerization and CI/CD pipelines.',
            dockerfile: generateSmartDockerfile('javascript', {}, {}),
            ai_provider: 'Smart Heuristic Engine'
          },
          warning: 'GitHub API rate limit encountered. Displayed baseline analysis.'
        });
      }
      throw err;
    }

    // 2. Fetch Languages
    let languages = {};
    try {
      const langRes = await githubGet(`https://api.github.com/repos/${owner}/${repo}/languages`);
      languages = langRes.data || {};
    } catch (e) {
      console.warn('Could not fetch languages:', e.message);
    }

    const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0);
    const languageData = totalBytes > 0
      ? Object.entries(languages).map(([name, bytes]) => ({
          name,
          percent: ((bytes / totalBytes) * 100).toFixed(1)
        }))
      : [{ name: repoData.language || 'JavaScript', percent: '100.0' }];

    // 3. Fetch Root Contents & Key Files
    const keyFiles = {};
    let fileCount = 0;
    try {
      const contentsRes = await githubGet(`https://api.github.com/repos/${owner}/${repo}/contents`);
      const items = Array.isArray(contentsRes.data) ? contentsRes.data : [];
      fileCount = items.length;

      const targetFiles = [
        'package.json', 'requirements.txt', 'Dockerfile', 'docker-compose.yml',
        'pom.xml', 'build.gradle', 'go.mod', 'composer.json', 'Gemfile', 'Cargo.toml',
        '.env.example'
      ];

      for (const item of items) {
        if (item.type === 'file' && targetFiles.includes(item.name)) {
          if (item.download_url) {
            try {
              const fileRes = await githubGet(item.download_url, 'text');
              keyFiles[item.name] = typeof fileRes.data === 'string' ? fileRes.data : JSON.stringify(fileRes.data);
            } catch (fe) {
              console.warn(`Failed fetching file ${item.name}:`, fe.message);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch repository contents:', e.message);
    }

    // 4. Generate AI Analysis
    const aiAnalysisResult = await generateLLMAnalysis(owner, repo, languages, keyFiles, repoData);

    const responsePayload = {
      owner: {
        login: repoData.owner ? repoData.owner.login : owner,
        avatar_url: repoData.owner ? repoData.owner.avatar_url : `https://github.com/${owner}.png`,
        type: repoData.owner ? repoData.owner.type : 'User',
        url: repoData.owner ? repoData.owner.html_url : `https://github.com/${owner}`,
        repo_url: repoData.html_url || `https://github.com/${owner}/${repo}`,
        repo_name: repoData.name || repo,
        description: repoData.description || 'No description provided.',
        stars: repoData.stargazers_count || 0,
        forks: repoData.forks_count || 0,
        open_issues: repoData.open_issues_count || 0,
        license: repoData.license ? (repoData.license.spdx_id || repoData.license.name) : 'None',
        default_branch: repoData.default_branch || 'main'
      },
      languages: languageData,
      ai_analysis: aiAnalysisResult,
      repo_summary: {
        owner,
        repo,
        fileCount,
        detected_keys: Object.keys(keyFiles)
      }
    };

    res.json(responsePayload);

  } catch (error) {
    console.error('Analysis error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to analyze repository' });
  }
});

// Interactive AI Chat about Repository
app.post('/api/ai-chat', async (req, res) => {
  const { question, repo_context } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  const contextStr = repo_context ? `Context about repository: ${JSON.stringify(repo_context)}` : '';

  if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== '' && GoogleGenerativeAI) {
    try {
      const prompt = `You are an AI DevOps & Cloud Architect assistant.
${contextStr}

User question: ${question}

Provide a helpful, clear, and actionable response with code blocks where appropriate.`;

      const geminiRes = await runGeminiPrompt(prompt);
      if (geminiRes && geminiRes.text) {
        return res.json({ answer: geminiRes.text, provider: `Google ${geminiRes.modelName}` });
      }
    } catch (e) {
      console.warn('Gemini chat error:', e.message);
    }
  }

  if (OPENAI_API_KEY && OPENAI_API_KEY.trim() !== '') {
    try {
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an AI DevOps Architect assistant.' },
          { role: 'user', content: `${contextStr}\n\nQuestion: ${question}` }
        ]
      }, {
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY.trim()}` }
      });
      return res.json({ answer: resp.data.choices[0].message.content, provider: 'OpenAI GPT-4o' });
    } catch (e) {
      console.warn('OpenAI chat error:', e.message);
    }
  }

  // Smart fallback answer generator
  return res.json({
    answer: `💡 **AI Advice for ${repo_context?.repo_name || 'your application'}**:\n\n` +
            `To deploy this containerized application in production:\n` +
            `1. **Build the container**: \`docker build -t app:latest .\`\n` +
            `2. **Run with health checks**: \`docker run -d -p 3000:3000 --restart always app:latest\`\n` +
            `3. **Configure CI/CD**: Add GitHub Actions in \`.github/workflows/deploy.yml\` to automate image build and push to container registries.\n\n` +
            `*(Tip: Add your \`GEMINI_API_KEY\` or \`OPENAI_API_KEY\` to \`.env\` to unlock live multi-turn LLM reasoning!)*`,
    provider: 'Built-in Architecture Advisor'
  });
});

// Proxy for fetching raw GitHub files
app.get('/github-raw', async (req, res) => {
  const { url, owner, repo, path } = req.query;
  
  let targetUrl = url;
  if (owner && repo && path) {
    targetUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  } else if (url && url.includes('raw.githubusercontent.com')) {
    const parts = url.replace('https://raw.githubusercontent.com/', '').split('/');
    if (parts.length >= 3) {
      const uOwner = parts[0];
      const uRepo = parts[1];
      const uPath = parts.slice(3).join('/');
      targetUrl = `https://api.github.com/repos/${uOwner}/${uRepo}/contents/${uPath}`;
    }
  }

  if (!targetUrl) {
    return res.status(400).send('Missing file target URL');
  }

  try {
    const response = await githubGet(targetUrl, 'text');
    let content = response.data;
    if (typeof content === 'object' && content !== null && content.content) {
      content = Buffer.from(content.content, 'base64').toString('utf8');
    }
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(typeof content === 'string' ? content : JSON.stringify(content));
  } catch (e) {
    res.status(500).send('Error fetching file content: ' + e.message);
  }
});

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    port: PORT,
    llm_configured: !!(GEMINI_API_KEY || OPENAI_API_KEY)
  });
});

app.listen(PORT, () => {
  console.log(`Auto-Dock It server running on http://localhost:${PORT}`);
});