Here is the step-by-step process for making a new short, from idea to MP4. Everything runs from the project folder, tech-shorts-generator/.

One-time setup
Install the Node packages: npm install.
Check that the Python venv exists at .venv/ and has edge-tts: ./.venv/bin/edge-tts --version.
Make sure you have internet access. The voiceover uses Edge's cloud voices, and Remotion downloads a headless Chrome the first time it renders.
Per video
Write the storyboard. Split the topic into beats, one idea each. For each beat, write the visual change and the Hinglish line. Aim for about 2–2.5 words per second; a 50-second short is roughly 100–120 words.

Pick the concept keywords. Choose one word the narrator says when each event happens:

cacheBreak: the cache fails
dbOverload: the database is overwhelmed (or null if it never overloads)
shield: the fix appears (optional)
checklist: the takeaway appears (optional)
Use the first spoken occurrence of the word, and avoid words used in the hook.

Add a row to topics.json. Fill in the fields: id, title, subtitle, clientMax, cacheNodeName, cacheKey, cacheStatus, cacheTtl, dbMax, dbStatus, beats, voiceover. For a shield or checklist, also add shieldLabel and checklistItems. Use a new unique id, because the output file is named after it.

Validate the JSON. python3 -c "import json;json.load(open('topics.json'))" should print nothing.

Generate and render that one topic. Run python3 generate_batch.py <id>. The script:

makes public/voiceover_<id>.mp3 and records every word's timing
works out the video length and the beat times from those timings
renders output/<id>.mp4
If a keyword is not spoken, it stops with an error naming the keyword. Fix the keyword or the script and run again.

Check the output.

Watch the MP4 for sync: the cache should break on the word you chose, and the rest of the beats should follow.
If something looks wrong, preview it live with npx remotion preview. The composition reads the length from public/voiceover_<id>.mp3, so that file must exist first.
To check a single frame, run npx remotion still src/index.ts SystemDesignShort out.png --frame=<n> --props=<file>.
Iterate if needed. To change the wording, edit the voiceover and re-run step 5. To move an event, change its keyword. To change the look, edit src/SystemDesignShort.tsx.

Repeat for the next topic. Add its row and run step 5 with its ID.

Rendering everything at once
python3 generate_batch.py renders every topic in topics.json, one after another. Each render takes a few minutes, so run it once you're happy with each topic on its own.
Notes and limits
The batch script has no "done" flag. It re-renders every topic each time, so use the ID form to render only what you changed.
Edge-TTS needs internet. If it fails, the script stops before rendering.
The video length is the voiceover length plus 1.5 seconds, so a longer script gives a longer video.
Captions are groups of five words, and the last group can be a single word. If you want different styling, tell me and I'll change the component.