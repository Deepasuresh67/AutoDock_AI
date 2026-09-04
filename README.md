# 🚀 Auto-Dock It — GitHub Repo Analyzer & AI Containerizer

<div align="center">

![Auto-Dock It Banner](https://img.shields.io/badge/Auto--Dock%20It-v2.0.0-6e48aa?style=for-the-badge&logo=docker&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-23+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-3.7%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

<p align="center">
  <b>Analyze any GitHub repository, inspect code, run in-browser linters, synthesize production Dockerfiles, and simulate cloud deployments with Google Gemini AI.</b>
</p>

[Features](#-key-features) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start) • [API Endpoints](#-api-endpoints) • [Supported Presets](#-supported-presets)

</div>

---

## 📖 Overview

**Auto-Dock It** is an all-in-one developer platform designed to streamline repository analysis, containerization, and deployment. By entering any public GitHub URL (e.g., `expressjs/express`, `facebook/react`, `pallets/flask`), the platform automatically:

1. **Analyzes Repository Architecture**: Fetches stats, owner info, and creates an interactive **Chart.js** language distribution chart.
2. **Generates AI Insights**: Leverages **Google Gemini 3.7 Flash** to inspect configuration files, detect tech stacks, evaluate complexity, and advise on DevOps best practices.
3. **Interactive AI DevOps Assistant**: Ask any question about the repository (e.g. Helm charts, database integrations, scaling) with live answers.
4. **Synthesizes Multi-Stage Dockerfiles**: Auto-generates production-ready, security-hardened Dockerfiles with support for in-browser editing and instant download.
5. **Inspects Source Code & Lints Bugs**: Features in-browser **ESLint** scanning and **html2canvas** code image card rendering.
6. **Simulates Container Deployments**: Interactive local container execution simulation plus copy-ready CLI runbooks for AWS, GCP, Azure, and DigitalOcean.

---

## ✨ Key Features

### 📊 1. Repository Analyzer
- **GitHub Metadata**: Real-time stats for stars, forks, open issues, license, and default branches.
- **Language Donut Chart**: Dynamic byte breakdown rendered with Chart.js.
- **AI Architecture Diagnosis**: Framework detection, complexity rating, and security recommendations.
- **💬 Ask AI Architect**: Live conversational assistant powered by Google Gemini.

### 💻 2. Code Viewer & Bug Hunter
- **In-Browser ESLint Bug Detector**: Uses `eslint4b` to statically analyze JavaScript/TypeScript files in the browser without server dependencies.
- **Code Image Exporter**: Uses `html2canvas` to convert code snippets into high-resolution PNG image cards.
- **Secure File Proxy**: Fetches repository source files safely without CORS issues.

### 🐳 3. Interactive Dockerfile Editor
- **Multi-Stage Optimization**: Minimalist Alpine/Slim images, dependency layer caching, and non-root user execution.
- **Template Switcher**: Instant switching between presets (Node.js, Next.js, React SPA, Python Flask/Django/FastAPI, Java Maven, Go, Rust, PHP).
- **Editor Controls**: Live code editing, syntax preservation, copy-to-clipboard, and `.download` trigger.

### 🚀 4. Deployment Hub
- **Local Container Simulator**: Step-by-step terminal execution animation with live health status, port mapping, and generated local URLs.
- **Multi-Cloud Runbooks**: Pre-configured deployment commands for:
  - **Google Cloud Run** (`gcloud run deploy`)
  - **AWS ECS / App Runner** (`aws apprunner`)
  - **Azure Container Apps** (`az containerapp`)
  - **DigitalOcean App Platform** (`doctl apps`)

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **AI / LLM** | Google Gemini 3.7 Flash (`@google/generative-ai`), OpenAI GPT-4o compatibility |
| **Backend** | Node.js, Express 5, Axios, Dotenv |
| **Frontend** | HTML5, Responsive CSS3 (Grid & Flexbox), Vanilla JavaScript (ES6+) |
| **Visualizations** | [Chart.js](https://www.chartjs.org/) |
| **Code Image Export** | [html2canvas](https://html2canvas.hertzen.com/) |
| **Static Code Linter**| [eslint4b](https://github.com/mysticatea/eslint4b) |
| **API** | GitHub REST API v3 |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18.x or higher)
- **npm** (v9.x or higher)

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/hackfinity.git
cd hackfinity
npm install
```

### 3. Environment Configuration

Create or update your `.env` file in the root directory:

```env
PORT=3000
GITHUB_TOKEN=your_github_personal_access_token_optional
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_optional
```

> **Note:** The app works out of the box even without API keys using its built-in smart heuristic analysis engine.

### 4. Run the Application

Start the local server:

```bash
node server.js
```

Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/analyze` | Analyzes GitHub repository, fetches languages, files, and runs Gemini AI synthesis. |
| `POST` | `/api/ai-chat` | Interactive AI Architect assistant answering questions about the repository. |
| `GET` | `/github-raw` | Safe proxy to stream raw file content from GitHub avoiding browser CORS. |
| `GET` | `/api/health` | Health check endpoint returning server status and LLM configuration state. |

---

## 📦 Supported Presets

* **Node.js**: Production multi-stage Alpine build with `node` non-root user.
* **Next.js**: Multi-stage standalone output optimization.
* **React / Vue SPA**: Build stage + lightweight Nginx web server.
* **Python Flask**: Gunicorn WSGI server on Python 3.10 slim.
* **Python Django**: Automated `manage.py runserver` container.
* **Python FastAPI**: Uvicorn ASGI server with hot-reload config.
* **Java**: Maven/Gradle multi-stage build with OpenJDK 17 slim.
* **Go**: CGO-disabled static binary on Alpine.
* **Rust**: Release build binary on Alpine.
* **PHP**: PHP 8.1 with Apache `mod_rewrite`.

---

## 📁 Project Structure

```text
hackfinity/
├── .env                  # API keys and environment configuration
├── package.json          # Node.js dependencies and scripts
├── server.js             # Express backend server & Gemini AI pipeline
├── index.html            # Single-page application UI with 4 tab views
├── style.css             # Responsive styling, gradients, and component styles
├── script.js             # Client state, Chart.js, ESLint, and UI handlers
└── README.md             # Project documentation
```

---

## 📄 License

This project is licensed under the **MIT License** — feel free to use and modify for your own projects!

---

<div align="center">
  <b>Built with ❤️ for Hackfinity</b>
</div>
