# Product Requirements Document (PRD)

**Project Name:** Automated IT & System Design Short Video Generator  
**Document Version:** 1.0.0  
**Target Platforms:** YouTube Shorts, Instagram Reels, TikTok, LinkedIn Video  
**Author:** Engineering & Content Automation Team  

---

## 1. Executive Summary & Vision

The **Automated IT & System Design Short Video Generator** is a headless, programmatic media pipeline designed to convert complex software engineering, DevOps, and system architecture concepts into high-retention vertical short videos (9:16, 1080x1920). 

Instead of generic AI avatars or irrelevant stock B-roll, the platform generates authentic, dynamic architecture diagrams featuring glowing node states, real-time animated query counters, TTL countdowns, and data packet flows matching top-tier technical educational content.

---

## 2. Problem Statement & Market Need

* **High Production Friction:** Traditional creation of technical explainer reels requires 4–8 hours per video in After Effects, Premiere Pro, or Figma.
* **Lack of Real Technical Depth in Generic AI Video Tools:** Off-the-shelf automated video tools (e.g., InVideo, CapCut templates) use stock video clips that fail to illustrate software concepts like *Cache Stampede*, *Rate Limiting*, or *Database Sharding*.
* **Cost & Cloud Lock-in:** Commercial cloud rendering APIs and voice services become prohibitive when generating 30–60 shorts per month.
* **Solution:** A 100% free, locally runnable, and open-source-first pipeline using **Remotion (React)**, **Edge-TTS / Kokoro**, and **Python orchestration**.

---

## 3. Goals & Success Metrics

| Goal | Target Metric |
| :--- | :--- |
| **Render Speed** | < 60 seconds to render a 45-second 1080x1920 30FPS MP4 on consumer hardware. |
| **Automation Level** | 100% headless: Topic JSON in $\rightarrow$ Video MP4 out without manual timeline editing. |
| **Cost Efficiency** | $0.00 marginal cost per video using local TTS and local Remotion CLI. |
| **Visual Quality** | High-contrast dark theme (60-30-10 palette), crisp typography, smooth 30 FPS counter animations. |
| **Audience Retention** | Structured 4-phase pacing (Hook $\rightarrow$ Mechanism $\rightarrow$ Overload $\rightarrow$ Fix) targeted for >70% completion rate. |

---

## 4. User Personas

### Persona 1: Tech Content Creator ("DevRel / Solo Creator")
* **Profile:** Full-stack engineer or creator running a niche technical channel.
* **Goal:** Publish 1–2 technical reels daily without spending hours inside video editors.
* **Needs:** Pre-designed templates, conversational Hinglish/English audio, batch rendering from a CSV/JSON sheet.

### Persona 2: Automated Agency / Growth Hacker ("Pipeline Operator")
* **Profile:** Automation builder running multiple thematic faceless channels.
* **Goal:** Integrate headless rendering with n8n / GitHub Actions / Cron to auto-schedule uploads to YouTube & Instagram.
* **Needs:** Webhook triggers, structured JSON schemas, programmatic exit codes, zero manual clicks.

---

## 5. Functional Requirements & Feature Specifications

### 5.1 Content & Topic Schema (`topics.json`)
The system must accept a structured JSON definition containing both rendering parameters and voiceover scripts:
* `id`: Unique alphanumeric identifier (e.g., `cache_stampede`, `db_deadlock`).
* `title`: High-impact uppercase hook headline (Max 45 chars).
* `subtitle`: Secondary descriptive context / scenario label.
* `clientMax`: Target integer for peak client request simulation.
* `cacheNodeName`: Label of the middleware layer (e.g., `REDIS CACHE`, `API GATEWAY`).
* `cacheKey`: Simulated key or route name (e.g., `user_profile_123`).
* `cacheStatus`: Dynamic state label (e.g., `ACTIVE`, `CACHE EXPIRED`, `RATE LIMITED`).
* `cacheTtl`: Time-to-live string (e.g., `TTL: 0s`, `TTL: 60s`).
* `dbMax`: Target integer for peak database queries.
* `dbStatus`: Status text on database state (e.g., `LOW LOAD`, `DB OVERLOAD`).
* `voiceover`: Natural text string formatted for text-to-speech synthesis.

