import { Composition, staticFile } from 'remotion';
import { getAudioDurationInSeconds } from '@remotion/media-utils';
import { SystemDesignShort } from './SystemDesignShort';
import type { ShortProps } from './SystemDesignShort';
import { KafkaVsRabbitMQ } from './KafkaVsRabbitMQ';
import type { KafkaVsRabbitMQProps } from './KafkaVsRabbitMQ';
import { ConceptScene } from './ConceptScene';
import type { ConceptSceneProps } from './ConceptScene';
import { ExplainerScene } from './ExplainerScene';
import type { ExplainerSceneProps } from './ExplainerScene';
import { DirectorScene } from './DirectorScene';
import type { DirectorSceneProps } from './DirectorScene';
import { Thumbnail } from './Thumbnail';
import type { ThumbnailProps } from './Thumbnail';

export const FPS = 30;
export const TAIL_SECONDS = 1.5; // silence after the voiceover so the ending is not cut off

// Reads the voiceover length so every video is as long as its script
const withVoiceoverLength = async <P extends { audioFile: string }>(props: P) => {
  const voiceoverSeconds = await getAudioDurationInSeconds(staticFile(props.audioFile));
  const durationSeconds = voiceoverSeconds + TAIL_SECONDS;
  return {
    durationInFrames: Math.ceil(durationSeconds * FPS),
    props: { ...props, durationSeconds },
  };
};

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="SystemDesignShort"
        component={SystemDesignShort}
        durationInFrames={FPS * 45}
        fps={FPS}
        width={1080}
        height={1920}
        calculateMetadata={({ props }: { props: ShortProps }) => withVoiceoverLength(props)}
        defaultProps={{
          title: "ONE KEY EXPIRES... 10,000 REQUESTS?!",
          subtitle: "Illustrative unprotected burst · same popular key",
          clientMax: 10000,
          cacheNodeName: "REDIS CACHE",
          cacheKey: "POPULAR_KEY",
          cacheStatus: "CACHE EXPIRED",
          cacheTtl: "TTL: 0s",
          dbMax: 10000,
          dbStatus: "HIGH LOAD · DB OVERLOAD",
          audioFile: "voiceover.mp3",
          durationSeconds: 0, // placeholder, always replaced by calculateMetadata
          beats: { cacheBreak: 18, dbOverload: 31.5, shield: null, checklist: null },
          captions: [],
        }}
      />
      <Composition
        id="KafkaVsRabbitMQ"
        component={KafkaVsRabbitMQ}
        durationInFrames={FPS * 45}
        fps={FPS}
        width={1080}
        height={1920}
        calculateMetadata={({ props }: { props: KafkaVsRabbitMQProps }) => withVoiceoverLength(props)}
        defaultProps={{
          title: "KAFKA vs RABBITMQ",
          subtitle: "Message padhne ke baad kahan jaata hai?",
          audioFile: "voiceover.mp3",
          durationSeconds: 0, // placeholder, always replaced by calculateMetadata
          beats: {},
          captions: [],
        }}
      />
      <Composition
        id="ConceptScene"
        component={ConceptScene}
        durationInFrames={FPS * 45}
        fps={FPS}
        width={1080}
        height={1920}
        calculateMetadata={({ props }: { props: ConceptSceneProps }) => withVoiceoverLength(props)}
        defaultProps={{
          title: "CONCEPT",
          subtitle: "Preview: topic ke scene spec se generate hota hai",
          audioFile: "voiceover.mp3",
          durationSeconds: 0, // placeholder, always replaced by calculateMetadata
          beats: {},
          scene: { nodes: [], rows: [] },
          captions: [],
        }}
      />
      <Composition
        id="ExplainerScene"
        component={ExplainerScene}
        durationInFrames={FPS * 45}
        fps={FPS}
        width={1080}
        height={1920}
        calculateMetadata={({ props }: { props: ExplainerSceneProps }) => withVoiceoverLength(props)}
        defaultProps={{
          audioFile: "voiceover.mp3",
          durationSeconds: 0, // placeholder, always replaced by calculateMetadata
          beats: {},
          scenes: [{ beat: null, kind: "headline", tag: "PREVIEW", title: "Explainer" }],
          captions: [],
          showSafeZone: true, // preview only; batch renders pass false unless a topic asks for it
        }}
      />
      <Composition
        id="DirectorScene"
        component={DirectorScene}
        durationInFrames={FPS * 45}
        fps={FPS}
        width={1080}
        height={1920}
        calculateMetadata={({ props }: { props: DirectorSceneProps }) => withVoiceoverLength(props)}
        defaultProps={{
          audioFile: "voiceover.mp3",
          durationSeconds: 0, // placeholder, always replaced by calculateMetadata
          title: "PREVIEW",
          subtitle: "Director timeline preview",
          nodes: [],
          edges: [],
          timeline: [],
          captions: [],
        }}
      />
      <Composition
        id="Thumbnail"
        component={Thumbnail}
        durationInFrames={1}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          hook: "HOOK TEXT",
          emoji: "🔥",
          stat: "10,000 REQ",
          accent: "#facc15",
        } as ThumbnailProps}
      />
    </>
  );
};
