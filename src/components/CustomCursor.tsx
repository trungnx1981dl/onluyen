import React, { useEffect, useState } from 'react';

const CustomCursor = () => {
  const [trail, setTrail] = useState<{ x: number; y: number; id: number }[]>([]);

  useEffect(() => {
    let idCounter = 0;
    const updatePosition = (e: MouseEvent) => {
      setTrail((prevTrail) => {
        const newTrail = [...prevTrail, { x: e.clientX, y: e.clientY, id: idCounter++ }];
        if (newTrail.length > 20) {
          newTrail.shift();
        }
        return newTrail;
      });
    };

    window.addEventListener('mousemove', updatePosition);

    const interval = setInterval(() => {
      setTrail((prevTrail) => {
        if (prevTrail.length > 0) {
          return prevTrail.slice(1);
        }
        return prevTrail;
      });
    }, 50);

    return () => {
      window.removeEventListener('mousemove', updatePosition);
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      {/* Trail */}
      {trail.map((point, index) => (
        <div
          key={point.id}
          className="pointer-events-none fixed z-50 rounded-full bg-yellow-400 blur-[2px] mix-blend-screen transition-opacity duration-300"
          style={{
            left: `${point.x - 4}px`,
            top: `${point.y - 4}px`,
            width: `${Math.max(1, 8 - (trail.length - index) * 0.3)}px`,
            height: `${Math.max(1, 8 - (trail.length - index) * 0.3)}px`,
            opacity: index / trail.length,
          }}
        />
      ))}
    </>
  );
};

export default CustomCursor;
