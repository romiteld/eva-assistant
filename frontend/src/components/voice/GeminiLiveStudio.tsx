'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/browser';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

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
  const rotationRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
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

  // Initialize 3D scene with dynamic loading
  useEffect(() => {
    if (!mountRef.current) return;

    let cleanup: (() => void) | null = null;
    
    const initializeScene = () => {
      try {
        
        // Get container dimensions
        const container = mountRef.current;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x100c14);
        sceneRef.current = scene;

    // Camera - positioned to center the waveform
    const camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      1000
    );
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Create incredible audio-reactive 3D visualization
    
    // 1. Main Central Orb - Audio-reactive energy core
    const orbGeometry = new THREE.SphereGeometry(0.8, 64, 64);
    const orbMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        audioLevel: { value: 0 },
        audioFrequency: { value: 0 },
        resolution: { value: { x: width, y: height } },
        color1: { value: new THREE.Color(0x4f46e5) },
        color2: { value: new THREE.Color(0x7c3aed) },
        color3: { value: new THREE.Color(0x06b6d4) },
      },
      vertexShader: `
        uniform float time;
        uniform float audioLevel;
        uniform float audioFrequency;
        
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        
        // Noise function for organic movement
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        
        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          
          i = mod289(i);
          vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          
          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          
          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
          
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }
        
        void main() {
          vUv = uv;
          vPosition = position;
          vNormal = normal;
          
          // Create dynamic surface displacement based on audio
          float noise1 = snoise(position * 2.0 + time * 0.5);
          float noise2 = snoise(position * 4.0 + time * 1.0);
          float noise3 = snoise(position * 8.0 + time * 2.0);
          
          // Combine different noise scales for organic movement
          float displacement = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;
          
          // Audio-reactive displacement
          displacement *= (0.3 + audioLevel * 2.0);
          
          // Add frequency-based spikes
          float frequencySpikes = sin(audioFrequency * 0.01 + time * 3.0) * audioLevel;
          displacement += frequencySpikes * 0.5;
          
          // Apply displacement along vertex normal
          vec3 newPosition = position + normal * displacement;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float audioLevel;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform vec3 color3;
        uniform vec2 resolution;
        
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        
        void main() {
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          
          // Fresnel effect for energy glow
          float fresnel = 1.0 - max(0.0, dot(viewDirection, vNormal));
          fresnel = pow(fresnel, 2.0);
          
          // Dynamic color mixing based on audio and position
          vec3 color = mix(color1, color2, sin(time * 0.5 + vPosition.y * 2.0) * 0.5 + 0.5);
          color = mix(color, color3, audioLevel * 0.7);
          
          // Energy field effect
          float energy = fresnel * (1.0 + audioLevel * 2.0);
          
          // Pulsing inner glow
          float pulse = 0.7 + 0.3 * sin(time * 4.0 + audioLevel * 10.0);
          energy *= pulse;
          
          // Add sparkle effect
          float sparkle = sin(vPosition.x * 50.0 + time * 10.0) * 
                         sin(vPosition.y * 50.0 + time * 8.0) * 
                         sin(vPosition.z * 50.0 + time * 12.0);
          sparkle = max(0.0, sparkle);
          sparkle *= audioLevel * 0.5;
          
          color += vec3(sparkle) * 0.8;
          
          gl_FragColor = vec4(color * energy, 0.8 + fresnel * 0.2);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    
    const orb = new THREE.Mesh(orbGeometry, orbMaterial);
    orb.position.set(0, 0, 0);
    scene.add(orb);
    sphereRef.current = orb;
    
    // 2. Advanced Particle System - DNA-like helical structures
    const particleCount = 2000;
    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particlePhases = new Float32Array(particleCount);
    
    // Create helical DNA-like particle arrangements
    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      const angle = t * Math.PI * 20; // Multiple spirals
      const radius = 3 + Math.sin(t * Math.PI * 4) * 1.5;
      const height = (t - 0.5) * 10;
      
      // Primary helix
      particlePositions[i * 3] = radius * Math.cos(angle);
      particlePositions[i * 3 + 1] = height;
      particlePositions[i * 3 + 2] = radius * Math.sin(angle);
      
      // Random velocity for organic motion
      particleVelocities[i * 3] = (Math.random() - 0.5) * 0.02;
      particleVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
      
      // Color gradients
      const hue = (t * 0.3 + 0.7) % 1.0;
      particleColors[i * 3] = 0.2 + t * 0.8;
      particleColors[i * 3 + 1] = 0.4 + Math.sin(t * Math.PI * 2) * 0.3;
      particleColors[i * 3 + 2] = 0.9 - t * 0.3;
      
      // Size and phase variation
      particleSizes[i] = 0.5 + Math.random() * 1.5;
      particlePhases[i] = Math.random() * Math.PI * 2;
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particlesGeometry.setAttribute('velocity', new THREE.BufferAttribute(particleVelocities, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    particlesGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    particlesGeometry.setAttribute('phase', new THREE.BufferAttribute(particlePhases, 1));
    
    // Advanced particle material with audio reactivity
    const particlesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        audioLevel: { value: 0 },
        audioFrequency: { value: 0 },
        pixelRatio: { value: window.devicePixelRatio },
      },
      vertexShader: `
        uniform float time;
        uniform float audioLevel;
        uniform float audioFrequency;
        uniform float pixelRatio;
        
        attribute float size;
        attribute float phase;
        attribute vec3 velocity;
        attribute vec3 color;
        
        varying vec3 vColor;
        varying float vAudioLevel;
        
        void main() {
          vColor = color;
          vAudioLevel = audioLevel;
          
          // Organic movement with audio influence
          vec3 pos = position;
          
          // Flowing motion
          pos.x += sin(time * 0.5 + phase) * 0.3;
          pos.y += cos(time * 0.3 + phase) * 0.2;
          pos.z += sin(time * 0.7 + phase) * 0.25;
          
          // Audio-reactive expansion
          float audioInfluence = 1.0 + audioLevel * 3.0;
          pos *= audioInfluence;
          
          // Pulsing with frequency
          float pulse = 1.0 + sin(audioFrequency * 0.01 + time * 2.0 + phase) * audioLevel * 0.5;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          
          // Dynamic size based on audio and distance
          float finalSize = size * pulse * (1.0 + audioLevel * 2.0);
          finalSize *= (300.0 / -mvPosition.z); // Size attenuation
          
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = finalSize * pixelRatio;
        }
      `,
      fragmentShader: `
        uniform float time;
        
        varying vec3 vColor;
        varying float vAudioLevel;
        
        void main() {
          // Create soft circular particles
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distance = length(coord);
          
          if (distance > 0.5) discard;
          
          // Soft falloff
          float alpha = 1.0 - smoothstep(0.0, 0.5, distance);
          alpha *= alpha; // Quadratic falloff
          
          // Energy glow effect
          float energy = 1.0 + vAudioLevel * 2.0;
          vec3 color = vColor * energy;
          
          // Sparkle effect
          float sparkle = sin(time * 10.0 + distance * 20.0) * 0.5 + 0.5;
          color += vec3(sparkle * vAudioLevel * 0.3);
          
          gl_FragColor = vec4(color, alpha * (0.6 + vAudioLevel * 0.4));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);
    
    // 3. Energy Field - Surrounding electromagnetic field
    const fieldGeometry = new THREE.SphereGeometry(2.5, 32, 32);
    const fieldMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        audioLevel: { value: 0 },
        audioFrequency: { value: 0 },
      },
      vertexShader: `
        uniform float time;
        uniform float audioLevel;
        
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          vPosition = position;
          vNormal = normal;
          
          // Subtle breathing motion
          vec3 pos = position * (1.0 + sin(time * 0.8) * 0.05 + audioLevel * 0.2);
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float audioLevel;
        uniform float audioFrequency;
        
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        
        void main() {
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          
          // Fresnel for energy field effect
          float fresnel = 1.0 - max(0.0, dot(viewDirection, vNormal));
          fresnel = pow(fresnel, 3.0);
          
          // Dynamic field lines
          float lines = sin(vPosition.x * 20.0 + time * 2.0) * 
                       sin(vPosition.y * 20.0 + time * 1.5) * 
                       sin(vPosition.z * 20.0 + time * 1.8);
          lines = max(0.0, lines);
          
          // Audio-reactive intensity
          float intensity = fresnel * (0.3 + audioLevel * 1.5);
          intensity += lines * audioLevel * 0.3;
          
          // Color shifting with audio frequency
          vec3 color = vec3(0.3, 0.6, 1.0);
          color.r += sin(audioFrequency * 0.01 + time) * 0.3;
          color.g += cos(audioFrequency * 0.01 + time * 0.7) * 0.2;
          
          gl_FragColor = vec4(color * intensity, intensity * 0.4);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    
    const energyField = new THREE.Mesh(fieldGeometry, fieldMaterial);
    scene.add(energyField);

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
    const floorParticleCount = 100;
    const floorParticlesGeometry = new THREE.BufferGeometry();
    const floorParticlePositions = new Float32Array(floorParticleCount * 3);
    const floorParticleColors = new Float32Array(floorParticleCount * 3);
    
    for (let i = 0; i < floorParticleCount; i++) {
      // Create subtle spiral pattern
      const angle = (i / floorParticleCount) * Math.PI * 4;
      const radius = 4 + Math.sin(angle) * 0.5;
      const height = Math.sin(angle * 0.5) * 2;
      
      floorParticlePositions[i * 3] = radius * Math.cos(angle);
      floorParticlePositions[i * 3 + 1] = height;
      floorParticlePositions[i * 3 + 2] = radius * Math.sin(angle);
      
      // Subtle gradient colors
      const t = i / floorParticleCount;
      floorParticleColors[i * 3] = 0.3 + t * 0.4;     // Red
      floorParticleColors[i * 3 + 1] = 0.5 + t * 0.3; // Green
      floorParticleColors[i * 3 + 2] = 0.9;           // Blue
    }
    
    floorParticlesGeometry.setAttribute('position', new THREE.BufferAttribute(floorParticlePositions, 3));
    floorParticlesGeometry.setAttribute('color', new THREE.BufferAttribute(floorParticleColors, 3));
    
    // Create soft dot texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // Create soft circular gradient
    const gradient = ctx!.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    
    ctx!.fillStyle = gradient;
    ctx!.fillRect(0, 0, 32, 32);
    
    const particleTexture = new THREE.CanvasTexture(canvas);
    
    const floorParticlesMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      map: particleTexture,
      alphaTest: 0.001,
      depthWrite: false,
    });
    
    const floorParticles = new THREE.Points(floorParticlesGeometry, floorParticlesMaterial);
    scene.add(floorParticles);

    // Store references for animation
    const sceneObjects = {
      orb,
      orbMaterial,
      particles,
      particlesMaterial,
      floorParticles,
      floorParticlesMaterial,
      energyField,
      fieldMaterial,
      floorParticlesGeometry,
      rings,
      floorParticleCount,
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

      if (sceneObjectsRef.current?.orb) {
        const outputData = outputAnalyserRef.current?.data || new Uint8Array(128);
        const inputData = inputAnalyserRef.current?.data || new Uint8Array(128);

        // Advanced audio analysis
        const avgOutput = outputData.reduce((a, b) => a + b, 0) / outputData.length;
        const avgInput = inputData.reduce((a, b) => a + b, 0) / inputData.length;
        const totalAudioLevel = (avgOutput + avgInput) / 510;
        
        // Find dominant frequency
        let maxAmplitude = 0;
        let dominantFrequency = 0;
        for (let i = 0; i < outputData.length; i++) {
          if (outputData[i] > maxAmplitude) {
            maxAmplitude = outputData[i];
            dominantFrequency = i;
          }
        }
        
        // Smooth audio level for better visual flow
        const smoothedAudioLevel = totalAudioLevel * 0.7 + (sceneObjectsRef.current.lastAudioLevel || 0) * 0.3;
        sceneObjectsRef.current.lastAudioLevel = smoothedAudioLevel;
        
        // Update shader uniforms for the orb
        if (sceneObjectsRef.current.orbMaterial) {
          sceneObjectsRef.current.orbMaterial.uniforms.time.value = t * 0.001;
          sceneObjectsRef.current.orbMaterial.uniforms.audioLevel.value = smoothedAudioLevel;
          sceneObjectsRef.current.orbMaterial.uniforms.audioFrequency.value = dominantFrequency;
        }
        
        // Animate the orb with organic rotation
        const orb = sceneObjectsRef.current.orb;
        orb.rotation.x += dt * 0.0003 * (1 + smoothedAudioLevel);
        orb.rotation.y += dt * 0.0005 * (1 + smoothedAudioLevel * 0.5);
        orb.rotation.z += dt * 0.0002 * (1 + smoothedAudioLevel * 0.8);
        
        // Update particle system
        if (sceneObjectsRef.current.particlesMaterial) {
          sceneObjectsRef.current.particlesMaterial.uniforms.time.value = t * 0.001;
          sceneObjectsRef.current.particlesMaterial.uniforms.audioLevel.value = smoothedAudioLevel;
          sceneObjectsRef.current.particlesMaterial.uniforms.audioFrequency.value = dominantFrequency;
        }
        
        // Animate particle positions for organic flow
        const positions = sceneObjectsRef.current.floorParticlesGeometry.attributes.position.array;
        const particleCount = sceneObjectsRef.current.floorParticleCount;
        
        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          const t_norm = i / particleCount;
          const time = t * 0.001;
          
          // Original helical position
          const angle = t_norm * Math.PI * 20 + time * 0.3;
          const radius = 3 + Math.sin(t_norm * Math.PI * 4) * 1.5;
          const height = (t_norm - 0.5) * 10;
          
          // Add organic flow and audio reactivity
          const flowOffset = Math.sin(time * 0.5 + t_norm * Math.PI * 4) * 0.5;
          const audioInfluence = 1 + smoothedAudioLevel * 2;
          
          positions[i3] = (radius + flowOffset) * Math.cos(angle) * audioInfluence;
          positions[i3 + 1] = height + Math.sin(time * 0.3 + t_norm * Math.PI * 2) * 0.3;
          positions[i3 + 2] = (radius + flowOffset) * Math.sin(angle) * audioInfluence;
        }
        
        sceneObjectsRef.current.floorParticlesGeometry.attributes.position.needsUpdate = true;
        
        // Update energy field
        if (sceneObjectsRef.current.fieldMaterial) {
          sceneObjectsRef.current.fieldMaterial.uniforms.time.value = t * 0.001;
          sceneObjectsRef.current.fieldMaterial.uniforms.audioLevel.value = smoothedAudioLevel;
          sceneObjectsRef.current.fieldMaterial.uniforms.audioFrequency.value = dominantFrequency;
        }
        
        // Dynamic camera movement
        const speechMotion = smoothedAudioLevel;
        const radius = 8 + Math.sin(t * 0.0008) * 0.5 + speechMotion * 1.5;
        const x = radius * Math.cos(t * 0.0003);
        const z = radius * Math.sin(t * 0.0003);
        const y = Math.sin(t * 0.0002) * 0.8 + speechMotion * 1.2;

        camera.position.set(x, y, z);
        camera.lookAt(0, 0, 0);

        // Animate energy rings
        if (sceneObjectsRef.current.rings) {
          sceneObjectsRef.current.rings.forEach((ring: any, index: number) => {
            const intensity = smoothedAudioLevel * 0.8 + 0.2;
            ring.material.opacity = intensity * (0.3 - index * 0.08);
            ring.scale.setScalar(1 + intensity * 0.3);
            ring.rotation.z += dt * 0.0002 * (index + 1) * (1 + smoothedAudioLevel);
          });
        }
        
        // Animate lights with more dramatic response
        sceneObjectsRef.current.pointLight1.intensity = 2 + smoothedAudioLevel * 4;
        sceneObjectsRef.current.pointLight2.intensity = 1.5 + smoothedAudioLevel * 3;
        sceneObjectsRef.current.pointLight3.intensity = 1 + smoothedAudioLevel * 5;
        
        // Color shifting based on dominant frequency
        const hue = (dominantFrequency / 128) * 0.3 + 0.7;
        sceneObjectsRef.current.pointLight1.color.setHSL(hue, 0.8, 0.6);
        sceneObjectsRef.current.pointLight2.color.setHSL((hue + 0.3) % 1, 0.7, 0.5);
        sceneObjectsRef.current.pointLight3.color.setHSL((hue + 0.6) % 1, 0.9, 0.7);
      }

      composer.render();
    };
    animate();

        // Cleanup function
        cleanup = () => {
          window.removeEventListener('resize', handleResize);
          if (container && renderer.domElement && container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
          }
          renderer.dispose();
        };
      } catch (error) {
        console.error('Failed to initialize 3D scene:', error);
      }
    };
    
    initializeScene();
    
    // Cleanup
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Initialize audio contexts and WebSocket connection
  useEffect(() => {
    inputContextRef.current = new AudioContext({ sampleRate: 16000 });
    outputContextRef.current = new AudioContext({ sampleRate: 24000 });
    
    inputNodeRef.current = inputContextRef.current.createGain();
    outputNodeRef.current = outputContextRef.current.createGain();
    outputNodeRef.current.connect(outputContextRef.current.destination);
    
    inputAnalyserRef.current = new AudioAnalyser(inputNodeRef.current);
    outputAnalyserRef.current = new AudioAnalyser(outputNodeRef.current);
    
    nextStartTimeRef.current = outputContextRef.current.currentTime;
    
    // Initialize WebSocket connection
    connectWebSocket().catch(err => {
      console.error('Failed to connect WebSocket:', err);
      setError('Connection failed');
    });
    // connectWebSocket is defined locally and contains complex logic
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // For now, use the same model for both modes until we confirm the correct native audio model
      const modelName = 'gemini-2.0-flash-exp';
      
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
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Connection error:', err);
    }
  };

  // Start recording
  const startRecording = async () => {
    if (isRecording) return;

    try {
      setStatus('Requesting microphone access...');
      setError(''); // Clear any previous errors
      
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        await connectWebSocket();
      }

      // Resume audio context (required for user interaction)
      if (inputContextRef.current?.state === 'suspended') {
        await inputContextRef.current.resume();
      }
      if (outputContextRef.current?.state === 'suspended') {
        await outputContextRef.current.resume();
      }

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
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
    // saveConversation is included in cleanup, not as a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <div 
                className="px-3 py-1 bg-gray-500/20 border border-gray-500/30 rounded-full cursor-pointer hover:bg-gray-500/30 transition-colors"
                onClick={startRecording}
              >
                <span className="text-sm text-gray-400">{status}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 3D Visualization */}
      <div ref={mountRef} className="absolute inset-0 z-0" style={{ width: '100%', height: '100%', top: '150px' }} />
      
      {/* Transcript Display */}
      <div className="absolute top-20 left-4 right-4 max-h-[50vh] z-20">
        <div className="flex gap-4">
          <Card className="flex-1 bg-gray-900/30 backdrop-blur-md border-gray-700/50 p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-300 text-sm font-medium">Conversation with EVA</h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Model: {useNativeAudio ? 'Native Audio' : 'Half-Cascade'}</span>
                <span>•</span>
                <span>Transcription: {enableTranscription ? 'ON' : 'OFF'}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm max-h-[45vh] overflow-y-auto">
              {transcript.map((entry, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-2 rounded",
                    entry.speaker === 'user' 
                      ? "bg-blue-600/10 text-blue-300 ml-12 border border-blue-600/20" 
                      : "bg-purple-600/10 text-purple-300 mr-12 border border-purple-600/20"
                  )}
                >
                  <span className="font-medium">
                    {entry.speaker === 'user' ? 'You: ' : 'EVA: '}
                  </span>
                  {entry.text}
                </div>
              ))}
              {currentUserText && (
                <div className="p-2 rounded bg-blue-600/10 text-blue-300 ml-12 opacity-70 border border-blue-600/20">
                  <span className="font-medium">You: </span>
                  {currentUserText}
                </div>
              )}
              {currentAssistantText && (
                <div className="p-2 rounded bg-purple-600/10 text-purple-300 mr-12 opacity-70 border border-purple-600/20">
                  <span className="font-medium">EVA: </span>
                  {currentAssistantText}
                </div>
              )}
            </div>
          </Card>

          {/* VAD Configuration Panel */}
          <Card className="w-80 bg-gray-900/30 backdrop-blur-md border-gray-700/50 p-4 shadow-2xl">
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