'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  frequencyData?: Uint8Array | null;
  waveformData?: Uint8Array | null;
  isActive: boolean;
  type?: 'frequency' | 'waveform' | 'both';
  height?: number;
  className?: string;
  color?: string;
  backgroundColor?: string;
}

export function AudioVisualizer({
  frequencyData,
  waveformData,
  isActive,
  type = 'frequency',
  height = 100,
  className,
  color = '#8b5cf6',
  backgroundColor = 'rgba(0, 0, 0, 0.1)',
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (!isActive) {
      // Draw inactive state
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, rect.height / 2);
      ctx.lineTo(rect.width, rect.height / 2);
      ctx.stroke();
      return;
    }

    // Draw based on type
    if (type === 'frequency' && frequencyData) {
      drawFrequency(ctx, frequencyData, rect.width, rect.height);
    } else if (type === 'waveform' && waveformData) {
      drawWaveform(ctx, waveformData, rect.width, rect.height);
    } else if (type === 'both') {
      if (frequencyData) {
        drawFrequency(ctx, frequencyData, rect.width, rect.height / 2);
      }
      if (waveformData) {
        drawWaveform(ctx, waveformData, rect.width, rect.height / 2, rect.height / 2);
      }
    }
  }, [frequencyData, waveformData, isActive, type, color, backgroundColor]);

  const drawFrequency = (
    ctx: CanvasRenderingContext2D,
    data: Uint8Array,
    width: number,
    height: number,
    offsetY = 0
  ) => {
    const barWidth = width / data.length * 2.5;
    let x = 0;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, offsetY + height, 0, offsetY);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, `${color}33`);
    ctx.fillStyle = gradient;

    for (let i = 0; i < data.length; i++) {
      const barHeight = (data[i] / 255) * height;
      
      ctx.fillRect(x, offsetY + height - barHeight, barWidth - 2, barHeight);
      x += barWidth;
      
      if (x > width) break;
    }
  };

  const drawWaveform = (
    ctx: CanvasRenderingContext2D,
    data: Uint8Array,
    width: number,
    height: number,
    offsetY = 0
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / data.length;
    let x = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128.0;
      const y = offsetY + (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();
  };

  useEffect(() => {
    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('w-full', className)}
      style={{ height }}
    />
  );
}