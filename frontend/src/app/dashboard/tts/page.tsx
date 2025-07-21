import { TTSPlayer } from '@/components/tts/TTSPlayer';

export default function TTSPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Text-to-Speech</h1>
      <div className="flex justify-center">
        <TTSPlayer />
      </div>
    </div>
  );
}