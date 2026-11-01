# User Flow & Pipeline Architecture Map

**Project:** Automated IT & System Design Short Video Generator  
**Document Version:** 1.0.0  
**Scope:** Developer Experience, End-to-End System Flows, and Failure Modes  

---

## 1. High-Level Architecture Overview

The system operates on a **Data-Driven Decoupled Pipeline** architecture. Content definition (`topics.json`), audio synthesis (`edge-tts`), visual rendering (`Remotion`), and execution orchestration (`Python/n8n`) are strictly decoupled.

```text
+-----------------------------------------------------------------------------------+
|                               1. CONTENT DEFINITION                               |
|   topics.json (Hook, Architecture Nodes, Counters, Voiceover Script)             |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                         2. ORCHESTRATION LAYER (Python)                           |
|   generate_batch.py parses topic list and coordinates audio & video rendering    |
+-----------------------------------------------------------------------------------+
                    |                                             |
                    v                                             v
+------------------------------------+       +------------------------------------+
|       3A. AUDIO SYNTHESIS          |       |        3B. PROPS GENERATION        |
|  edge-tts generates MP3 into       |       |  Serializes topic data into        |
|  public/voiceover_{id}.mp3         |       |  temporary temp_props_{id}.json    |
+------------------------------------+       +------------------------------------+
                    \                                             /
                     -----------------\         /-----------------
                                       v       v
+-----------------------------------------------------------------------------------+
|                            4. REMOTION VIDEO ENGINE                               |
|   npx remotion render SystemDesignShort out/{id}.mp4 --props=temp_props.json      |
|   (Binds Voiceover Audio + Interpolates Counters + Animates Glowing Boxes)         |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                             5. OUTPUT & DISTRIBUTION                              |
|   Final 1080x1920 MP4 stored in output/ ready for YouTube Shorts / Reels          |
+-----------------------------------------------------------------------------------+
```

---

## 2. Detailed User Journeys

### Flow 1: Creator Interactive Authoring & Visual Tuning (Local Dev Mode)
This flow is used by creators when designing a new architecture visual layout or tweaking animation curves.

```text
[Start: Creator has new idea]
           |
           v
[Open topics.json in Code Editor]
           |
           v
[Add/Modify Topic Object (Nodes, Counters, Hook)]
           |
           v
[Run: npx remotion preview]
           |
           v
[Browser opens on http://localhost:3000]
           |
           v
[Creator scrubs timeline / inspects layout]
           |
     Is visual approved?
        /          \
      No            Yes
      /              \
[Edit TSX styles]     [Proceed to Flow 2 or Flow 3]
```

1. **Input:** Creator writes topic metadata and script inside `topics.json`.
2. **Interactive Server:** Creator launches `npx remotion preview`.
3. **Real-time Feedback:** Browser displays responsive 9:16 canvas with live timeline scrubbing, play/pause, and component inspection.
4. **Approval:** Once spacing, colors, and counter timings match the narrative, the creator moves to batch production.

---

### Flow 2: Automated Batch Generation (Local CLI Runner)
This flow is used to render 5, 10, or 30 videos sequentially without human intervention.

```text
[Terminal: python3 generate_batch.py]
           |
           v
[Script reads topics.json]
           |
           v
[Loop starts: Item i of N]
   |
   +--> Step A: Execute Edge-TTS CLI
   |       |
   |       v
   |    Saves to public/voiceover_{id}.mp3
   |
   +--> Step B: Write temp_props_{id}.json
   |
   +--> Step C: Spawn Remotion CLI Subprocess
   |       |
   |       v
   |    Headless Chromium launches
   |    Frames 0 to 1350 rendered & stitched via FFmpeg
   |    MP4 written to output/{id}.mp4
   |
   +--> Step D: Cleanup temp_props file
   |
   +--> [Has next topic?] ---> (Yes: Loop back to Step A)
                               (No: Print Success Summary)
```

* **Step 1 — Initialization:** `generate_batch.py` checks and creates `./public` and `./output` directories.
* **Step 2 — Data Parsing:** Validates `topics.json` schema and iterates through each topic record.
* **Step 3 — Audio Generation:** Calls `edge-tts` with high-quality neural voice (`en-IN-PrabhatNeural` or `hi-IN-MadhurNeural`).
* **Step 4 — Parameter Injection:** Dumps the topic props to a localized JSON file so Remotion receives strongly-typed inputs.
* **Step 5 — Video Compilation:** Executes `npx remotion render SystemDesignShort output/{id}.mp4`. Remotion spins up headless Chromium instances in parallel to evaluate React components and output H.264 video.
* **Step 6 — Housekeeping:** Deletes intermediate configuration files while preserving media artifacts.

