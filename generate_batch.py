import asyncio
import json
import os
import subprocess
import sys

import edge_tts

TOPICS_FILE = "topics.json"
PUBLIC_DIR = "public"
OUTPUT_DIR = "output"
ENTRY_POINT = "src/index.ts"
EDGE_TTS = os.path.join(".venv", "bin", "edge-tts")
VOICE = "en-IN-PrabhatNeural"
TAIL_SECONDS = 1.5  # silence after the last word so the ending is not cut off
TICKS_PER_SECOND = 10_000_000  # edge-tts reports offsets in 100-nanosecond ticks
DEFAULT_COMPOSITION = "SystemDesignShort"
DEFAULT_CACHE_BREAK_RATIO = 0.4  # used by SystemDesignShort when a topic has no cacheBreak keyword

os.makedirs(PUBLIC_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


async def synthesize(text, audio_path):
    """Write the voiceover MP3 and return the spoken words with their timings in seconds."""
    communicate = edge_tts.Communicate(text, VOICE, boundary="WordBoundary")
    words = []
    with open(audio_path, "wb") as audio:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({
                    "text": chunk["text"],
                    "start": round(chunk["offset"] / TICKS_PER_SECOND, 2),
                    "end": round((chunk["offset"] + chunk["duration"]) / TICKS_PER_SECOND, 2),
                })
    return words


def find_beat(words, keyword, topic_id):
    """Return the start time of the first spoken word containing the keyword, or None if no keyword is set."""
    if keyword is None:
        return None
    for word in words:
        if keyword.lower() in word["text"].lower():
            return word["start"]
    raise ValueError(f"[{topic_id}] beat keyword '{keyword}' was not spoken in the voiceover")


def apply_system_design_rules(beats, duration, topic_id):
    """SystemDesignShort needs a cache break; without a keyword it falls back to a fixed point in the video."""
    if beats.get("cacheBreak") is None:
        beats["cacheBreak"] = round(duration * DEFAULT_CACHE_BREAK_RATIO, 2)
    for name in ("dbOverload", "shield", "checklist"):
        beats.setdefault(name, None)
    if beats["dbOverload"] is not None and beats["dbOverload"] <= beats["cacheBreak"]:
        raise ValueError(
            f"[{topic_id}] dbOverload ({beats['dbOverload']}s) must come after cacheBreak ({beats['cacheBreak']}s)"
        )


def validate_scene(topic):
    """Check a ConceptScene spec before rendering: every beat and node it names must exist."""
    topic_id = topic["id"]
    scene = topic.get("scene")
    if not scene:
        raise ValueError(f"[{topic_id}] ConceptScene topics need a 'scene' block")

    beat_names = set(topic.get("beats", {}))
    node_ids = {node["id"] for node in scene.get("nodes", [])}

    used_beats = [state["at"] for state in scene.get("states", [])]
    for counter in scene.get("counters", []):
        used_beats += [counter[key] for key in ("start", "end") if counter.get(key)]
    if scene.get("summary"):
        used_beats.append(scene["summary"]["at"])

    unknown_beats = sorted(set(used_beats) - beat_names)
    if unknown_beats:
        raise ValueError(f"[{topic_id}] scene uses beats that are not in 'beats': {unknown_beats}")

    unknown_nodes = sorted({node_id for row in scene.get("rows", []) for node_id in row} - node_ids)
    if unknown_nodes:
        raise ValueError(f"[{topic_id}] rows use nodes that are not defined: {unknown_nodes}")


def validate_explainer(topic, beat_times):
    """Check an ExplainerScene topic before rendering: scenes need known beats and must come in spoken order."""
    topic_id = topic["id"]
    scenes = topic.get("scenes")
    if not scenes:
        raise ValueError(f"[{topic_id}] ExplainerScene topics need a 'scenes' list")

    beat_names = set(topic.get("beats", {}))
    used = [scene["beat"] for scene in scenes if scene.get("beat")]
    unknown = sorted(set(used) - beat_names)
    if unknown:
        raise ValueError(f"[{topic_id}] scenes use beats that are not in 'beats': {unknown}")

    times = [beat_times[scene["beat"]] for scene in scenes if scene.get("beat")]
    if times != sorted(times):
        raise ValueError(f"[{topic_id}] scene beats are not spoken in the same order as the scenes: {times}")


DIRECTOR_ACTIONS = {"TITLE_PUNCH", "LOCK_SNAP", "GAUGE_MAX", "NODE_FAILOVER", "PACKET_BURST"}
# Sound names an LLM may suggest -> the sound files in public/sfx/
DIRECTOR_SFX = {
    "pop": "pop", "whoosh": "whoosh", "thud": "thud",
    "metal_click": "pop", "speed_ping": "pop", "warning_alarm": "thud",
}


def resolve_director(topic, beat_times, duration):
    """Check a DirectorScene timeline and turn each event's beat name into a time in seconds."""
    topic_id = topic["id"]
    nodes = topic.get("nodes")
    if not nodes:
        raise ValueError(f"[{topic_id}] DirectorScene topics need a 'nodes' list")
    node_ids = [node["id"] for node in nodes]
    if len(set(node_ids)) != len(node_ids):
        raise ValueError(f"[{topic_id}] node ids must be unique")

    for edge in topic.get("edges", []):
        if any(node_id not in node_ids for node_id in edge):
            raise ValueError(f"[{topic_id}] edge {edge} uses a node that is not defined")

    resolved = []
    for index, event in enumerate(topic.get("visual_timeline", [])):
        if ("time_sec" in event) == ("beat" in event):
            raise ValueError(f"[{topic_id}] event {index} needs exactly one of 'time_sec' or 'beat'")
        if "beat" in event:
            if event["beat"] == "start":
                time = 0.0
            elif event["beat"] in beat_times:
                time = beat_times[event["beat"]]
            else:
                raise ValueError(f"[{topic_id}] event {index} uses beat '{event['beat']}' that is not in 'beats'")
        else:
            time = float(event["time_sec"])
        if not 0 <= time <= duration:
            raise ValueError(f"[{topic_id}] event {index} at {time}s is outside the video (0 to {duration}s)")

        action = event.get("action")
        if action is not None and action not in DIRECTOR_ACTIONS:
            raise ValueError(f"[{topic_id}] event {index} has unknown action '{action}'")

        camera = event.get("camera", {})
        focus = camera.get("focus")
        if focus is not None and focus != "center" and focus not in node_ids:
            raise ValueError(f"[{topic_id}] event {index} focuses on unknown node '{focus}'")
        zoom = camera.get("zoom")
        if zoom is not None and not 0.8 <= zoom <= 1.6:
            raise ValueError(f"[{topic_id}] event {index} zoom {zoom} is outside 0.8 to 1.6")

        highlight = event.get("highlight_node")
        if highlight is not None and highlight not in node_ids:
            raise ValueError(f"[{topic_id}] event {index} highlights unknown node '{highlight}'")

        sfx = None
        if event.get("sfx"):
            name = os.path.splitext(event["sfx"])[0]
            if name not in DIRECTOR_SFX:
                raise ValueError(f"[{topic_id}] event {index} has unknown sound '{event['sfx']}'")
            sfx = DIRECTOR_SFX[name]

        resolved.append({
            "time": round(time, 2),
            "camera": camera or None,
            "highlight_node": event["highlight_node"] if "highlight_node" in event else None,
            "action": action,
            "metric": event.get("metric"),
            "details": event.get("details"),
            "sfx": sfx,
        })

    # Keep the highlight key only where the event sets it (null clears), so "not set" still means keep
    for event, source in zip(resolved, topic.get("visual_timeline", [])):
        if "highlight_node" not in source:
            event.pop("highlight_node")
    return sorted(resolved, key=lambda event: event["time"])


def render_video(topic_id, composition, props, output_video_path):
    temp_props_file = f"temp_props_{topic_id}.json"
    with open(temp_props_file, "w", encoding="utf-8") as pf:
        json.dump(props, pf)

    render_cmd = [
        "npx", "remotion", "render",
        ENTRY_POINT,
        composition,
        output_video_path,
        f"--props={temp_props_file}"
    ]
    try:
        subprocess.run(render_cmd, check=True)
    finally:
        # Cleanup temp props, even if the render fails
        if os.path.exists(temp_props_file):
            os.remove(temp_props_file)


with open(TOPICS_FILE, "r", encoding="utf-8") as f:
    topics = json.load(f)

# Optional: python3 generate_batch.py <topic_id> [<topic_id> ...] renders only those topics
wanted_ids = set(sys.argv[1:])
if wanted_ids:
    topics = [t for t in topics if t["id"] in wanted_ids]

print(f"🚀 Found {len(topics)} topics to process...\n")

for index, topic in enumerate(topics, start=1):
    topic_id = topic["id"]
    composition = topic.get("composition", DEFAULT_COMPOSITION)
    audio_filename = f"voiceover_{topic_id}.mp3"
    audio_path = os.path.join(PUBLIC_DIR, audio_filename)
    output_video_path = os.path.join(OUTPUT_DIR, f"{topic_id}.mp4")

    print(f"[{index}/{len(topics)}] Processing: {topic['title']} ({composition})")

    # 1. Generate Voiceover using Edge-TTS and get word timings from the same run
    print("  🎙️ Generating Audio...")
    words = asyncio.run(synthesize(topic["voiceover"], audio_path))
    if not words:
        raise RuntimeError(f"[{topic_id}] edge-tts returned no word timings")

    # 2. Work out the concept beats from the spoken timings
    duration = round(words[-1]["end"] + TAIL_SECONDS, 2)
    beats = {name: find_beat(words, keyword, topic_id) for name, keyword in topic.get("beats", {}).items()}
    if composition == DEFAULT_COMPOSITION:
        apply_system_design_rules(beats, duration, topic_id)
    if composition == "ConceptScene":
        validate_scene(topic)
    if composition == "ExplainerScene":
        validate_explainer(topic, beats)
    director_events = resolve_director(topic, beats, duration) if composition == "DirectorScene" else None
    print(f"  ⏱️ Duration {duration}s · beats {beats}")

    # 3. Prepare Props for Remotion (each composition reads only the fields it needs)
    props = {
        "title": topic["title"],
        "subtitle": topic["subtitle"],
        "audioFile": audio_filename,
        "beats": beats,
        "captions": words,
        "clientMax": topic.get("clientMax"),
        "cacheNodeName": topic.get("cacheNodeName"),
        "cacheKey": topic.get("cacheKey"),
        "cacheStatus": topic.get("cacheStatus"),
        "cacheTtl": topic.get("cacheTtl"),
        "dbMax": topic.get("dbMax"),
        "dbStatus": topic.get("dbStatus"),
        "shieldLabel": topic.get("shieldLabel"),
        "checklistItems": topic.get("checklistItems", []),
        "scene": topic.get("scene"),
        "scenes": topic.get("scenes"),
        "nodes": topic.get("nodes"),
        "edges": topic.get("edges", []),
        "timeline": director_events,
        "showSafeZone": topic.get("showSafeZone", False),
    }

    # 4. Render Video with Remotion CLI
    print(f"  🎬 Rendering MP4 -> {output_video_path}...")
    render_video(topic_id, composition, props, output_video_path)

    print(f"  ✅ Completed: {output_video_path}\n")

print("🎉 All videos rendered successfully in the 'output/' folder!")
