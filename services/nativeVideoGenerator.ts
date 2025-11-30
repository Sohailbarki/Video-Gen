
import { ScriptBeat } from "../types";

interface RenderAsset {
  image: HTMLImageElement;
  duration: number;
  beat: ScriptBeat;
}

export const nativeVideoGenerator = {
  renderVideo: async (
    images: Blob[], 
    audioBlob: Blob, 
    beats: ScriptBeat[]
  ): Promise<Blob> => {
    console.log("Starting Native Video Render...");

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const totalDuration = audioBuffer.duration;

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize: disable alpha
    if (!ctx) throw new Error("Could not get 2D context");

    // Load images with URL cleanup
    const objectUrls: string[] = [];
    const loadedImages: RenderAsset[] = await Promise.all(images.map(async (blob, index) => {
      const url = URL.createObjectURL(blob);
      objectUrls.push(url);
      const img = new Image();
      img.src = url;
      await new Promise(r => img.onload = r);
      
      const beatIndex = index % beats.length;
      return {
        image: img,
        duration: 0,
        beat: beats[beatIndex] || beats[0]
      };
    }));

    if (loadedImages.length === 0) throw new Error("No images loaded for native render");

    const durationPerClip = totalDuration / loadedImages.length;
    loadedImages.forEach(a => a.duration = durationPerClip);

    const stream = canvas.captureStream(30); 
    const dest = audioCtx.createMediaStreamDestination();
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(dest);
    
    const audioTrack = dest.stream.getAudioTracks()[0];
    stream.addTrack(audioTrack);

    // Determine supported mime type
    const possibleTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    
    let mimeType = possibleTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const finishedPromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        // Cleanup Object URLs to free memory
        objectUrls.forEach(url => URL.revokeObjectURL(url));
        resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
      };
    });

    recorder.start();
    source.start(0);
    const startTime = performance.now();
    const transitionDuration = 0.5;
    
    return new Promise((resolve) => {
      const renderFrame = () => {
        const now = performance.now();
        const currentTime = (now - startTime) / 1000;

        if (currentTime >= totalDuration) {
          if (recorder.state !== 'inactive') recorder.stop();
          // source.stop(); // Sometimes source stops automatically or throws if stopped twice
          try { source.stop(); } catch {}
          finishedPromise.then(resolve);
          return;
        }

        let currentIndex = Math.floor(currentTime / durationPerClip);
        if (currentIndex >= loadedImages.length) currentIndex = loadedImages.length - 1;
        const currentAsset = loadedImages[currentIndex];
        
        const clipTime = currentTime - (currentIndex * durationPerClip);
        const progress = clipTime / currentAsset.duration;

        // Background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Current with Ken Burns
        const scale = 1.0 + (progress * 0.1); 
        const sw = canvas.width, sh = canvas.height;
        const scaleFactor = Math.max(sw / currentAsset.image.width, sh / currentAsset.image.height) * scale;
        const dw = currentAsset.image.width * scaleFactor;
        const dh = currentAsset.image.height * scaleFactor;
        const dx = (sw - dw) / 2;
        const dy = (sh - dh) / 2;

        ctx.drawImage(currentAsset.image, dx, dy, dw, dh);

        // Cross Dissolve
        const timeRemaining = currentAsset.duration - clipTime;
        if (timeRemaining < transitionDuration && currentIndex < loadedImages.length - 1) {
           const next = loadedImages[currentIndex + 1];
           ctx.globalAlpha = 1 - (timeRemaining / transitionDuration);
           
           const nextScaleFactor = Math.max(sw / next.image.width, sh / next.image.height);
           const ndw = next.image.width * nextScaleFactor;
           const ndh = next.image.height * nextScaleFactor;
           const ndx = (sw - ndw) / 2;
           const ndy = (sh - ndh) / 2;
           
           ctx.drawImage(next.image, ndx, ndy, ndw, ndh);
           ctx.globalAlpha = 1.0;
        }

        // Text Overlay
        if (currentAsset.beat) {
           const text = currentAsset.beat.visual.length > 50 ? currentAsset.beat.visual.substring(0, 47) + '...' : currentAsset.beat.visual;
           ctx.font = 'bold 48px Inter, sans-serif';
           ctx.textAlign = 'center';
           ctx.textBaseline = 'bottom';
           
           const tx = sw / 2;
           const ty = sh - 200;

           ctx.strokeStyle = 'rgba(0,0,0,0.8)';
           ctx.lineWidth = 6;
           ctx.lineJoin = 'round';
           ctx.strokeText(text, tx, ty);
           
           ctx.fillStyle = 'white';
           ctx.fillText(text, tx, ty);
        }
        
        requestAnimationFrame(renderFrame);
      };
      renderFrame();
    });
  }
};
