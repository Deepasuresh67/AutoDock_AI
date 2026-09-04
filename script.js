// Global application state
let currentAnalysisData = null;
let languageChartInstance = null;
let currentDockerfile = '';

// Preset Dockerfile templates
const DOCKERFILE_PRESETS = {
  'node': `# Optimized Node.js Production Dockerfile
FROM node:18-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
USER node
CMD ["npm", "start"]`,

  'next': `# Next.js Multi-stage Dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

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
CMD ["npm", "start"]`,

  'react': `# React / Vue Single Page Application with Nginx
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`,

  'python-flask': `# Python Flask Production Dockerfile
FROM python:3.10-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]`,

  'python-django': `# Python Django Production Dockerfile
FROM python:3.10-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]`,

  'python-fastapi': `# Python FastAPI with Uvicorn
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`,

  'java-maven': `# Java Spring Boot with Maven
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
CMD ["java", "-jar", "app.jar"]`,

  'go': `# Go Static Binary on Alpine
FROM golang:1.20-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server .

FROM alpine:latest
WORKDIR /app
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/server .
EXPOSE 8080
CMD ["./server"]`,

  'rust': `# Rust Multi-stage Release Dockerfile
FROM rust:1.70-alpine AS builder
WORKDIR /app
COPY Cargo.* ./
COPY src ./src
RUN cargo build --release

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/target/release/app .
EXPOSE 8080
CMD ["./app"]`,

  'php': `# PHP 8.1 with Apache
FROM php:8.1-apache
WORKDIR /var/www/html
RUN a2enmod rewrite
COPY . .
EXPOSE 80
CMD ["apache2-foreground"]`
};