### 5.2 Voiceover Synthesis Engine
* **Primary TTS:** Microsoft Edge Neural Voice API via `edge-tts` (Supports `en-IN-PrabhatNeural`, `hi-IN-MadhurNeural`).
* **Alternative Local TTS:** `kokoro-82m` for high-speed offline inference.
* **Output Format:** MP3, 24kHz / 48kHz mono audio saved into `./public/` directory.
* **Timing Contract:** Remotion composition frame length automatically aligns with audio duration ($\text{Duration} = \text{audio\_seconds} \times 30 \text{ FPS}$).

### 5.3 Animation & Rendering Engine (Remotion)
* **Canvas Resolution:** 1080 x 1920 (Vertical 9:16 Aspect Ratio).
* **Frame Rate:** 30 Frames Per Second.
* **Visual Components:**
  1. *Background Canvas:* Dark slate (#0a0f18) with subtle radial grid dots.
  2. *Header Block:* Contrasting primary title with warning accents.
  3. *Client Layer:* Animated request count via linear/spring interpolation.
  4. *Inter-Node Flow:* Directional SVG arrows with pulse / glow transitions.
  5. *Middleware / Cache Layer:* Dual-state styling (Emerald for healthy, Amber/Red for expired/fault).
  6. *Persistence Layer:* Dynamic query counter with load warnings and red alert box shadow.
* **Audio Track:** Synced `<Audio />` element embedded in composition root.

### 5.4 Batch Pipeline Execution (`generate_batch.py`)
* Sequential processing of multiple topics from a single command.
* Dynamic creation and cleanup of temporary configuration files (`temp_props_{id}.json`).
* Automatic error trapping: Failed renders log error without breaking subsequent topic renders.
* Direct file emission to specified output directory (`./output/{id}.mp4`).

---

## 6. Non-Functional Requirements

* **Portability:** Operates cross-platform (macOS, Ubuntu/Debian, Windows WSL2).
* **Hardware Footprint:** Runs on standard quad-core CPU and 8GB RAM without dedicated GPU requirement.
* **Maintainability:** Pure modular React components; architecture diagrams customizable via standard CSS/TSX.
* **Zero External Paid Dependencies:** No mandatory third-party subscriptions (OpenAI, ElevenLabs, or AWS accounts required for base operation).

---

## 7. System Architecture & Tech Stack

| Layer | Component | Technology |
| :--- | :--- | :--- |
| **Data Contract** | Configuration | JSON Schema (`topics.json`) |
| **Audio Generation** | Speech Synthesis | Python 3 + `edge-tts` / `Kokoro-82M` |
| **Motion Framework** | Programmatic Video | Remotion v4 + React 18 + TypeScript |
| **Rendering Backend** | Video Encoding | Chromium Headless + Bundled FFmpeg |
| **Orchestrator** | Batch Controller | Python `subprocess` & File I/O |
| **Workflow Extension** | Cloud / Scheduled Run | n8n / GitHub Actions (Optional) |

---

## 8. Release Roadmap

* **Phase 1 (MVP — Completed):** Core Remotion vertical template, Edge-TTS CLI integration, single-command Python batch runner.
* **Phase 2 (Current Focus):** Word-level animated captions via WhisperX (`@remotion/captions`), dynamic sound effects (whoosh, alert buzz).
* **Phase 3 (Expansion):** Multi-template support (Microservices Mesh, Event-Driven Kafka architecture, SQL vs NoSQL sharding).
* **Phase 4 (Cloud Orchestration):** n8n webhook listener + Remotion Lambda for multi-platform auto-posting (YouTube Shorts + Instagram Graph API).
