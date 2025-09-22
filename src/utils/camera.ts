export const cameraUtils = {
  getUserMedia: async (): Promise<MediaStream> => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });
    } catch (error) {
      console.error('Error accessing camera:', error);
      throw new Error('Unable to access camera. Please check permissions.');
    }
  },

  stopStream: (stream: MediaStream): void => {
    stream.getTracks().forEach(track => track.stop());
  },

  capturePhoto: (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ): string => {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to get canvas context');

    canvas.width = width;
    canvas.height = height;
    
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.8);
  },

  getAspectRatio: (type: 'square' | 'landscape' | 'portrait'): number => {
    switch (type) {
      case 'square':
        return 1; // 1:1
      case 'landscape':
        return 9 / 16; // 9:16 (width:height)
      case 'portrait':
        return 16 / 9; // 16:9 (width:height)
      default:
        return 1;
    }
  }
};