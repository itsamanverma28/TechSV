# ConceptScene spec (generic system-design scene)

Any topic that sets `"composition": "ConceptScene"` in `topics.json` is drawn by `src/ConceptScene.tsx`. No new code is needed for a new concept. Write the topic as data.

## Topic fields
| Field | Meaning |
|---|---|
| `id` | Unique id. The output file is `output/<id>.mp4`. |
| `composition` | `"ConceptScene"` |
| `title`, `subtitle` | Shown at the top of the video. |
| `beats` | Name → keyword. Each keyword is the first spoken word containing it (case-insensitive). Beat names are used by `scene`. |
| `scene` | The diagram (below). |
| `voiceover` | The Hinglish script. The video length is the voiceover length plus 1.5 seconds. |

## `scene`
- **`nodes`**: boxes. Each has `id`, `label`, optional `sub`, and `color` (hex).
- **`rows`**: the diagram, top to bottom. Each row is a list of node ids drawn side by side. A ↓ arrow is drawn between rows. Max about 5 rows.
- **`states`** (optional): change a node from a beat onward. Each has `node`, `at` (a beat name), and optionally `color` and `badge` (pill text). The latest state reached wins.
- **`counters`** (optional): a number shown on a node, counting from `from` to `to`. `start` is a beat name (null = video start). `end` is a beat name where the count reaches `to` (null = video end).
- **`summary`** (optional): a card that fades in at the beat `at`, with `text`.

## Rules (checked by `generate_batch.py` before rendering)
- Every beat name used in `states`, `counters` and `summary` must be defined in `beats`.
- Every node id in `rows` must be defined in `nodes`.
- Each keyword must be spoken in the voiceover, or the batch stops with an error.

## Limits
- A counter only goes one way, from `from` to `to`. It can't count up and then back down. For a value that drops, use two counters on different nodes, or extend the spec.
- Nodes are placed in rows only. Use rows with one or two nodes for side-by-side flows.
- Motion is limited to counters, badges and colours. Packets moving between nodes need a new spec field.

## Example
See `circuit_breaker` in `topics.json`.
