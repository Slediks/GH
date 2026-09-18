import { useEffect, useRef } from 'react';
import type { Snapshot, Team } from '../../shared/types';
import { acceptsSnapshot, interpolate } from './interpolation';
import { ballEffects, playerIndicators } from './effects';

export function Pitch({ snapshot, teams }: { snapshot: Snapshot | null; teams: Team[] }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    buffer = useRef<{ previous: Snapshot | null; current: Snapshot | null; received: number }>({
      previous: null,
      current: null,
      received: 0,
    });
  useEffect(() => {
    if (snapshot && acceptsSnapshot(buffer.current.current, snapshot)) {
      buffer.current = {
        previous: buffer.current.current ?? snapshot,
        current: snapshot,
        received: performance.now(),
      };
    }
  }, [snapshot]);
  useEffect(() => {
    let animation = 0;
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext('2d');
    if (!context) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const debug = new URLSearchParams(window.location.search).has('football-debug');
    function draw() {
      const ctx = context!,
        width = 1000,
        height = 640;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#123e32';
      ctx.fillRect(0, 0, width, height);
      for (let index = 0; index < 10; index++) {
        ctx.fillStyle = index % 2 ? '#174a3a' : '#154535';
        ctx.fillRect(40 + index * 92, 44, 92, 552);
      }
      ctx.strokeStyle = '#b4d5b670';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 44, 920, 552);
      ctx.beginPath();
      ctx.moveTo(500, 44);
      ctx.lineTo(500, 596);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(500, 320, 80, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#b4d5b6';
      ctx.beginPath();
      ctx.arc(500, 320, 4, 0, 7);
      ctx.fill();
      ctx.strokeRect(40, 164, 140, 312);
      ctx.strokeRect(820, 164, 140, 312);
      ctx.strokeRect(40, 230, 55, 180);
      ctx.strokeRect(905, 230, 55, 180);
      ctx.fillStyle = '#0b211f';
      ctx.fillRect(18, 265, 22, 110);
      ctx.fillRect(960, 265, 22, 110);
      ctx.strokeRect(18, 265, 22, 110);
      ctx.strokeRect(960, 265, 22, 110);
      const { previous, current, received } = buffer.current;
      const state =
        previous && current
          ? reducedMotion.matches
            ? current
            : interpolate(previous, current, (performance.now() - received) / 100)
          : null;
      const players =
        state?.players ??
        [0, 1].flatMap((side) =>
          [
            [5, 30],
            [27, 20],
            [27, 40],
            [45, 17],
            [45, 43],
          ].map(([x, y], index) => ({
            side,
            number: index + 1,
            x: side ? 100 - x : x,
            y,
            state: 'shape',
          })),
        );
      for (const [index, player] of players.entries()) {
        const waiting = state?.phase === 'penalties' && player.y < 12;
        const x = 40 + player.x * 9.2,
          y = 44 + player.y * 9.2;
        ctx.shadowColor = '#0008';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;
        ctx.beginPath();
        ctx.arc(x, y, waiting ? 11 : 15, 0, 7);
        ctx.fillStyle = player.number === 1 ? '#203540' : (teams[player.side]?.color ?? '#58bde9');
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = player.number === 1 ? '#e8cd74' : '#fff9';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = player.number === 1 ? '#fff' : '#10232e';
        ctx.font = waiting ? 'bold 11px Segoe UI' : 'bold 14px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(player.number), x, y);
        if (!waiting) playerIndicators(ctx, player, state?.owner === index, debug);
      }
      if (state) ballEffects(ctx, state, reducedMotion.matches);
      const ball = state?.ball ?? { x: 50, y: 30 };
      ctx.beginPath();
      ctx.arc(40 + ball.x * 9.2, 44 + ball.y * 9.2, 7, 0, 7);
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#152d2c';
      ctx.stroke();
      animation = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animation);
  }, [teams]);
  return (
    <canvas
      className="pitch"
      width={1000}
      height={640}
      ref={canvas}
      aria-label="Общая серверная трансляция футбольного матча, вид сверху"
    />
  );
}
