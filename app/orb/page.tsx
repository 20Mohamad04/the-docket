"use client";

import { useState, useRef } from "react";
import AIOrb from "./AIOrb";

export default function OrbPage() {
  const [amplitude, setAmplitude] = useState(0);
  const [status, setStatus] = useState("ORB READY");
  const [subtitle, setSubtitle] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  function startAmplitudeTracking(audio: HTMLAudioElement) {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);

    function loop() {
      const id = requestAnimationFrame(loop);
      rafRef.current = id;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const amp = sum / data.length / 255;
      setAmplitude(amp);
    }
    loop();
  }

  async function handleSubmit(message: string) {
    setStatus("THINKING...");

    try {
      const aiRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const { text } = await aiRes.json();
      setSubtitle(text);
      setStatus("SPEAKING...");

      const voiceRes = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const blob = await voiceRes.blob();
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;
      startAmplitudeTracking(audio);
      await audio.play();

      audio.onended = () => {
        cancelAnimationFrame(rafRef.current);
        setAmplitude(0);
        setStatus("ORB READY");
      };
    } catch (err) {
      console.error(err);
      setStatus("ERROR — CHECK CONSOLE");
      setAmplitude(0);
    }
  }

  return (
    <div
      style={{
        background: "#000",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AIOrb
        amplitude={amplitude}
        onSubmit={handleSubmit}
        subtitle={subtitle}
        status={status}
        height={500}
      />
    </div>
  );
}