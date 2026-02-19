import { useEffect, useRef, useState, useCallback } from 'react';
import { makeWsUrl } from '../api';

export default function useJobWebSocket(jobId) {
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  const connect = useCallback(() => {
    if (!jobId) return;

    const ws = new WebSocket(makeWsUrl(jobId));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'status' || msg.type === 'progress') {
        setProgress({
          step: msg.step,
          pct: msg.progress_pct,
          message: msg.message,
          status: msg.status,
        });
      } else if (msg.type === 'complete') {
        setResult(msg);
        ws.close();
      } else if (msg.type === 'failed') {
        setError({ message: msg.error, step: msg.step });
        ws.close();
      }
    };

    ws.onerror = () => {
      setError({ message: 'WebSocket connection error' });
    };

    // Send keepalive pings every 25s
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      }
    }, 25000);

    ws.onclose = () => {
      clearInterval(pingInterval);
    };

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [jobId]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  return { progress, result, error };
}
