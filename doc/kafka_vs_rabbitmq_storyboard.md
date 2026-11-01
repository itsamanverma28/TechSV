# Kafka vs RabbitMQ: storyboard

Topic id: `kafka_vs_rabbitmq` · Composition: `KafkaVsRabbitMQ` · Format: 1080×1920, 30 fps
Style reference: `doc/ScreenRecording_11-01-2026 20-02-04_1.MP4` (dark theme, two tubes, moving orders, live counters, subtitles).
Our version uses our own layout and branding. It does not copy the reference's handle or app UI.

Timing is not fixed. Each beat starts at the first spoken word of its keyword, and the video length is the voiceover length plus 1.5 seconds.

| # | Beat (keyword) | Visual | Voiceover (Hinglish) |
|---|---|---|---|
| 1 | Intro (none) | Title "KAFKA vs RABBITMQ", subtitle, empty tubes | Kafka aur RabbitMQ, dono message broker hain, lekin ek bada farak hai. |
| 2 | `order` → `orderSent` | Order Service box. Orders #1–#6 drop into both tubes, one every 0.5s | Order service har order ko dono mein bhejti hai. Har order ek message hai. |
| 3 | `delete` → `rabbitAck` | RabbitMQ tube: each order is acknowledged and removed. Its counter falls to 0 | RabbitMQ message ko read hone ke baad delete kar deta hai. |
| 4 | `rakhta` (no beat, Kafka keeps all) | Kafka tube keeps all six orders. The email counter reads 6 | Kafka har message ko default 7 din tak rakhta hai. |
| 5 | `naya` → `newService` | Analytics box fades in under Kafka | Ab ek naya service join hota hai, analytics ke liye. |
| 6 | `replay` → `replay` | Analytics counter counts up the replayed orders. RabbitMQ has nothing left to replay | Kafka offset se purane messages ko replay kar sakta hai. RabbitMQ mein woh message ab bacha hi nahi. |
| 7 | `ACK` (no beat) | Email counters show the orders processed | Email service dono ko process karti hai, aur har message ka ACK bhejti hai. |
| 8 | `Summary` → `summary` | Summary card: Kafka keeps N orders, RabbitMQ keeps 0 | Summary: data dobara chahiye to Kafka, aur task queue ke liye RabbitMQ. |

## Keywords (topics.json `beats`)
`orderSent: order`, `rabbitAck: delete`, `newService: naya`, `replay: replay`, `summary: Summary`.
Each keyword is the first spoken occurrence. If a keyword is missing from the voiceover, the batch stops with an error.
