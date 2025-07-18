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

interface SessionState {
  sessionId: string;
  conversationHistory: TranscriptEntry[];
  contextSummary?: string;
}

interface VADConfig {
  disabled: boolean;
  startOfSpeechSensitivity: 'START_SENSITIVITY_LOW' | 'START_SENSITIVITY_MEDIUM' | 'START_SENSITIVITY_HIGH';
  endOfSpeechSensitivity: 'END_SENSITIVITY_LOW' | 'END_SENSITIVITY_MEDIUM' | 'END_SENSITIVITY_HIGH';
  prefixPaddingMs: number;
  silenceDurationMs: number;
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
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [useNativeAudio, setUseNativeAudio] = useState(true);
  const [enableTranscription, setEnableTranscription] = useState(true);
  const [vadConfig, setVadConfig] = useState<VADConfig>({
    disabled: false,
    startOfSpeechSensitivity: 'START_SENSITIVITY_MEDIUM',
    endOfSpeechSensitivity: 'END_SENSITIVITY_MEDIUM',
    prefixPaddingMs: 100,
    silenceDurationMs: 500
  });
  const [audioChunksBuffer, setAudioChunksBuffer] = useState<{data: string, mimeType: string}[]>([]);
  
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const rotationRef = useRef(new THREE.Vector3(0, 0, 0));
  const sceneObjectsRef = useRef<any>(null);
  
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

