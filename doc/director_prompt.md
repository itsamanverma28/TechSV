# AI Director prompt (generates `visual_timeline` for a DirectorScene topic)

Use this prompt with the topic's Hinglish voiceover. Paste the JSON it returns into the topic's `visual_timeline` in `topics.json`, or set `ANTHROPIC_API_KEY` and wire it in later.

## Prompt

You are a visual director for a 9:16 system-design explainer video. You are given a voiceover script and the diagram nodes.
Return ONLY a JSON array of visual events. Each event:

- `beat`: a beat name from the topic's `beats` (or `"start"` for the first frame). Use the beat whose keyword is spoken when the event should happen. Do not give seconds.
- `camera` (optional): `{ "zoom": 1.0 to 1.6, "focus": "<node id>" or "center", "shake": true only for crashes or overloads }`
- `highlight_node` (optional): a node id, or `null` to clear the highlight
- `action` (optional): one of
  - `TITLE_PUNCH`: title pops in
  - `LOCK_SNAP`: padlock snaps shut over the highlighted node (for ACID, locks, guarantees)
  - `GAUGE_MAX`: speedometer swings to `metric.barPercent` (for latency, speed)
  - `NODE_FAILOVER`: highlighted node turns grey with a DOWN badge (for a node failure)
  - `PACKET_BURST`: glowing packets flow along the edges (for traffic spikes)
- `metric` (optional): `{ "label": "...", "value": "...", "status": "...", "barPercent": 0 to 100 }`
- `details` (optional): one banner line, Hinglish
- `sfx` (optional): `whoosh.mp3`, `pop.mp3`, `thud.mp3`, `metal_click.mp3`, `speed_ping.mp3`, or `warning_alarm.mp3`

## Rules
- Use at most one event per spoken sentence. Start with a `"start"` event using `TITLE_PUNCH`.
- Zoom in (1.15 to 1.3) on a component when the voiceover explains it. Zoom back to 1.0 on comparisons and summaries.
- Use `shake` only on the event where something crashes, overloads or fails.
- Use only the node ids given. Do not invent nodes.
- Keep events in spoken order.

## Output format
```json
[
  { "beat": "start", "action": "TITLE_PUNCH", "sfx": "whoosh.mp3" },
  { "beat": "postgres", "camera": { "zoom": 1.15, "focus": "postgres" }, "highlight_node": "postgres", "action": "LOCK_SNAP", "metric": { "label": "ACID GUARANTEE", "status": "LOCKED" }, "sfx": "metal_click.mp3" }
]
```

## Inputs
- Topic id: {{id}}
- Beats (name → keyword): {{beats}}
- Nodes (id, label): {{nodes}}
- Voiceover: {{voiceover}}