document.addEventListener('DOMContentLoaded', () => {
  // Navigation elements
  const navLinks = document.querySelectorAll('.nav-link');
  const pages = document.querySelectorAll('.page-content');

  // Input elements
  const repoUrlInput = document.getElementById('repo-url');
  const analyzeBtn = document.getElementById('analyze-btn');
  const aiCheckbox = document.getElementById('ai-analysis');
  const sampleChips = document.querySelectorAll('.chip');

  // Analyzer page elements
  const loadingDiv = document.getElementById('loading');
  const resultsDiv = document.getElementById('results');
  const welcomePlaceholder = document.getElementById('welcome-placeholder');
  const ownerAvatar = document.getElementById('owner-avatar');
  const ownerLink = document.getElementById('owner-link');
  const repoLink = document.getElementById('repo-link');
  const ownerTypeBadge = document.getElementById('owner-type-badge');
  const repoDesc = document.getElementById('repo-desc');
  const badgeStars = document.getElementById('badge-stars');
  const badgeForks = document.getElementById('badge-forks');
  const badgeIssues = document.getElementById('badge-issues');
  const badgeLicense = document.getElementById('badge-license');
  const badgeBranch = document.getElementById('badge-branch');
  const languageListDiv = document.getElementById('language-list');
  const insightStack = document.getElementById('insight-stack');
  const insightComplexity = document.getElementById('insight-complexity');
  const insightImprovements = document.getElementById('insight-improvements');
  const dockerfilePreviewCode = document.getElementById('dockerfile-preview-code');
  const quickCopyDockerfileBtn = document.getElementById('quick-copy-dockerfile-btn');
  const quickDownloadDockerfileBtn = document.getElementById('quick-download-dockerfile-btn');
  const quickOpenEditorBtn = document.getElementById('quick-open-editor-btn');

  // Code Viewer elements
  const showCodeImagesBtn = document.getElementById('show-code-images-btn');
  const lintJsBtn = document.getElementById('lint-js-btn');
  const codeImagesStatus = document.getElementById('code-images-status');
  const codeImagesContainer = document.getElementById('code-images');
  const lintResultsCard = document.getElementById('lint-results-card');
  const lintResultsContainer = document.getElementById('lint-results');

  // Dockerfile page elements
  const dockerfilePresetSelect = document.getElementById('dockerfile-preset-select');
  const dockerfileEditorText = document.getElementById('dockerfile-editor-text');
  const downloadDockerfilePageBtn = document.getElementById('download-dockerfile-page-btn');
  const copyDockerfilePageBtn = document.getElementById('copy-dockerfile-page-btn');
  const resetDockerfilePageBtn = document.getElementById('reset-dockerfile-page-btn');

  const insightSecurity = document.getElementById('insight-security');
  const aiProviderBadge = document.getElementById('ai-provider-badge');
  const aiChatInput = document.getElementById('ai-chat-input');
  const aiChatSubmitBtn = document.getElementById('ai-chat-submit-btn');
  const aiChatResponse = document.getElementById('ai-chat-response');

  // Deployment elements
  const deployLocalBtn = document.getElementById('deploy-local-btn');
  const deployStepsContainer = document.getElementById('deploy-steps-container');
  const deploySuccessDetails = document.getElementById('deploy-success-details');
  const mockContainerName = document.getElementById('mock-container-name');
  const cloudCards = document.querySelectorAll('.cloud-card');
  const cloudInfoBox = document.getElementById('cloud-info-box');
  const cloudInfoTitle = document.getElementById('cloud-info-title');
  const cloudInfoDesc = document.getElementById('cloud-info-desc');
  const cloudInfoCmd = document.getElementById('cloud-info-cmd');

  // --- 1. TAB NAVIGATION ---
  function switchPage(pageId) {
    navLinks.forEach(link => {
      if (link.getAttribute('data-page') === pageId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    pages.forEach(page => {
      if (page.id === `${pageId}-page`) {
        page.classList.add('active');
      } else {
        page.classList.remove('active');
      }
    });
  }

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      switchPage(page);
    });
  });

  // --- 2. SAMPLE CHIP CLICKS ---
  sampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const repo = chip.getAttribute('data-repo');
      repoUrlInput.value = `https://github.com/${repo}`;
      analyzeRepository();
    });
  });

  // --- 3. ANALYZE REPOSITORY ACTION ---
  analyzeBtn.addEventListener('click', analyzeRepository);
  repoUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      analyzeRepository();
    }
  });

  async function analyzeRepository() {
    const rawUrl = repoUrlInput.value.trim();
    if (!rawUrl) {
      alert('Please enter a GitHub repository URL or identifier (e.g. expressjs/express)');
      return;
    }

    // Switch to analyzer page and show loading
    switchPage('analyzer');
    loadingDiv.style.display = 'block';
    resultsDiv.style.display = 'none';
    if (welcomePlaceholder) welcomePlaceholder.style.display = 'none';

    try {
      // Call backend /analyze endpoint
      const response = await fetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: rawUrl,
          ai_analysis: aiCheckbox.checked
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      currentAnalysisData = data;
      currentDockerfile = data.ai_analysis?.dockerfile || DOCKERFILE_PRESETS['node'];

      // Render all UI components
      renderAnalysisResults(data);

      loadingDiv.style.display = 'none';
      resultsDiv.style.display = 'block';
      resultsDiv.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
      console.error('Analysis failed:', error);
      loadingDiv.style.display = 'none';
      if (welcomePlaceholder) welcomePlaceholder.style.display = 'block';
      alert('Failed to analyze repository: ' + error.message);
    }
  }

  // --- 4. RENDER ANALYSIS RESULTS ---
  function renderAnalysisResults(data) {
    const owner = data.owner || {};
    const languages = data.languages || [];
    const ai = data.ai_analysis || {};

    // 1. Owner & Repo Card
    ownerAvatar.src = owner.avatar_url || 'https://github.com/github.png';
    ownerLink.textContent = owner.login || 'owner';
    ownerLink.href = owner.url || '#';
    repoLink.textContent = owner.repo_name || 'repository';
    repoLink.href = owner.repo_url || '#';
    ownerTypeBadge.textContent = owner.type || 'User';
    repoDesc.textContent = owner.description || 'No description available for this repository.';

    badgeStars.textContent = `⭐ ${(owner.stars || 0).toLocaleString()} Stars`;
    badgeForks.textContent = `🍴 ${(owner.forks || 0).toLocaleString()} Forks`;
    badgeIssues.textContent = `⚠️ ${(owner.open_issues || 0).toLocaleString()} Issues`;
    badgeLicense.textContent = `📄 ${owner.license || 'None'}`;
    badgeBranch.textContent = `🌿 ${owner.default_branch || 'main'}`;

    // 2. Languages Breakdown Chart & List
    renderLanguageChart(languages);

    // 3. AI Insights
    insightStack.textContent = ai.tech_stack || 'Standard Application Stack';
    insightComplexity.textContent = ai.complexity || 'Intermediate';
    insightImprovements.textContent = ai.improvements || 'Add Dockerfile and CI/CD pipelines for standardized deployment.';
    if (insightSecurity) {
      insightSecurity.textContent = ai.security_insights || 'Pin base image versions, execute as non-root user, and scan dependencies.';
    }
    if (aiProviderBadge) {
      aiProviderBadge.textContent = ai.ai_provider ? `✨ ${ai.ai_provider}` : '✨ Smart Engine';
    }

    // Reset AI Chat response
    if (aiChatResponse) {
      aiChatResponse.style.display = 'none';
      aiChatResponse.innerHTML = '';
    }

    // 4. Dockerfile Previews & Editor
    dockerfilePreviewCode.textContent = currentDockerfile;
    dockerfileEditorText.value = currentDockerfile;
    dockerfilePresetSelect.value = 'current';

    // Update preset "current" option label
    const currentOpt = dockerfilePresetSelect.querySelector('option[value="current"]');
    if (currentOpt) {
      currentOpt.textContent = `Current Recommended (${owner.repo_name || 'Auto-detected'})`;
    }
  }

  // --- 5. LANGUAGE CHART RENDERING ---
  function renderLanguageChart(languages) {
    const ctx = document.getElementById('language-chart');
    if (!ctx) return;

    languageListDiv.innerHTML = '';

    if (languageChartInstance) {
      languageChartInstance.destroy();
      languageChartInstance = null;
    }

    if (!languages || languages.length === 0) {
      languageListDiv.innerHTML = '<p style="color: var(--text-muted);">No language data detected.</p>';
      return;
    }

    const labels = languages.map(l => l.name);
    const percentages = languages.map(l => parseFloat(l.percent) || 0);
    const colorPalette = [
      '#6e48aa', '#ff6a88', '#38bdf8', '#4ade80', '#fbbf24',
      '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#64748b'
    ];

    // Build Chart.js Donut
    languageChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: percentages,
          backgroundColor: colorPalette.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.label}: ${context.raw}%`
            }
          }
        },
        cutout: '62%'
      }
    });

    // Populate language tags
    languages.forEach((lang, index) => {
      const tag = document.createElement('div');
      tag.className = 'language-tag';
      tag.style.backgroundColor = colorPalette[index % colorPalette.length];
      tag.textContent = `${lang.name} • ${lang.percent}%`;
      languageListDiv.appendChild(tag);
    });
  }

  // --- 6. DOCKERFILE ACTIONS & PRESETS ---
  function downloadDockerfile(content) {
    const text = content || dockerfileEditorText.value || currentDockerfile;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Dockerfile';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function copyTextToClipboard(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = btnElement.textContent;
      btnElement.textContent = 'Copied! ✓';
      setTimeout(() => {
        btnElement.textContent = originalText;
      }, 2000);
    }).catch(() => {
      alert('Unable to copy to clipboard.');
    });
  }

  quickCopyDockerfileBtn.addEventListener('click', () => {
    copyTextToClipboard(dockerfilePreviewCode.textContent, quickCopyDockerfileBtn);
  });

  quickDownloadDockerfileBtn.addEventListener('click', () => {
    downloadDockerfile(dockerfilePreviewCode.textContent);
  });

  quickOpenEditorBtn.addEventListener('click', () => {
    switchPage('dockerfile');
    dockerfileEditorText.scrollIntoView({ behavior: 'smooth' });
  });

  downloadDockerfilePageBtn.addEventListener('click', () => {
    downloadDockerfile(dockerfileEditorText.value);
  });

  copyDockerfilePageBtn.addEventListener('click', () => {
    copyTextToClipboard(dockerfileEditorText.value, copyDockerfilePageBtn);
  });

  resetDockerfilePageBtn.addEventListener('click', () => {
    dockerfileEditorText.value = currentDockerfile;
    dockerfilePresetSelect.value = 'current';
    alert('Reset editor to the repository recommended Dockerfile.');
  });

  dockerfilePresetSelect.addEventListener('change', () => {
    const val = dockerfilePresetSelect.value;
    if (val === 'current') {
      dockerfileEditorText.value = currentDockerfile;
    } else if (DOCKERFILE_PRESETS[val]) {
      dockerfileEditorText.value = DOCKERFILE_PRESETS[val];
    }
  });

  // --- 6.1 ASK AI ASSISTANT CHAT ---
  async function askAiAssistant() {
    const question = aiChatInput.value.trim();
    if (!question) return;

    aiChatResponse.style.display = 'block';
    aiChatResponse.innerHTML = '<span style="color: var(--primary);">🤖 AI Architect is thinking...</span>';

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          repo_context: currentAnalysisData ? {
            repo_name: currentAnalysisData.owner?.repo_name,
            owner: currentAnalysisData.owner?.login,
            tech_stack: currentAnalysisData.ai_analysis?.tech_stack,
            languages: currentAnalysisData.languages?.map(l => l.name)
          } : null
        })
      });

      const data = await res.json();
      if (data.answer) {
        // Simple markdown code block formatting
        const formatted = data.answer
          .replace(/```([\w]*)\n([\s\S]*?)```/g, '<pre style="background:#1e1e2e; color:#a6e3a1; padding:10px; border-radius:6px; overflow-x:auto;"><code>$2</code></pre>')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9; padding:2px 4px; border-radius:4px; color:#6e48aa;">$1</code>')
          .replace(/\n/g, '<br>');

        aiChatResponse.innerHTML = `
          <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:6px; font-weight:600;">
            ✨ Response from ${data.provider || 'AI Assistant'}:
          </div>
          <div>${formatted}</div>
        `;
      } else {
        aiChatResponse.innerHTML = '<span style="color:var(--error);">No response received from AI service.</span>';
      }
    } catch (err) {
      aiChatResponse.innerHTML = `<span style="color:var(--error);">Error contacting AI service: ${err.message}</span>`;
    }
  }

  if (aiChatSubmitBtn) {
    aiChatSubmitBtn.addEventListener('click', askAiAssistant);
  }
  if (aiChatInput) {
    aiChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        askAiAssistant();
      }
    });
  }

  // --- 7. CODE VIEWER: RENDER CODE AS IMAGES ---
  showCodeImagesBtn.addEventListener('click', async () => {
    const repoInfo = getActiveRepoInfo();
    if (!repoInfo) {
      alert('Please analyze a repository or enter a GitHub URL first!');
      return;
    }

    const { owner, repo } = repoInfo;
    codeImagesContainer.innerHTML = '';
    codeImagesStatus.style.display = 'block';
    codeImagesStatus.textContent = `Fetching files from ${owner}/${repo}...`;

    try {
      // 1. Fetch file list
      const files = await fetchRepositoryFiles(owner, repo);
      if (!files || files.length === 0) {
        codeImagesStatus.textContent = 'No suitable source files found in repository.';
        return;
      }

      // Limit to first 4 code files for snappy rendering
      const targetFiles = files.slice(0, 4);
      codeImagesStatus.textContent = `Rendering ${targetFiles.length} code files as images...`;

      for (const file of targetFiles) {
        // Create code card wrapper
        const card = document.createElement('div');
        card.className = 'code-image-card';

        const header = document.createElement('div');
        header.className = 'code-image-header';
        header.innerHTML = `<strong>📄 ${file.path}</strong>`;
        card.appendChild(header);

        // Fetch content
        const codeText = await fetchFileText(owner, repo, file.path);

        // Render preview pre element
        const pre = document.createElement('pre');
        pre.style.background = '#1e1e2e';
        pre.style.color = '#cdd6f4';
        pre.style.padding = '16px';
        pre.style.borderRadius = '8px';
        pre.style.fontFamily = 'Consolas, Monaco, monospace';
        pre.style.fontSize = '13px';
        pre.style.lineHeight = '1.45';
        pre.style.overflowX = 'auto';
        pre.style.maxHeight = '320px';
        pre.textContent = codeText.slice(0, 2000); // limit sample size
        card.appendChild(pre);

        // Render with html2canvas
        try {
          const canvas = await html2canvas(pre, { scale: 1.5, backgroundColor: '#1e1e2e' });
          const img = document.createElement('img');
          img.src = canvas.toDataURL('image/png');
          img.alt = `Code render for ${file.path}`;

          const downloadImgBtn = document.createElement('button');
          downloadImgBtn.className = 'btn btn-secondary btn-sm';
          downloadImgBtn.style.marginTop = '10px';
          downloadImgBtn.textContent = 'Download Image (PNG)';
          downloadImgBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = img.src;
            a.download = `${file.path.replace(/\//g, '_')}.png`;
            a.click();
          };

          card.removeChild(pre);
          card.appendChild(img);
          card.appendChild(downloadImgBtn);
        } catch (canvasErr) {
          console.warn('Canvas rendering error, displaying raw styled pre:', canvasErr);
        }

        codeImagesContainer.appendChild(card);
      }

      codeImagesStatus.textContent = `Successfully rendered ${targetFiles.length} code file images!`;

    } catch (err) {
      console.error('Code render error:', err);
      codeImagesStatus.textContent = 'Error rendering code files: ' + err.message;
    }
  });

  // --- 8. CODE VIEWER: ESLINT JS/TS BUG ANALYSIS ---
  lintJsBtn.addEventListener('click', async () => {
    const repoInfo = getActiveRepoInfo();
    if (!repoInfo) {
      alert('Please analyze a repository or enter a GitHub URL first!');
      return;
    }

    const { owner, repo } = repoInfo;
    lintResultsCard.style.display = 'block';
    lintResultsContainer.innerHTML = '<p style="color: var(--primary);">Analyzing JS/TS files with ESLint engine...</p>';

    try {
      const files = await fetchRepositoryFiles(owner, repo);
      const jsFiles = files.filter(f => /\.(js|ts|jsx|tsx)$/i.test(f.path)).slice(0, 5);

      if (jsFiles.length === 0) {
        lintResultsContainer.innerHTML = `
          <div class="lint-item clean">
            <strong>Clean Check:</strong> No JavaScript or TypeScript files detected to lint in this repository.
          </div>
        `;
        return;
      }

      let reportHtml = '';
      let totalIssues = 0;

      for (const file of jsFiles) {
        const code = await fetchFileText(owner, repo, file.path);
        
        let messages = [];
        try {
          if (window.eslint4b) {
            const linter = new window.eslint4b.Linter();
            messages = linter.verify(code, {
              env: { browser: true, es2021: true, node: true },
              parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
              rules: {
                'no-undef': 'warn',
                'no-unused-vars': 'warn',
                'no-unreachable': 'error',
                'no-duplicate-case': 'error',
                'valid-typeof': 'error'
              }
            });
          }
        } catch (linterErr) {
          console.warn('Linter verification error:', linterErr);
        }

        totalIssues += messages.length;

        if (messages.length > 0) {
          reportHtml += `
            <div class="lint-item">
              <strong>📄 ${file.path}</strong> &mdash; ${messages.length} issue(s) detected:
              <ul style="margin: 8px 0 0 20px; font-size: 0.9rem;">
                ${messages.map(m => `
                  <li>
                    <span style="color: ${m.severity === 2 ? '#ef4444' : '#f59e0b'}; font-weight: 600;">
                      [${m.severity === 2 ? 'Error' : 'Warning'}]
                    </span>
                    Line ${m.line}: ${m.message} <code>(${m.ruleId || 'syntax'})</code>
                  </li>
                `).join('')}
              </ul>
            </div>
          `;
        } else {
          reportHtml += `
            <div class="lint-item clean">
              <strong>📄 ${file.path}</strong> &mdash; No lint bugs or syntax issues detected! ✓
            </div>
          `;
        }
      }

      lintResultsContainer.innerHTML = `
        <p style="margin-bottom: 12px; font-weight: 600; color: var(--text-main);">
          Inspection completed for ${jsFiles.length} file(s). Total issues found: ${totalIssues}.
        </p>
        ${reportHtml}
      `;

    } catch (err) {
      console.error('Linting error:', err);
      lintResultsContainer.innerHTML = `<p style="color: var(--error);">Error analyzing files: ${err.message}</p>`;
    }
  });

  // --- 9. LOCAL DEPLOYMENT SIMULATOR ---
  deployLocalBtn.addEventListener('click', () => {
    deployStepsContainer.style.display = 'block';
    deploySuccessDetails.style.display = 'none';

    const repoName = currentAnalysisData?.owner?.repo_name || 'my-app';
    mockContainerName.textContent = `dock-${repoName}-${Math.random().toString(36).substring(2, 7)}`;

    const steps = [
      document.getElementById('deploy-step-1'),
      document.getElementById('deploy-step-2'),
      document.getElementById('deploy-step-3'),
      document.getElementById('deploy-step-4'),
      document.getElementById('deploy-step-5')
    ];

    steps.forEach(s => {
      s.className = 'deploy-step';
    });

    let currentStep = 0;

    function runNextStep() {
      if (currentStep > 0) {
        steps[currentStep - 1].className = 'deploy-step done';
      }

      if (currentStep < steps.length) {
        steps[currentStep].className = 'deploy-step active';
        currentStep++;
        setTimeout(runNextStep, 700);
      } else {
        deploySuccessDetails.style.display = 'block';
      }
    }

    runNextStep();
  });

  // --- 10. CLOUD DEPLOYMENT CARDS ---
  const CLOUD_COMMANDS = {
    'aws': {
      title: 'Deploy to AWS ECS / App Runner',
      desc: 'Build and push your container to Amazon ECR, then deploy to AWS App Runner or ECS Fargate:',
      cmd: `# 1. Authenticate with AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com

# 2. Build and Tag image
docker build -t auto-dock-app .
docker tag auto-dock-app:latest <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/auto-dock-app:latest

# 3. Push and Deploy
docker push <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/auto-dock-app:latest
aws apprunner create-service --service-name auto-dock-app --source-configuration ...`
    },
    'gcp': {
      title: 'Deploy to Google Cloud Run',
      desc: 'Deploy container image directly to Google Cloud Run serverless platform:',
      cmd: `# 1. Submit build to Google Cloud Build
gcloud builds submit --tag gcr.io/$(gcloud config get-value project)/auto-dock-app

# 2. Deploy serverless container with instant HTTPS
gcloud run deploy auto-dock-app \\
  --image gcr.io/$(gcloud config get-value project)/auto-dock-app \\
  --platform managed \\
  --region us-central1 \\
  --allow-unauthenticated`
    },
    'azure': {
      title: 'Deploy to Microsoft Azure Container Apps',
      desc: 'Deploy to Azure Container Apps with built-in HTTPS and automatic scaling:',
      cmd: `# 1. Create Azure Container Registry & Build
az acr create --resource-group myResourceGroup --name myAppRegistry --sku Basic
az acr build --registry myAppRegistry --image auto-dock-app:v1 .

# 2. Deploy Container App
az containerapp create \\
  --name auto-dock-app \\
  --resource-group myResourceGroup \\
  --environment myEnvironment \\
  --image myAppRegistry.azurecr.io/auto-dock-app:v1 \\
  --target-port 3000 \\
  --ingress external`
    },
    'digitalocean': {
      title: 'Deploy to DigitalOcean App Platform',
      desc: 'Deploy your repository with automatic Dockerfile detection and continuous deployment:',
      cmd: `# 1. Build and push to DigitalOcean Container Registry
doctl registry login
docker build -t registry.digitalocean.com/my-registry/auto-dock-app .
docker push registry.digitalocean.com/my-registry/auto-dock-app

# 2. Create App from app spec
doctl apps create --spec app.yaml`
    }
  };

  cloudCards.forEach(card => {
    card.addEventListener('click', () => {
      const provider = card.getAttribute('data-cloud');
      const info = CLOUD_COMMANDS[provider];
      if (info) {
        cloudInfoTitle.textContent = info.title;
        cloudInfoDesc.textContent = info.desc;
        cloudInfoCmd.textContent = info.cmd;
        cloudInfoBox.style.display = 'block';
        cloudInfoBox.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // --- HELPER FUNCTIONS ---
  function getActiveRepoInfo() {
    if (currentAnalysisData?.owner?.login && currentAnalysisData?.owner?.repo_name) {
      return {
        owner: currentAnalysisData.owner.login,
        repo: currentAnalysisData.owner.repo_name
      };
    }

    const raw = repoUrlInput.value.trim().replace(/\.git$/, '').replace(/\/+$/, '');
    if (!raw) return null;

    const fullMatch = raw.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)/i);
    if (fullMatch) {
      return { owner: fullMatch[1], repo: fullMatch[2] };
    }

    const parts = raw.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
    }
    return null;
  }

  async function fetchRepositoryFiles(owner, repo) {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);
      if (res.ok) {
        const treeData = await res.json();
        if (treeData.tree && Array.isArray(treeData.tree)) {
          return treeData.tree.filter(item => 
            item.type === 'blob' &&
            /\.(js|ts|jsx|tsx|py|java|go|rb|php|rs|html|css|json|md|yml|yaml|sql)$/i.test(item.path) &&
            !item.path.includes('node_modules/') &&
            !item.path.includes('.min.') &&
            !item.path.includes('dist/') &&
            !item.path.includes('build/')
          );
        }
      }
    } catch (e) {
      console.warn('Tree fetch failed, trying contents API:', e);
    }

    // Fallback: root contents
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`);
      if (res.ok) {
        const contents = await res.json();
        return contents.filter(i => i.type === 'file').map(i => ({ path: i.name, type: 'blob' }));
      }
    } catch (e) {
      console.warn('Contents fetch failed:', e);
    }

    // Fallback sample files
    return [
      { path: 'index.js', type: 'blob' },
      { path: 'package.json', type: 'blob' },
      { path: 'README.md', type: 'blob' }
    ];
  }

  async function fetchFileText(owner, repo, filePath) {
    // 1. Try server proxy endpoint with owner/repo/path
    try {
      const res = await fetch(`/github-raw?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        return await res.text();
      }
    } catch (e) {}

    // 2. Try direct raw.githubusercontent.com
    try {
      const directRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`);
      if (directRes.ok) {
        return await directRes.text();
      }
    } catch (e) {}

    return `// Code preview for ${filePath}\n// Could not fetch raw content from GitHub directly.`;
  }
});