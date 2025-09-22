import { Frame, PhotoSession } from '@/types/photobooth';

const FRAMES_KEY = 'photobooth_frames';
const SESSIONS_KEY = 'photobooth_sessions';

export const storageUtils = {
  // Frame management
  getFrames: (): Frame[] => {
    const stored = localStorage.getItem(FRAMES_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  saveFrame: (frame: Frame): void => {
    const frames = storageUtils.getFrames();
    const existingIndex = frames.findIndex(f => f.id === frame.id);
    
    if (existingIndex >= 0) {
      frames[existingIndex] = frame;
    } else {
      frames.push(frame);
    }
    
    localStorage.setItem(FRAMES_KEY, JSON.stringify(frames));
  },

  deleteFrame: (frameId: string): void => {
    const frames = storageUtils.getFrames().filter(f => f.id !== frameId);
    localStorage.setItem(FRAMES_KEY, JSON.stringify(frames));
  },

  // Session management
  getSessions: (): PhotoSession[] => {
    const stored = localStorage.getItem(SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  saveSession: (session: PhotoSession): void => {
    const sessions = storageUtils.getSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  },

  deleteSession: (sessionId: string): void => {
    const sessions = storageUtils.getSessions().filter(s => s.id !== sessionId);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }
};

// Initialize with default frames if empty
export const initializeDefaultFrames = (): void => {
  const frames = storageUtils.getFrames();
  if (frames.length === 0) {
    const defaultFrames: Frame[] = [
      {
        id: '1',
        name: 'Single Portrait',
        image: '/api/placeholder/400/600',
        size: '4x6',
        areas: [
          {
            id: 'area-1',
            type: 'portrait',
            x: 50,
            y: 50,
            width: 200,
            height: 300,
            rotation: 0,
            order: 1
          }
        ],
        createdAt: new Date()
      },
      {
        id: '2',
        name: 'Double Square',
        image: '/api/placeholder/600/400',
        size: '2x4',
        areas: [
          {
            id: 'area-1',
            type: 'square',
            x: 50,
            y: 50,
            width: 150,
            height: 150,
            rotation: 0,
            order: 1
          },
          {
            id: 'area-2',
            type: 'square',
            x: 250,
            y: 50,
            width: 150,
            height: 150,
            rotation: 0,
            order: 2
          }
        ],
        createdAt: new Date()
      }
    ];

    defaultFrames.forEach(frame => storageUtils.saveFrame(frame));
  }
};