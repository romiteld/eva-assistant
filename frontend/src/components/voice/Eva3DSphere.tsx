'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Float } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { cn } from '@/lib/utils';

// Animated sphere with voice response
interface AnimatedSphereProps {
  audioData: number[];
  isListening: boolean;
  isSpeaking: boolean;
}

// Custom shader material for the sphere
const sphereVertexShader = `
  uniform float time;
  uniform float audioLevel;
  uniform float[16] audioFrequencies;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;
  
  // Noise function for organic movement
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }
  
  float cnoise(vec3 P) {
    vec3 Pi0 = floor(P);
    vec3 Pi1 = Pi0 + vec3(1.0);
    Pi0 = mod289(Pi0);
    Pi1 = mod289(Pi1);
    vec3 Pf0 = fract(P);
    vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;
    
    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);
    
    vec4 gx0 = ixy0 * (1.0 / 7.0);
    vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);
    
    vec4 gx1 = ixy1 * (1.0 / 7.0);
    vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);
    
    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
    
    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;
    
    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);
    
    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
  }
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    // Calculate displacement based on audio frequencies
    float displacement = 0.0;
    vec3 pos = position;
    
    // Base wave movement
    float baseWave = sin(position.x * 4.0 + time * 2.0) * 0.05;
    baseWave += sin(position.y * 3.0 + time * 1.5) * 0.05;
    baseWave += sin(position.z * 5.0 + time * 2.5) * 0.05;
    
    // Audio-reactive displacement
    float theta = atan(position.y, position.x);
    float phi = acos(position.z / length(position));
    
    // Map frequencies to sphere regions
    int freqIndex = int(mod(theta + 3.14159, 6.28318) / 6.28318 * 16.0);
    float freqInfluence = audioFrequencies[freqIndex] / 255.0;
    
    // Organic noise displacement
    vec3 noisePos = position * 0.5 + vec3(time * 0.1);
    float noise = cnoise(noisePos) * 0.3;
    
    // Combine displacements
    displacement = baseWave * (1.0 + audioLevel * 2.0);
    displacement += freqInfluence * 0.15 * (1.0 + sin(time * 3.0 + phi * 4.0));
    displacement += noise * audioLevel * 0.5;
    
    // Apply displacement along normal
    pos += normal * displacement;
    
    vDisplacement = displacement;
    vPosition = pos;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const sphereFragmentShader = `
  uniform float time;
  uniform float audioLevel;
  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 color3;
  uniform bool isListening;
  uniform bool isSpeaking;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;
  
  void main() {
    // Dynamic color based on state and audio
    vec3 baseColor = color1;
    if (isListening) {
      baseColor = mix(color1, color2, 0.5 + 0.5 * sin(time * 2.0));
    } else if (isSpeaking) {
      baseColor = mix(color2, color3, audioLevel);
    }
    
    // Fresnel effect for rim lighting
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - dot(viewDirection, vNormal), 2.0);
    
    // Color variation based on displacement
    vec3 displacementColor = mix(baseColor, color3, smoothstep(-0.1, 0.1, vDisplacement));
    
    // Holographic effect
    float holographic = sin(vPosition.y * 20.0 + time * 3.0) * 0.5 + 0.5;
    vec3 holoColor = mix(displacementColor, color2, holographic * fresnel * 0.3);
    
    // Final color with glow
    vec3 finalColor = holoColor + fresnel * color3 * (0.5 + audioLevel * 0.5);
    
    // Energy pulses
    float pulse = sin(time * 4.0 + length(vPosition) * 10.0) * 0.5 + 0.5;
    finalColor += pulse * audioLevel * color2 * 0.3;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function AnimatedSphere({ audioData, isListening, isSpeaking }: AnimatedSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Calculate audio level and frequencies
  const audioLevel = useMemo(() => {
    if (!audioData || audioData.length === 0) return 0;
    const sum = audioData.reduce((acc, val) => acc + val, 0);
    return Math.min(sum / (audioData.length * 255), 1);
  }, [audioData]);

  // Create shader material
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    audioLevel: { value: 0 },
    audioFrequencies: { value: new Float32Array(16) },
    color1: { value: new THREE.Color('#6366f1') }, // Indigo
    color2: { value: new THREE.Color('#8b5cf6') }, // Purple
    color3: { value: new THREE.Color('#ec4899') }, // Pink
    isListening: { value: false },
    isSpeaking: { value: false }
  }), []);

  // Animate
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.audioLevel.value = audioLevel;
      materialRef.current.uniforms.isListening.value = isListening;
      materialRef.current.uniforms.isSpeaking.value = isSpeaking;
      
      // Update audio frequencies
      if (audioData && audioData.length >= 16) {
        for (let i = 0; i < 16; i++) {
          materialRef.current.uniforms.audioFrequencies.value[i] = audioData[i] || 0;
        }
      }
    }
    
    if (meshRef.current) {
      // Gentle rotation
      meshRef.current.rotation.y += 0.002;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      
      // Scale based on audio
      const targetScale = 1 + audioLevel * 0.2;
      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.1
      );
    }
  });

  return (
    <Float
      speed={2}
      rotationIntensity={0.2}
      floatIntensity={0.5}
    >
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[2, 16]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={sphereVertexShader}
          fragmentShader={sphereFragmentShader}
          uniforms={uniforms}
          wireframe={false}
          transparent={false}
        />
      </mesh>
    </Float>
  );
}

// Particle field for ambiance
function ParticleField() {
  const points = useRef<THREE.Points>(null);
  const particleCount = 1000;
  
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (points.current) {
      points.current.rotation.y = state.clock.elapsedTime * 0.05;
      points.current.rotation.x = state.clock.elapsedTime * 0.03;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#8b5cf6"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// Main 3D scene component
interface Eva3DSphereProps {
  audioData: number[];
  isListening: boolean;
  isSpeaking: boolean;
  className?: string;
}

export function Eva3DSphere({ audioData, isListening, isSpeaking, className }: Eva3DSphereProps) {
  return (
    <div className={cn("w-full h-full", className)}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        gl={{ 
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#8b5cf6" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ec4899" />
        
        {/* Environment removed to prevent CSP violations from external HDR loading */}
        
        {/* Main animated sphere */}
        <AnimatedSphere 
          audioData={audioData} 
          isListening={isListening}
          isSpeaking={isSpeaking}
        />
        
        {/* Particle field */}
        <ParticleField />
        
        {/* Camera controls */}
        <OrbitControls 
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 3}
          makeDefault
        />
        
        {/* Post-processing effects */}
        <EffectComposer>
          <Bloom 
            intensity={1.5}
            luminanceThreshold={0.5}
            luminanceSmoothing={0.9}
            blendFunction={BlendFunction.ADD}
          />
          <ChromaticAberration
            blendFunction={BlendFunction.NORMAL}
            offset={[0.0005, 0.0012]}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}