---

### Flow 3: n8n Headless Cloud / Webhook Pipeline (Automated Publishing)
This flow connects the rendering engine to social media publishing channels automatically.

```text
[Schedule: Every Morning at 10:00 AM] 
           OR 
[Trigger: New row added in Google Sheets]
           |
           v
[n8n Workflow Node: LLM Script & Props Generator]
           |
           v
[n8n HTTP Node: POST to Render Server Webhook /render]
           |
           v
[Render Server (Node.js/Python Express):]
   - Generates Audio
   - Runs Remotion Render
   - Returns video URL / file buffer
           |
           v
[n8n Branching:]
   +---> Upload to YouTube Data API v3 (#shorts)
   +---> Post to Instagram Reels (Graph API)
   +---> Backup to Google Drive / Telegram Channel
```

---

## 3. Video Frame State Lifecycle (45 Seconds / 1350 Frames)

The visual state of the short video transitions across four distinct phases:

| Frame Range | Timestamp | Narrative Phase | Client Node | Cache Node | Database Node |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0 – 60** | 0.0s – 2.0s | **Hook & Baseline** | 100 reqs (Cyan) | TTL: 60s (Emerald) | 0 queries (Slate) |
| **60 – 200** | 2.0s – 6.6s | **Traffic Rise** | 100 $\rightarrow$ 3,000 reqs | TTL ticking down | 0 queries (Cache serves) |
| **200 – 400** | 6.6s – 13.3s | **Cache Expiration** | 3,000 $\rightarrow$ 10,000 reqs | **TTL: 0s · CACHE EXPIRED** (Amber/Warning) | 0 $\rightarrow$ 500 queries |
| **400 – 800** | 13.3s – 26.6s | **Thundering Herd Crash** | 10,000 reqs (Max) | Expired (Bypassed) | **0 $\rightarrow$ 10,000 queries (RED ALERT · 100% CPU)** |
| **800 – 1350** | 26.6s – 45.0s | **Solution & Outro** | 10,000 reqs | Shield/Mutex Active | Load drops / Safe status |

---

## 4. Error Handling & Edge Cases

| Failure Scenario | Detection Mechanism | Recovery / Fallback Behavior |
| :--- | :--- | :--- |
| **Edge-TTS Network Failure** | `subprocess.CalledProcessError` on `edge-tts` command | Script catches exception, logs failure for specific topic ID, and proceeds to next topic without crashing whole batch. |
| **Audio File Missing in Remotion** | Remotion static file loader error | Default placeholder tone or silent track in `public/` is referenced. |
| **Text Overflow on Mobile** | Title or status exceeds box width | CSS rules enforce `line-clamp`, responsive `font-size` scaling, and explicit container bounds. |
| **Frame Count vs Audio Desync** | Audio longer than default duration (45s) | Python script uses `mutagen` or `ffprobe` to read exact audio duration and passes dynamic `--props='{"durationInFrames": ...}'` to match audio length. |
| **Disk Space Constraint** | Large batch fills local disk | Render script outputs clean progress and logs size per video; old temporary frames are automatically evicted by Remotion. |

---

## 5. Artifact Directory Structure

```text
tech-shorts-generator/
│
├── public/                     # Audio assets served statically to Remotion
│   ├── voiceover_cache_stampede.mp3
│   └── voiceover_cache_avalanche.mp3
│
├── output/                     # Final deliverable video files
│   ├── cache_stampede.mp4
│   └── cache_avalanche.mp4
│
├── src/                        # React / Remotion visual code
│   ├── index.ts                # Entrypoint
│   ├── Root.tsx                # Compositions & Canvas sizing
│   └── SystemDesignShort.tsx   # Visual components, nodes & animations
│
├── topics.json                 # Input source of truth (Topics, Scripts, Props)
├── generate_batch.py           # Automated batch execution engine
├── PRD.md                      # Product Requirements Document
└── user_flow.md                # System workflow & user journeys document
```
