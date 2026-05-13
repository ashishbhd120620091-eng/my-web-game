import React, { useState, useEffect, useMemo, memo } from 'react';
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import { OutfitManager, CATEGORIES, ITEMS } from './OutfitSystem';

// Minimal character for preview
const PreviewCharacter = memo(({ equipped, color = "#ff4d6d" }) => {
  const items = useMemo(() => {
    if (!equipped) return [];
    return Object.entries(equipped).map(([cat, id]) => {
      return ITEMS.find(i => i.id === id);
    }).filter(Boolean);
  }, [equipped]);

  return (
    <group scale={1.2} position={[0, -1, 0]}>
      {/* Body */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[0.5, 1, 0.35]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.32]} />
        <meshStandardMaterial color="#ffd166" />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.15, 0.2, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0.15, 0.2, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.42, 0.9, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color="#ff7aa2" />
      </mesh>
      <mesh position={[0.42, 0.9, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color="#ff7aa2" />
      </mesh>

      {/* Outfit Items */}
      {items.map(item => {
        switch (item.category) {
          case 'Hair':
            return (
              <mesh key={item.id} position={[0, 1.82, 0.05]}>
                <boxGeometry args={[0.35, 0.25, 0.35]} />
                <meshStandardMaterial color={item.color} />
              </mesh>
            );
          case 'Cap':
            return (
              <mesh key={item.id} position={[0, 1.9, 0]}>
                <boxGeometry args={[0.45, 0.15, 0.45]} />
                <meshStandardMaterial color={item.color} />
              </mesh>
            );
          case 'Mask':
            return (
              <mesh key={item.id} position={[0, 1.6, 0.2]}>
                <boxGeometry args={[0.25, 0.15, 0.1]} />
                <meshStandardMaterial color={item.color} />
              </mesh>
            );
          case 'Shirt':
            return (
              <mesh key={item.id} position={[0, 0.8, 0]}>
                <boxGeometry args={[0.52, 1.02, 0.37]} />
                <meshStandardMaterial color={item.color} transparent opacity={0.9} />
              </mesh>
            );
          case 'Pant':
            return (
              <group key={item.id}>
                <mesh position={[-0.15, 0.2, 0]}>
                  <boxGeometry args={[0.22, 0.62, 0.22]} />
                  <meshStandardMaterial color={item.color} />
                </mesh>
                <mesh position={[0.15, 0.2, 0]}>
                  <boxGeometry args={[0.22, 0.62, 0.22]} />
                  <meshStandardMaterial color={item.color} />
                </mesh>
              </group>
            );
          case 'Shoes':
            return (
              <group key={item.id}>
                <mesh position={[-0.15, -0.05, 0]}>
                  <boxGeometry args={[0.25, 0.15, 0.3]} />
                  <meshStandardMaterial color={item.color} />
                </mesh>
                <mesh position={[0.15, -0.05, 0]}>
                  <boxGeometry args={[0.25, 0.15, 0.3]} />
                  <meshStandardMaterial color={item.color} />
                </mesh>
              </group>
            );
          default:
            return null;
        }
      })}
    </group>
  );
});

export const CustomizePanel = ({ open, onClose, equipped, onEquip, onUIButtonClick, skinColor }) => {
  const [data, setData] = useState(OutfitManager.loadData());
  const [activeCat, setActiveCat] = useState(CATEGORIES[0]);

  useEffect(() => {
    if (open) setData(OutfitManager.loadData());
  }, [open]);

  if (!open) return null;

  const handleAction = (item) => {
    onUIButtonClick && onUIButtonClick();
    if (data.unlocked.includes(item.id)) {
      if (onEquip) {
        onEquip(item.category, item.id);
        console.log("Outfit equipped:", item.name);
      } else {
        const next = OutfitManager.equip(item.category, item.id);
        setData(next);
        window.dispatchEvent(new CustomEvent('outfit_changed', { detail: next.equipped }));
      }
      setData(OutfitManager.loadData());
    } else {
      if (OutfitManager.purchase(item.id)) {
        setData(OutfitManager.loadData());
      } else {
        const coinsEl = document.getElementById('customize-coins');
        if (coinsEl) {
          coinsEl.style.color = '#ef4444';
          setTimeout(() => coinsEl.style.color = '#fff', 500);
        }
      }
    }
  };

  const getStyleColor = (style) => {
    const styles = {
      sporty: '#3b82f6',
      streetwear: '#10b981',
      desi: '#ff9933',
      futuristic: '#a855f7',
      casual: '#64748b',
      ninja: '#111827',
      techwear: '#334155',
      festival: '#ec4899'
    };
    return styles[style] || '#fff';
  };

  const currentEquipped = equipped || data.equipped;

  return (
    <div className="customize-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(2, 6, 23, 0.98)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif', color: 'white',
      backdropFilter: 'blur(20px)',
      animation: 'fadeIn 0.3s ease'
    }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, letterSpacing: '-0.03em', color: '#fff' }}>CUSTOMIZE</h2>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Style your runner</div>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div id="customize-coins" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '12px', fontSize: '16px', fontWeight: 800 }}>
            <span style={{ color: '#fbbf24', marginRight: '6px' }}>🪙</span> {data.coins.toLocaleString()}
          </div>
          <button onClick={() => { onUIButtonClick && onUIButtonClick(); onClose(); }} style={{
            background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', 
            padding: '10px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, fontSize: '14px', transition: 'all 0.2s'
          }}>CLOSE</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Categories (Left) */}
        <div style={{ width: '100px', borderRight: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => { onUIButtonClick && onUIButtonClick(); setActiveCat(c); }} style={{
              width: '100%', padding: '24px 10px', border: 'none', background: activeCat === c ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: activeCat === c ? '#3b82f6' : '#64748b', cursor: 'pointer', fontSize: '10px', fontWeight: 800,
              textAlign: 'center', borderLeft: activeCat === c ? '4px solid #3b82f6' : '4px solid transparent',
              transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
            }}>
              <div style={{ fontSize: '18px' }}>
                {c === 'Hair' && '💇'}
                {c === 'Cap' && '🧢'}
                {c === 'Mask' && '😷'}
                {c === 'Shirt' && '👕'}
                {c === 'Pant' && '👖'}
                {c === 'Shoes' && '👟'}
              </div>
              {c.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Character Preview (Center) */}
        <div style={{ flex: '1.2', position: 'relative', background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.1) 0%, transparent 70%)', overflow: 'hidden' }}>
          <Canvas camera={{ position: [0, 0, 5], fov: 35 }}>
            <ambientLight intensity={0.7} />
            <pointLight position={[10, 10, 10]} intensity={1.5} />
            <Stage environment="city" intensity={0.5} contactShadow={false}>
              <PreviewCharacter equipped={currentEquipped} color={skinColor?.body} />
            </Stage>
            <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={4} />
          </Canvas>
          <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.4)', padding: '6px 16px', borderRadius: '20px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, pointerEvents: 'none' }}>
            SWIPE TO ROTATE PREVIEW
          </div>
        </div>

        {/* Items Grid (Right) */}
        <div style={{ flex: '1', padding: '20px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', alignContent: 'start', background: 'rgba(0,0,0,0.2)' }}>
          {ITEMS.filter(i => i.category === activeCat).map(item => {
            const isUnlocked = data.unlocked.includes(item.id);
            const isEquipped = currentEquipped[item.category] === item.id;
            
            return (
              <div key={item.id} onClick={() => handleAction(item)} style={{
                background: isEquipped ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)', 
                borderRadius: '16px', padding: '12px', 
                border: isEquipped ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.05)',
                cursor: 'pointer', position: 'relative', transition: 'all 0.2s ease',
                display: 'flex', flexDirection: 'column', gap: '10px',
                boxShadow: isEquipped ? '0 8px 24px rgba(59, 130, 246, 0.2)' : 'none'
              }}>
                
                {/* Visual Icon */}
                <div style={{ 
                  height: '70px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderBottom: `3px solid ${item.color}`, position: 'relative', overflow: 'hidden'
                }}>
                  <div style={{ 
                    width: '24px', height: '24px', borderRadius: '4px', background: item.color, 
                    boxShadow: `0 0 15px ${item.color}`,
                    transform: isEquipped ? 'rotate(45deg) scale(1.1)' : 'none',
                    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }} />
                  {isEquipped && <div style={{ position: 'absolute', top: '5px', right: '5px', fontSize: '10px' }}>✅</div>}
                </div>

                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#fff', marginBottom: '2px' }}>{item.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', color: getStyleColor(item.style), textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.05em' }}>{item.style}</span>
                    {!isUnlocked && <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 800 }}>🪙 {item.price}</span>}
                  </div>
                </div>

                <button style={{
                  width: '100%', padding: '8px', borderRadius: '10px', border: 'none',
                  background: isEquipped ? '#3b82f6' : isUnlocked ? 'rgba(255,255,255,0.1)' : '#059669',
                  color: 'white', fontSize: '11px', fontWeight: 900, cursor: 'pointer',
                  pointerEvents: 'none', textTransform: 'uppercase'
                }}>
                  {isEquipped ? 'EQUIPPED' : isUnlocked ? 'EQUIP' : 'UNLOCK'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(1.02); } to { opacity: 1; transform: scale(1); } }
        .customize-overlay ::-webkit-scrollbar { width: 5px; }
        .customize-overlay ::-webkit-scrollbar-track { background: transparent; }
        .customize-overlay ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); borderRadius: 10px; }
        .customize-overlay button:active { transform: scale(0.95); }
      `}</style>
    </div>
  );
};

