'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/browser';

// Audio Analyser class
class AudioAnalyser {
  private analyser: AnalyserNode;
  private bufferLength = 0;
  private dataArray: Uint8Array;

  constructor(node: AudioNode) {
    this.analyser = node.context.createAnalyser();
    this.analyser.fftSize = 32;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    node.connect(this.analyser);
  }

  update() {
    this.analyser.getByteFrequencyData(this.dataArray);
  }

  get data() {
    return this.dataArray;
  }
}

// Sphere vertex shader
const sphereVertexShader = `
uniform float time;
uniform vec4 inputData;
uniform vec4 outputData;

varying vec3 vNormal;
varying vec3 vViewPosition;

vec3 calc(vec3 pos) {
  vec3 dir = normalize(pos);
  vec3 p = dir + vec3(time, 0., 0.);
  return pos +
    1. * inputData.x * inputData.y * dir * (.5 + .5 * sin(inputData.z * pos.x + time)) +
    1. * outputData.x * outputData.y * dir * (.5 + .5 * sin(outputData.z * pos.y + time));
}

vec3 spherical(float r, float theta, float phi) {
  return r * vec3(
    cos(theta) * cos(phi),
    sin(theta) * cos(phi),
    sin(phi)
  );
}

void main() {
  float inc = 0.001;
  float r = length(position);
  float theta = (uv.x + 0.5) * 2. * 3.14159265;
  float phi = -(uv.y + 0.5) * 3.14159265;
  
  vec3 np = calc(spherical(r, theta, phi));
  vec3 tangent = normalize(calc(spherical(r, theta + inc, phi)) - np);
  vec3 bitangent = normalize(calc(spherical(r, theta, phi + inc)) - np);
  
  vNormal = normalize(normalMatrix * normalize(cross(tangent, bitangent)));
  vViewPosition = -(modelViewMatrix * vec4(np, 1.0)).xyz;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(np, 1.0);
}
`;

// Types
interface TranscriptEntry {
  timestamp: number;
  speaker: 'user' | 'assistant';
  text: string;
}