    // Get container dimensions
    const container = mountRef.current;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x100c14);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      1000
    );
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Create audio waveform visualization inspired by the reference image
    const waveformSegments = 128;
    const waveformGeometry = new THREE.BufferGeometry();
    const waveformPositions = new Float32Array(waveformSegments * 2 * 3); // Line segments
    const waveformColors = new Float32Array(waveformSegments * 2 * 3);
    
    // Initialize waveform as horizontal line
    for (let i = 0; i < waveformSegments; i++) {
      const x = (i / (waveformSegments - 1)) * 8 - 4; // Spread across 8 units
      const idx = i * 6; // 2 vertices * 3 coordinates
      
      // Bottom vertex
      waveformPositions[idx] = x;
      waveformPositions[idx + 1] = 0;
      waveformPositions[idx + 2] = 0;
      
      // Top vertex (will be animated)
      waveformPositions[idx + 3] = x;
      waveformPositions[idx + 4] = 0;
      waveformPositions[idx + 5] = 0;
      
      // Colors - purple to blue gradient like the reference
      const t = i / (waveformSegments - 1);
      const r = 0.6 - t * 0.3; // Purple to blue
      const g = 0.3 + t * 0.4;
      const b = 0.9 + t * 0.1;
      
      // Set colors for both vertices
      waveformColors[idx] = r;
      waveformColors[idx + 1] = g;
      waveformColors[idx + 2] = b;
      waveformColors[idx + 3] = r;
      waveformColors[idx + 4] = g;
      waveformColors[idx + 5] = b;
    }
    
    waveformGeometry.setAttribute('position', new THREE.BufferAttribute(waveformPositions, 3));
    waveformGeometry.setAttribute('color', new THREE.BufferAttribute(waveformColors, 3));
    
    const waveformMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      linewidth: 3,
    });
    
    const waveform = new THREE.LineSegments(waveformGeometry, waveformMaterial);
    scene.add(waveform);
    sphereRef.current = waveform;

    // Enhanced Lighting Setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x4f46e5, 2, 100);
    pointLight1.position.set(5, 5, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x7c3aed, 1.5, 100);
    pointLight2.position.set(-5, -5, 5);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0x06b6d4, 1, 100);
    pointLight3.position.set(0, 0, 10);
    scene.add(pointLight3);

    // Add rim lighting
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(0, 0, -1);
    scene.add(rimLight);

    // Post-processing
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      2.5,
      0.8,
      0.1
    );
    composer.addPass(bloomPass);
    composerRef.current = composer;

    // Add subtle energy rings for speech visualization
    const ringCount = 3;
    const rings = [];
    
    for (let r = 0; r < ringCount; r++) {
      const ringGeometry = new THREE.RingGeometry(3 + r * 0.8, 3.2 + r * 0.8, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.4 + r * 0.2, 0.6 + r * 0.1, 1),
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0, 0);
      scene.add(ring);
      rings.push(ring);
    }
    
    // Add flowing particles - fewer and more elegant
    const particleCount = 100;
    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      // Create subtle spiral pattern
      const angle = (i / particleCount) * Math.PI * 4;
      const radius = 4 + Math.sin(angle) * 0.5;
      const height = Math.sin(angle * 0.5) * 2;
      
      particlePositions[i * 3] = radius * Math.cos(angle);
      particlePositions[i * 3 + 1] = height;
      particlePositions[i * 3 + 2] = radius * Math.sin(angle);
      
      // Subtle gradient colors
      const t = i / particleCount;
      particleColors[i * 3] = 0.3 + t * 0.4;     // Red
      particleColors[i * 3 + 1] = 0.5 + t * 0.3; // Green
      particleColors[i * 3 + 2] = 0.9;           // Blue
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    
    // Create soft dot texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // Create soft circular gradient
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    
    const particleTexture = new THREE.CanvasTexture(canvas);
    
    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      map: particleTexture,
      alphaTest: 0.001,
      depthWrite: false,
    });
    
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    // Store references for animation
    const sceneObjects = {
      particles,
      rings,
      waveform,
      waveformSegments,
      particleCount,
      pointLight1,
      pointLight2,
      pointLight3,
    };
    sceneObjectsRef.current = sceneObjects;

    // Handle resize
    const handleResize = () => {
      const newRect = container.getBoundingClientRect();
      const newWidth = newRect.width;
      const newHeight = newRect.height;
      
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      composer.setSize(newWidth, newHeight);
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

      if (sceneObjectsRef.current?.waveform) {
        const outputData = outputAnalyserRef.current?.data || new Uint8Array(128);
        const inputData = inputAnalyserRef.current?.data || new Uint8Array(128);

        // Get audio data for waveform animation
        const avgOutput = outputData.reduce((a, b) => a + b, 0) / outputData.length;
        const avgInput = inputData.reduce((a, b) => a + b, 0) / inputData.length;
        
        // Animate waveform based on audio input
        const waveformPositions = sceneObjectsRef.current.waveform.geometry.attributes.position.array;
        const waveformColors = sceneObjectsRef.current.waveform.geometry.attributes.color.array;
        
        for (let i = 0; i < sceneObjectsRef.current.waveformSegments; i++) {
          const idx = i * 6; // 2 vertices * 3 coordinates
          
          // Use audio data to create waveform heights
          const audioIndex = Math.floor((i / sceneObjectsRef.current.waveformSegments) * Math.min(outputData.length, inputData.length));
          const outputLevel = (outputData[audioIndex] || 0) / 255;
          const inputLevel = (inputData[audioIndex] || 0) / 255;
          
          // Create complex waveform pattern
          const baseHeight = Math.sin((i / sceneObjectsRef.current.waveformSegments) * Math.PI * 4 + t * 0.001) * 0.2;
          const audioHeight = (outputLevel + inputLevel) * 2;
          const totalHeight = baseHeight + audioHeight;
          
          // Update top vertex height
          waveformPositions[idx + 4] = totalHeight;
          
          // Update bottom vertex for symmetry
          waveformPositions[idx + 1] = -totalHeight * 0.3;
          
          // Dynamic color based on audio intensity
          const intensity = (outputLevel + inputLevel) * 0.5 + 0.5;
          const t_norm = i / (sceneObjectsRef.current.waveformSegments - 1);
          
          // Enhanced color gradient
          const r = 0.6 - t_norm * 0.3 + intensity * 0.2;
          const g = 0.3 + t_norm * 0.4 + intensity * 0.3;
          const b = 0.9 + t_norm * 0.1 + intensity * 0.1;
          
          // Update colors for both vertices
          waveformColors[idx] = r;
          waveformColors[idx + 1] = g;
          waveformColors[idx + 2] = b;
          waveformColors[idx + 3] = r;
          waveformColors[idx + 4] = g;
          waveformColors[idx + 5] = b;
        }
        
        sceneObjectsRef.current.waveform.geometry.attributes.position.needsUpdate = true;
        sceneObjectsRef.current.waveform.geometry.attributes.color.needsUpdate = true;

        // Enhanced camera movement with speech responsiveness
        const speechMotion = (avgOutput + avgInput) / 510;
        const radius = 8 + Math.sin(t * 0.001) * 1 + speechMotion * 0.5;
        const x = radius * Math.cos(t * 0.0005);
        const z = radius * Math.sin(t * 0.0005);
        const y = Math.sin(t * 0.0003) * 2 + speechMotion * 1;

        camera.position.set(x, y, z);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        // Animate energy rings based on speech
        const avgAudio = (avgInput + avgOutput) / 510;
        sceneObjectsRef.current.rings.forEach((ring, index) => {
          const intensity = avgAudio * 0.5 + 0.1;
          ring.material.opacity = intensity * (0.2 - index * 0.05);
          ring.scale.setScalar(1 + intensity * 0.1);
          ring.rotation.z += dt * 0.0001 * (index + 1);
        });
        
        // Animate particles - gentle spiral motion
        const positions = sceneObjectsRef.current.particles.geometry.attributes.position.array;
        const colors = sceneObjectsRef.current.particles.geometry.attributes.color.array;
        
        for (let i = 0; i < sceneObjectsRef.current.particleCount; i++) {
          const i3 = i * 3;
          const time = t * 0.001;
          const audioIntensity = (inputData[i % inputData.length] + outputData[i % outputData.length]) / 510;
          
          // Gentle spiral movement
          const baseAngle = (i / sceneObjectsRef.current.particleCount) * Math.PI * 4;
          const spiralOffset = time * 0.2;
          const angle = baseAngle + spiralOffset;
          const radius = 4 + Math.sin(angle) * 0.5 + audioIntensity * 0.3;
          const height = Math.sin(angle * 0.5) * 2 + audioIntensity * 0.5;
          
          positions[i3] = radius * Math.cos(angle);
          positions[i3 + 1] = height;
          positions[i3 + 2] = radius * Math.sin(angle);
          
          // Subtle color changes
          const t_norm = i / sceneObjectsRef.current.particleCount;
          const intensity = audioIntensity * 0.3 + 0.3;
          colors[i3] = 0.3 + t_norm * 0.4 + intensity * 0.2;
          colors[i3 + 1] = 0.5 + t_norm * 0.3 + intensity * 0.2;
          colors[i3 + 2] = 0.9;
        }
        
        sceneObjectsRef.current.particles.geometry.attributes.position.needsUpdate = true;
        sceneObjectsRef.current.particles.geometry.attributes.color.needsUpdate = true;
        
        // Animate lights based on speech
        sceneObjectsRef.current.pointLight1.intensity = 2 + (avgOutput / 255) * 2;
        sceneObjectsRef.current.pointLight2.intensity = 1.5 + (avgInput / 255) * 1.5;
        sceneObjectsRef.current.pointLight3.intensity = 1 + ((avgOutput + avgInput) / 510) * 2;
      }

      composer.render();
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
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
  const connectWebSocket = async (resumeSession?: SessionState) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const wsBaseUrl = supabaseUrl.replace('https://', 'wss://');
      
      // Use documented model names
      const modelName = useNativeAudio 
        ? 'gemini-2.5-flash-preview-native-audio-dialog' 
        : 'gemini-live-2.5-flash-preview';
      
      const wsUrl = `${wsBaseUrl}/functions/v1/gemini-websocket?model=${encodeURIComponent(modelName)}&token=${encodeURIComponent(session.access_token)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('Connected');
        setIsLive(true);
        
        // Build configuration based on settings
        const config: any = {
          responseModalities: ['AUDIO'], // Use single modality as per docs
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Orus' } }
          }
        };

        // Add transcription if enabled
        if (enableTranscription) {
          config.inputAudioTranscription = {};
          config.outputAudioTranscription = {};
        }

        // Add VAD configuration
        if (!vadConfig.disabled) {
          config.realtimeInputConfig = {
            automaticActivityDetection: {
              disabled: vadConfig.disabled,
              startOfSpeechSensitivity: vadConfig.startOfSpeechSensitivity,
              endOfSpeechSensitivity: vadConfig.endOfSpeechSensitivity,
              prefixPaddingMs: vadConfig.prefixPaddingMs,
              silenceDurationMs: vadConfig.silenceDurationMs
            }
          };
        }

        // Send setup message
        ws.send(JSON.stringify({
          setup: {
            model: `models/${modelName}`,
            config
          }
        }));

        // Resume session if provided
        if (resumeSession) {
          ws.send(JSON.stringify({
            clientContent: {
              turns: resumeSession.conversationHistory.map(entry => ({
                role: entry.speaker === 'user' ? 'user' : 'model',
                parts: [{ text: entry.text }]
              })),
              turnComplete: false
            }
          }));
        }
      };

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        
        // Handle input transcription (user speech to text)
        if (message.serverContent?.inputTranscription) {
          setCurrentUserText(prev => prev + message.serverContent.inputTranscription.text);
        }
        
        // Handle output transcription (model speech to text)
        if (message.serverContent?.outputTranscription) {
          setCurrentAssistantText(prev => prev + message.serverContent.outputTranscription.text);
        }
        
        // Handle text transcription from the model
        if (message.serverContent?.modelTurn?.parts) {
          for (const part of message.serverContent.modelTurn.parts) {
            if (part.text) {
              setCurrentAssistantText(prev => prev + part.text);
            }
          }
        }
        
        // Handle turn complete - save messages
        if (message.serverContent?.turnComplete) {
          // Save user message if we have transcription
          if (currentUserText.trim()) {
            setTranscript(prev => [...prev, {
              timestamp: Date.now(),
              speaker: 'user',
              text: currentUserText.trim()
            }]);
            setCurrentUserText('');
          }
          
          // Save assistant message
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

        // Enhanced interruption handling
        if (message.serverContent?.interrupted) {
          console.log('Generation interrupted, stopping audio playback');
          
          // Stop all audio sources
          for (const source of sourcesRef.current.values()) {
            try {
              source.stop();
            } catch (error) {
              console.warn('Error stopping audio source:', error);
            }
            sourcesRef.current.delete(source);
          }
          
          // Reset audio timing
          nextStartTimeRef.current = outputContextRef.current?.currentTime || 0;
          
          // Clear current partial responses
          if (currentAssistantText.trim()) {
            setTranscript(prev => [...prev, {
              timestamp: Date.now(),
              speaker: 'assistant',
              text: currentAssistantText.trim() + ' [interrupted]'
            }]);
            setCurrentAssistantText('');
          }
          
          // Update status
          setStatus('🔴 Interrupted - Continue speaking');
        }

        // Handle function call cancellations (if any)
        if (message.serverContent?.cancelled) {
          console.log('Function calls cancelled due to interruption');
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

      // Try to use AudioWorkletNode first, fallback to ScriptProcessorNode
      try {
        // Check if AudioWorklet is supported
        if (inputContextRef.current!.audioWorklet) {
          // For now, use ScriptProcessorNode as fallback since AudioWorklet requires separate worklet file
          // TODO: Implement AudioWorklet processor in a separate file
          const bufferSize = 256;
          const scriptProcessor = inputContextRef.current!.createScriptProcessor(bufferSize, 1, 1);
          
          scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
            if (!isRecording) return;

            const inputBuffer = audioProcessingEvent.inputBuffer;
            const pcmData = inputBuffer.getChannelData(0);
            
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              const blob = createBlob(pcmData);
              
              // Buffer audio chunks to send as array (as per documentation)
              setAudioChunksBuffer(prev => {
                const newBuffer = [...prev, {
                  data: blob.data,
                  mimeType: blob.mimeType
                }];
                
                // Send buffered chunks periodically (every 10 chunks or ~100ms)
                if (newBuffer.length >= 10) {
                  wsRef.current?.send(JSON.stringify({
                    realtimeInput: {
                      mediaChunks: newBuffer
                    }
                  }));
                  return []; // Clear buffer
                }
                
                return newBuffer;
              });
            }
          };

          sourceNode.connect(scriptProcessor);
          scriptProcessor.connect(inputContextRef.current!.destination);
          scriptProcessorRef.current = scriptProcessor;
        }
      } catch (error) {
        console.warn('AudioWorklet not supported, using ScriptProcessorNode');
        // Fallback already implemented above
      }

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

    // Flush any remaining audio chunks
    flushAudioBuffer();

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
    setAudioChunksBuffer([]);
    connectWebSocket();
  };

  // Save session state
  const saveSession = () => {
    const sessionData: SessionState = {
      sessionId: Date.now().toString(),
      conversationHistory: transcript,
      contextSummary: transcript.length > 10 ? 'Long conversation in progress' : undefined
    };
    
    localStorage.setItem('eva-session', JSON.stringify(sessionData));
    console.log('Session saved');
  };

  // Load session state
  const loadSession = () => {
    const savedSession = localStorage.getItem('eva-session');
    if (savedSession) {
      const sessionData: SessionState = JSON.parse(savedSession);
      setTranscript(sessionData.conversationHistory);
      connectWebSocket(sessionData);
      console.log('Session loaded');
    }
  };

  // Send any remaining buffered audio chunks when stopping
  const flushAudioBuffer = () => {
    if (audioChunksBuffer.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        realtimeInput: {
          mediaChunks: audioChunksBuffer
        }
      }));
      setAudioChunksBuffer([]);
    }
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
            {/* Model Selection */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setUseNativeAudio(!useNativeAudio)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  useNativeAudio 
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-600/30' 
                    : 'bg-gray-600/20 text-gray-400 border border-gray-600/30'
                }`}
                title="Toggle Native Audio Model"
              >
                {useNativeAudio ? 'Native' : 'Half-Cascade'}
              </button>
              <button
                onClick={() => setEnableTranscription(!enableTranscription)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  enableTranscription 
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30' 
                    : 'bg-gray-600/20 text-gray-400 border border-gray-600/30'
                }`}
                title="Toggle Transcription"
              >
                {enableTranscription ? 'TXT' : 'NO-TXT'}
              </button>
            </div>

            {/* Session Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={saveSession}
                className="px-2 py-1 bg-gray-600/20 text-gray-400 border border-gray-600/30 rounded text-xs hover:bg-gray-600/30 transition-colors"
                title="Save Session"
              >
                💾
              </button>
              <button
                onClick={loadSession}
                className="px-2 py-1 bg-gray-600/20 text-gray-400 border border-gray-600/30 rounded text-xs hover:bg-gray-600/30 transition-colors"
                title="Load Session"
              >
                📂
              </button>
              <button
                onClick={reset}
                className="px-2 py-1 bg-gray-600/20 text-gray-400 border border-gray-600/30 rounded text-xs hover:bg-gray-600/30 transition-colors"
                title="Reset Session"
              >
                🔄
              </button>
            </div>

            {/* Status Indicators */}
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
        <div className="flex gap-4">
          <Card className="flex-1 bg-gray-900/80 backdrop-blur-xl border-gray-700 p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-300 text-sm font-medium">Conversation with EVA</h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Model: {useNativeAudio ? 'Native Audio' : 'Half-Cascade'}</span>
                <span>•</span>
                <span>Transcription: {enableTranscription ? 'ON' : 'OFF'}</span>
              </div>
            </div>
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

          {/* VAD Configuration Panel */}
          <Card className="w-80 bg-gray-900/80 backdrop-blur-xl border-gray-700 p-4 shadow-2xl">
            <h3 className="text-gray-300 text-sm font-medium mb-3">Voice Activity Detection</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Enable VAD</span>
                <button
                  onClick={() => setVadConfig(prev => ({ ...prev, disabled: !prev.disabled }))}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    !vadConfig.disabled 
                      ? 'bg-green-600/20 text-green-300 border border-green-600/30' 
                      : 'bg-red-600/20 text-red-300 border border-red-600/30'
                  }`}
                >
                  {vadConfig.disabled ? 'OFF' : 'ON'}
                </button>
              </div>
              
              <div>
                <label className="block text-gray-400 mb-1">Start Sensitivity</label>
                <select
                  value={vadConfig.startOfSpeechSensitivity}
                  onChange={(e) => setVadConfig(prev => ({ ...prev, startOfSpeechSensitivity: e.target.value as any }))}
                  className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-200 text-xs"
                >
                  <option value="START_SENSITIVITY_LOW">Low</option>
                  <option value="START_SENSITIVITY_MEDIUM">Medium</option>
                  <option value="START_SENSITIVITY_HIGH">High</option>
                </select>
              </div>
              
              <div>
                <label className="block text-gray-400 mb-1">End Sensitivity</label>
                <select
                  value={vadConfig.endOfSpeechSensitivity}
                  onChange={(e) => setVadConfig(prev => ({ ...prev, endOfSpeechSensitivity: e.target.value as any }))}
                  className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-200 text-xs"
                >
                  <option value="END_SENSITIVITY_LOW">Low</option>
                  <option value="END_SENSITIVITY_MEDIUM">Medium</option>
                  <option value="END_SENSITIVITY_HIGH">High</option>
                </select>
              </div>
              
              <div>
                <label className="block text-gray-400 mb-1">Prefix Padding (ms)</label>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="50"
                  value={vadConfig.prefixPaddingMs}
                  onChange={(e) => setVadConfig(prev => ({ ...prev, prefixPaddingMs: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{vadConfig.prefixPaddingMs}ms</span>
              </div>
              
              <div>
                <label className="block text-gray-400 mb-1">Silence Duration (ms)</label>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={vadConfig.silenceDurationMs}
                  onChange={(e) => setVadConfig(prev => ({ ...prev, silenceDurationMs: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">{vadConfig.silenceDurationMs}ms</span>
              </div>
            </div>
          </Card>
        </div>
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