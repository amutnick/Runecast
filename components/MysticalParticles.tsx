
import React from 'react';

const PARTICLE_COUNT = 30;

const MysticalParticles: React.FC = () => {
  const particles = Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
    const style = {
      '--x': `${Math.random() * 100}vw`,
      '--y': `${Math.random() * 100}vh`,
      '--d': `${Math.random() * 20 + 15}s`, // duration
      '--s': `${Math.random() * 2 + 1.5}px`, // size
      '--delay': `-${Math.random() * 20}s`
    } as React.CSSProperties;
    return <div key={i} className="particle" style={style}></div>;
  });

  return <div className="particle-container">{particles}</div>;
};

export default MysticalParticles;
