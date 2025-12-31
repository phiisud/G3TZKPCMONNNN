import React, { useEffect, useRef } from 'react';
import { OPCODES_ARRAY } from '../constants/MULTIVECTOR_ONTOLOGY_OPCODES';

interface MatrixRainProps {
  color?: string;
  className?: string;
  speed?: number;
  brightness?: number;
}

const MatrixRain: React.FC<MatrixRainProps> = ({ 
  color = '#00ffff', 
  className = '', 
  speed = 0.15,
  brightness = 1.0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const fontSize = 18;
    const columns = canvas.width / fontSize;
    const drops: number[] = Array(Math.floor(columns)).fill(0);
    const symbolChars = OPCODES_ARRAY;

    const draw = () => {
      ctx.fillStyle = `rgba(0, 2, 0, ${speed})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < drops.length; i++) {
        const char = symbolChars[Math.floor(Math.random() * symbolChars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        
        const headBrightness = Math.min(1, brightness * 1.5);
        const tailBrightness = brightness * 0.6;
        
        ctx.shadowBlur = 12 * brightness;
        ctx.shadowColor = color;
        
        const isHead = drops[i] % 8 === 0;
        if (isHead) {
          ctx.fillStyle = `rgba(255, 255, 255, ${headBrightness})`;
        } else {
          const greenValue = Math.floor(200 + 55 * tailBrightness);
          ctx.fillStyle = `rgba(0, ${greenValue}, ${Math.floor(greenValue * 0.6)}, ${tailBrightness})`;
        }
        
        ctx.font = `bold ${fontSize}px "JetBrains Mono", "Fira Code", monospace`;
        ctx.fillText(char, x, y);
        
        drops[i]++;
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.98) {
          drops[i] = 0;
        }
      }
      
      ctx.shadowBlur = 0;
    };

    const interval = setInterval(draw, 35);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, [color, speed, brightness]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed top-0 left-0 w-screen h-screen pointer-events-none ${className}`}
      style={{ opacity: 0.9 }}
    />
  );
};

export default MatrixRain;