// Component
export function EVAVoiceInterface() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Click to start');
  const [error, setError] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [inputText, setInputText] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentUserText, setCurrentUserText] = useState('');
  const [currentAssistantText, setCurrentAssistantText] = useState('');
  
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const rotationRef = useRef(new THREE.Vector3(0, 0, 0));
  
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputNodeRef = useRef<GainNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const inputAnalyserRef = useRef<AudioAnalyser | null>(null);
  const outputAnalyserRef = useRef<AudioAnalyser | null>(null);
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const { user } = useAuth();

  // Initialize 3D scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x100c14);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(2, -2, 5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // Sphere
    const geometry = new THREE.IcosahedronGeometry(1, 10);
    const material = new THREE.MeshStandardMaterial({
      color: 0x000010,
      metalness: 0.5,
      roughness: 0.1,
      emissive: 0x000010,
      emissiveIntensity: 1.5,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.time = { value: 0 };
      shader.uniforms.inputData = { value: new THREE.Vector4() };
      shader.uniforms.outputData = { value: new THREE.Vector4() };
      material.userData.shader = shader;
      shader.vertexShader = sphereVertexShader;
    };

    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    sphereRef.current = sphere;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // Post-processing
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      5,
      0.5,
      0
    );
    composer.addPass(bloomPass);
    composerRef.current = composer;

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    let prevTime = 0;
    const animate = () => {
      requestAnimationFrame(animate);

      if (inputAnalyserRef.current) inputAnalyserRef.current.update();
      if (outputAnalyserRef.current) outputAnalyserRef.current.update();

      const t = performance.now();
      const dt = (t - prevTime) / (1000 / 60);
      prevTime = t;

      if (sphere && material.userData.shader) {
        const outputData = outputAnalyserRef.current?.data || new Uint8Array(16);
        const inputData = inputAnalyserRef.current?.data || new Uint8Array(16);

        sphere.scale.setScalar(1 + (0.2 * outputData[1]) / 255);

        const f = 0.001;
        rotationRef.current.x += (dt * f * 0.5 * outputData[1]) / 255;
        rotationRef.current.z += (dt * f * 0.5 * inputData[1]) / 255;
        rotationRef.current.y += (dt * f * 0.25 * inputData[2]) / 255;
        rotationRef.current.y += (dt * f * 0.25 * outputData[2]) / 255;

        const euler = new THREE.Euler(
          rotationRef.current.x,
          rotationRef.current.y,
          rotationRef.current.z
        );
        const quaternion = new THREE.Quaternion().setFromEuler(euler);
        const vector = new THREE.Vector3(0, 0, 5);
        vector.applyQuaternion(quaternion);
        camera.position.copy(vector);
        camera.lookAt(sphere.position);

        material.userData.shader.uniforms.time.value += (dt * 0.1 * outputData[0]) / 255;
        material.userData.shader.uniforms.inputData.value.set(
          (1 * inputData[0]) / 255,
          (0.1 * inputData[1]) / 255,
          (10 * inputData[2]) / 255,
          0
        );
        material.userData.shader.uniforms.outputData.value.set(
          (2 * outputData[0]) / 255,
          (0.1 * outputData[1]) / 255,
          (10 * outputData[2]) / 255,
          0
        );
      }

      composer.render();
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // Initialize audio contexts
  useEffect(() => {
    inputContextRef.current = new AudioContext({ sampleRate: 16000 });
    outputContextRef.current = new AudioContext({ sampleRate: 24000 });
    
    inputNodeRef.current = inputContextRef.current.createGain();
    outputNodeRef.current = outputContextRef.current.createGain();
    outputNodeRef.current.connect(outputContextRef.current.destination);
    
    inputAnalyserRef.current = new AudioAnalyser(inputNodeRef.current);
    outputAnalyserRef.current = new AudioAnalyser(outputNodeRef.current);
    
    nextStartTimeRef.current = outputContextRef.current.currentTime;
  }, []);

  // Connect to WebSocket
  const connectWebSocket = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const wsBaseUrl = supabaseUrl.replace('https://', 'wss://');
      const modelName = 'gemini-2.0-flash-exp';
      const wsUrl = `${wsBaseUrl}/functions/v1/gemini-websocket?model=${encodeURIComponent(modelName)}&token=${encodeURIComponent(session.access_token)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('Connected');
        setIsLive(true);
        // Send setup message
        ws.send(JSON.stringify({
          setup: {
            model: `models/${modelName}`,
            config: {
              responseModalities: ['AUDIO', 'TEXT'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Orus' } }
              }
            }
          }
        }));
      };

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        
        // Handle text transcription from the model
        if (message.serverContent?.modelTurn?.parts) {
          for (const part of message.serverContent.modelTurn.parts) {
            if (part.text) {
              setCurrentAssistantText(prev => prev + part.text);
            }
          }
        }
        
        // Handle turn complete - save assistant message
        if (message.serverContent?.turnComplete) {
          if (currentAssistantText.trim()) {
            setTranscript(prev => [...prev, {
              timestamp: Date.now(),
              speaker: 'assistant',
              text: currentAssistantText.trim()
            }]);
            setCurrentAssistantText('');
          }
        }
        
        // Handle audio data
        if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
          const audio = message.serverContent.modelTurn.parts[0].inlineData;
          if (audio.data && outputContextRef.current) {
            nextStartTimeRef.current = Math.max(
              nextStartTimeRef.current,
              outputContextRef.current.currentTime
            );

            const audioData = base64ToArrayBuffer(audio.data);
            const audioBuffer = await decodeAudioData(
              audioData,
              outputContextRef.current,
              24000,
              1
            );
            
            const source = outputContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputNodeRef.current!);
            source.addEventListener('ended', () => {
              sourcesRef.current.delete(source);
            });
            
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            sourcesRef.current.add(source);
          }
        }

        if (message.serverContent?.interrupted) {
          for (const source of sourcesRef.current.values()) {
            source.stop();
            sourcesRef.current.delete(source);
          }
          nextStartTimeRef.current = 0;
        }
      };

      ws.onerror = (error) => {
        setError('Connection error');
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        setStatus('Disconnected');
        setIsLive(false);
      };
    } catch (err) {
      setError(err.message);
      console.error('Connection error:', err);
    }
  };

  // Start recording
  const startRecording = async () => {
    if (isRecording) return;

    try {
      setStatus('Requesting microphone access...');
      
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        await connectWebSocket();
      }

      inputContextRef.current?.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      mediaStreamRef.current = stream;

      setStatus('Microphone access granted. Starting capture...');

      const sourceNode = inputContextRef.current!.createMediaStreamSource(stream);
      sourceNode.connect(inputNodeRef.current!);
      sourceNodeRef.current = sourceNode;

      const bufferSize = 256;
      const scriptProcessor = inputContextRef.current!.createScriptProcessor(bufferSize, 1, 1);
      
      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        if (!isRecording) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);
        
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const blob = createBlob(pcmData);
          wsRef.current.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{
                data: blob.data,
                mimeType: blob.mimeType
              }]
            }
          }));
        }
      };

      sourceNode.connect(scriptProcessor);
      scriptProcessor.connect(inputContextRef.current!.destination);
      scriptProcessorRef.current = scriptProcessor;

      setIsRecording(true);
      setStatus('🔴 Recording...');
    } catch (err) {
      console.error('Error starting recording:', err);
      setStatus(`Error: ${err.message}`);
      stopRecording();
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (!isRecording) return;

    setStatus('Stopping recording...');
    setIsRecording(false);

    if (scriptProcessorRef.current && sourceNodeRef.current) {
      scriptProcessorRef.current.disconnect();
      sourceNodeRef.current.disconnect();
    }

    scriptProcessorRef.current = null;
    sourceNodeRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setStatus('Recording stopped. Click Start to begin again.');
  };

  // Reset session
  const reset = () => {
    stopRecording();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('Session cleared.');
    setTranscript([]);
    setCurrentUserText('');
    setCurrentAssistantText('');
    connectWebSocket();
  };
  
  // Save conversation to database
  const saveConversation = async () => {
    if (transcript.length === 0) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { error } = await supabase
        .from('voice_conversations')
        .insert({
          user_id: user.id,
          transcript: transcript,
          created_at: new Date().toISOString()
        });
        
      if (error) {
        console.error('Error saving conversation:', error);
      } else {
        console.log('Conversation saved successfully');
      }
    } catch (err) {
      console.error('Error saving conversation:', err);
    }
  };
  
  // Auto-save conversation when component unmounts or conversation ends
  useEffect(() => {
    return () => {
      if (transcript.length > 0) {
        saveConversation();
      }
    };
  }, [transcript]);

  // Helper functions
  const createBlob = (data: Float32Array) => {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: btoa(String.fromCharCode(...new Uint8Array(int16.buffer))),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number
  ) => {
    const buffer = ctx.createBuffer(numChannels, data.length / 2 / numChannels, sampleRate);
    const dataInt16 = new Int16Array(data.buffer);
    const dataFloat32 = new Float32Array(dataInt16.length);
    
    for (let i = 0; i < dataInt16.length; i++) {
      dataFloat32[i] = dataInt16[i] / 32768.0;
    }
    
    buffer.copyToChannel(dataFloat32, 0);
    return buffer;
  };
  
  // Handle text submission
  const handleTextSubmit = () => {
    if (!inputText.trim() || isRecording) return;
    
    // Add to transcript
    setTranscript(prev => [...prev, {
      timestamp: Date.now(),
      speaker: 'user',
      text: inputText.trim()
    }]);
    
    // Send to WebSocket if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        realtimeInput: {
          text: inputText.trim()
        }
      }));
    } else {
      // Try to connect if not connected
      connectWebSocket();
    }
    
    // Clear input
    setInputText('');
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-gray-900 to-black overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-gray-900/50 backdrop-blur-md border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium text-gray-200">Talk to EVA</h1>
          <div className="flex items-center gap-2">
            {isLive && (
              <div className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-green-400">Stream is live</span>
              </div>
            )}
            {error && (
              <div className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
                <span className="text-sm text-red-400">{error}</span>
              </div>
            )}
            {!isLive && !error && (
              <div className="px-3 py-1 bg-gray-500/20 border border-gray-500/30 rounded-full">
                <span className="text-sm text-gray-400">{status}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 3D Visualization */}
      <div ref={mountRef} className="absolute inset-0 z-0" style={{ width: '100%', height: '100%' }} />
      
      {/* Transcript Display */}
      <div className="absolute top-20 left-4 right-4 max-h-[40vh] overflow-y-auto z-20">
        <Card className="bg-gray-900/80 backdrop-blur-xl border-gray-700 p-4 shadow-2xl">
          <h3 className="text-gray-300 text-sm font-medium mb-3">Conversation with EVA</h3>
          <div className="space-y-2 text-sm">
            {transcript.map((entry, index) => (
              <div
                key={index}
                className={cn(
                  "p-2 rounded",
                  entry.speaker === 'user' 
                    ? "bg-blue-600/20 text-blue-300 ml-12 border border-blue-600/30" 
                    : "bg-purple-600/20 text-purple-300 mr-12 border border-purple-600/30"
                )}
              >
                <span className="font-medium">
                  {entry.speaker === 'user' ? 'You: ' : 'EVA: '}
                </span>
                {entry.text}
              </div>
            ))}
            {currentUserText && (
              <div className="p-2 rounded bg-blue-600/20 text-blue-300 ml-12 opacity-70 border border-blue-600/30">
                <span className="font-medium">You: </span>
                {currentUserText}
              </div>
            )}
            {currentAssistantText && (
              <div className="p-2 rounded bg-purple-600/20 text-purple-300 mr-12 opacity-70 border border-purple-600/30">
                <span className="font-medium">EVA: </span>
                {currentAssistantText}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Input and Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gray-900/80 backdrop-blur-md border-t border-gray-800">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            {/* Text Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Start typing a prompt"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && inputText.trim()) {
                    handleTextSubmit();
                  }
                }}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-full text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                disabled={isRecording}
              />
            </div>
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Talk Button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  "px-4 py-2 rounded-full flex items-center gap-2 transition-all",
                  isRecording 
                    ? "bg-red-600 hover:bg-red-700 text-white" 
                    : "bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
                )}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C10.34 2 9 3.34 9 5v7c0 1.66 1.34 3 3 3s3-1.34 3-3V5c0-1.66-1.34-3-3-3zm0 16c-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V22h2v-2.08c3.39-.49 6-3.39 6-6.92h-2c0 2.76-2.24 5-5 5z"/>
                </svg>
                {isRecording ? 'Stop' : 'Talk'}
              </button>
              
              {/* Webcam Button */}
              <button
                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600 transition-all"
                title="Webcam (coming soon)"
                disabled
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              </button>
              
              {/* Screen Share Button */}
              <button
                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600 transition-all"
                title="Share Screen (coming soon)"
                disabled
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78 0-4.61.85-6 2.72.56-2.67 2.11-5.33 6-5.87V7l4 3.73-4 3.74z"/>
                </svg>
              </button>
              
              {/* Run Button */}
              <button
                onClick={handleTextSubmit}
                disabled={!inputText.trim() || isRecording}
                className={cn(
                  "px-4 py-2 rounded-full text-white transition-all flex items-center gap-2",
                  inputText.trim() && !isRecording
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-gray-700 cursor-not-allowed opacity-50"
                )}
              >
                Run
                <span className="text-xs opacity-70">Ctrl ↵</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}