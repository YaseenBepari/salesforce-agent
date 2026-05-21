# ⚡ AI-Powered Salesforce Copilot – Intelligent Sidebar Assistant & Sandbox Simulator

An elite, context-aware AI assistant embedded directly inside Salesforce. It operates seamlessly across **Trailhead Playgrounds**, **Developer Orgs**, **Sandboxes**, and **Production environments**—and includes a standalone browser-based **Salesforce Sandbox Simulator** for offline testing and verification.

---

## ✨ Features

### 1. Context-Aware Assistant
* Understands active record context, Salesforce profiles, field-level security, metadata configurations, and formulas.
* Specialized reasoning agents:
  - **Metadata Agent**: Reviews schema definitions and validation rule formulas.
  - **Apex Agent**: Analyzes recursive code loops, trigger handlers, and optimization.
  - **Security Agent**: Identifies profile gaps and user provisioning workflows.
  - **SOQL Agent**: Formulates and executes highly selective database queries.
  - **Automation Agent**: Resolves order of execution conflicts and reviews flow diagrams.

### 2. Standalone Salesforce Simulator
* Glassmorphic, modern dashboard representing a live Salesforce sandbox.
* Dynamic tabs: sObject Layout, Apex Code Editor, Flow Node Graph, and Setup User List.
* Triggers context adjustments dynamically on field updates or tab switching.

### 3. Safe Action Execution Layer
* Prevents raw code mutations or sensitive operations without direct authorization.
* Intercepts provisioning instructions, generating interactive **Sidebar Approval Cards**.
* Logs every approved or rejected transaction into a local SQLite database for compliance auditing.

### 4. Chrome Extension (Manifest V3)
* Context scrapers injected into live `lightning.force.com` pages.
* Mounts a sleek floating drawer iframe displaying the React Copilot assistant.

---

## 🛠️ Architecture

* **Frontend**: React + Vite + TypeScript, styled with custom glassmorphic aesthetics and modern animations.
* **Backend**: FastAPI + Uvicorn server utilizing keyword-precedence routing and SSE (Server-Sent Events) streaming.
* **Database**: SQLite3 managing conversation histories and audit logs.
* **Extension**: Chrome Extension Manifest V3 injection architecture.

---

## 🚀 Getting Started

### Prerequisites
* **Python 3.10+**
* **Node.js 20+**

### Installation & Run
1. Clone the repository and install all dependencies:
   ```bash
   npm run install:all
   ```
2. Start both the FastAPI backend and React frontend concurrently:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to:
   - **Frontend Dashboard**: `http://localhost:5173`
   - **Backend API**: `http://localhost:8000`

---

## 🛡️ License
Distributed under the MIT License. See `LICENSE` for more details.
