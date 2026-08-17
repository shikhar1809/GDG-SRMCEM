import { useLocation } from 'react-router-dom';

export default function CodeDisplay() {
  const { pathname } = useLocation();
  const code = pathname.replace(/^\//u, '');

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        margin: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          fontFamily: 'monospace',
          fontWeight: 900,
          fontSize: 'clamp(3rem, 15vw, 10rem)',
          color: '#fff',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          userSelect: 'none',
        }}
      >
        {code}
      </span>
    </div>
  );
}
