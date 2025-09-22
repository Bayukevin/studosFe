import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, RotateCcw, Eye, Printer } from 'lucide-react';
import { Frame, PhotoArea, CapturedPhoto } from '@/types/photobooth';
import { storageUtils } from '@/utils/storage';
import { cameraUtils } from '@/utils/camera';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const COUNTDOWN_SECONDS = 5;

const getBaseDims = (size: Frame['size']) => {
  return size === '2x4' ? { w: 600, h: 400 } : { w: 400, h: 600 };
};

const getAreaAspect = (area: PhotoArea) => {
  const w = Math.max(1, area.width);
  const h = Math.max(1, area.height);
  return w / h;
};

const getAreaProportions = (area: PhotoArea, size: Frame['size']) => {
  const { w: baseW, h: baseH } = getBaseDims(size);
  return {
    px: area.x / baseW,
    py: area.y / baseH,
    pw: area.width / baseW,
    ph: area.height / baseH,
  };
};

const TakePhoto = () => {
  const { frameId } = useParams<{ frameId: string }>();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [frame, setFrame] = useState<Frame | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [isCapturing, setIsCapturing] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false); // 👈 tambahan
  const [countdown, setCountdown] = useState(0);
  const [currentAreaIndex, setCurrentAreaIndex] = useState(0);
  const [currentArea, setCurrentArea] = useState<PhotoArea | null>(null);

  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);

  useEffect(() => {
    if (!frameId) {
      navigate('/');
      return;
    }

    const frames = storageUtils.getFrames();
    const selectedFrame = frames.find((f) => f.id === frameId);

    if (!selectedFrame) {
      toast.error('Frame tidak ditemukan');
      navigate('/');
      return;
    }

    setFrame(selectedFrame);
    setCurrentArea(selectedFrame.areas[0] || null);

    (async () => {
      try {
        const mediaStream = await cameraUtils.getUserMedia();
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (error) {
        toast.error('Tidak dapat mengakses kamera');
        console.error('Camera initialization error:', error);
      }
    })();

    return () => {
      if (stream) cameraUtils.stopStream(stream);
    };
  }, [frameId, navigate]);

  const cameraAspect = useMemo(() => {
    return currentArea ? getAreaAspect(currentArea) : undefined;
  }, [currentArea]);

  const getCameraStyle = () => {
    if (!cameraAspect) return {};
    return {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      maxWidth: '100%',
      maxHeight: '100%',
    } as React.CSSProperties;
  };

  const getCameraGuideStyle = () => {
    if (!currentArea) return {};
    const aspect = getAreaAspect(currentArea);
    const isPortrait = currentArea.type === 'portrait';

    return {
      aspectRatio: isPortrait ? '0.55' : aspect,
      position: 'absolute' as const,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: isPortrait ? 'auto' : '80%',
      height: isPortrait ? '100%' : 'auto',
      maxWidth: '70%',
      maxHeight: '100%',
      borderColor: 'var(--camera-area, #22c55e)',
    };
  };

  const ensureVideoReady = async () => {
    if (videoRef.current && (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0)) {
      await new Promise<void>((resolve) => {
        const onLoaded = () => {
          resolve();
          videoRef.current?.removeEventListener('loadedmetadata', onLoaded);
        };
        videoRef.current?.addEventListener('loadedmetadata', onLoaded);
      });
    }
  };

  const startPhotoSession = async () => {
    if (!frame || !frame.areas.length) {
      toast.error('Frame tidak memiliki area foto');
      return;
    }

    await ensureVideoReady();

    setIsCapturing(true);
    setCurrentAreaIndex(0);
    setCapturedPhotos([]);

    for (let i = 0; i < frame.areas.length; i++) {
      setCurrentAreaIndex(i);
      setCurrentArea(frame.areas[i]);

      for (let c = COUNTDOWN_SECONDS; c > 0; c--) {
        setCountdown(c);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setCountdown(0);

      const shot = captureCurrentPhoto(frame.areas[i]);
      if (shot) setCapturedPhotos((prev) => [...prev, shot]);

      if (i < frame.areas.length - 1) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    setIsCapturing(false);
    setCurrentArea(null);
    toast.success('Sesi foto selesai!');
  };

  const captureCurrentPhoto = (area: PhotoArea): CapturedPhoto | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    try {
      const video = videoRef.current;
      const aspect = getAreaAspect(area);

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      let guideWidth = videoWidth * 0.8;
      let guideHeight = guideWidth / aspect;

      if (guideHeight > videoHeight * 0.8) {
        guideHeight = videoHeight * 0.8;
        guideWidth = guideHeight * aspect;
      }

      const cropX = (videoWidth - guideWidth) / 2;
      const cropY = (videoHeight - guideHeight) / 2;

      const canvas = canvasRef.current;
      canvas.width = Math.max(1, Math.round(guideWidth));
      canvas.height = Math.max(1, Math.round(guideHeight));

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Tidak bisa mendapatkan context canvas');

      ctx.drawImage(
        video,
        cropX, cropY, guideWidth, guideHeight,
        0, 0, guideWidth, guideHeight
      );

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      const shot: CapturedPhoto = {
        id: `photo-${Date.now()}-${Math.random()}`,
        dataUrl,
        areaId: area.id,
        timestamp: new Date(),
        aspectRatio: aspect,
      };

      return shot;
    } catch (err) {
      console.error('Capture error:', err);
      toast.error('Gagal mengambil foto');
      return null;
    }
  };

  // 👇 Retake satu foto untuk area tertentu
  const retakePhoto = async (area: PhotoArea) => {
    if (!frame) return;
    if (!stream) {
      toast.error('Kamera belum aktif');
      return;
    }

    await ensureVideoReady();

    try {
      setIsRetaking(true);
      setCurrentArea(area); // tampilkan guide area yang diretake

      // countdown
      for (let c = COUNTDOWN_SECONDS; c > 0; c--) {
        setCountdown(c);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setCountdown(0);

      const shot = captureCurrentPhoto(area);
      if (!shot) throw new Error('Gagal mengambil ulang foto');

      // replace foto untuk area yang sama
      setCapturedPhotos((prev) =>
        prev.map((p) => (p.areaId === area.id ? { ...shot, id: p.id } : p))
      );

      toast.success(`Foto area ${area.order} berhasil diganti`);
    } catch (e) {
      console.error(e);
      toast.error('Retake gagal');
    } finally {
      setIsRetaking(false);
      setCurrentArea(null);
    }
  };

  const resetSession = () => {
    setCapturedPhotos([]);
    setCurrentAreaIndex(0);
    setCurrentArea(frame?.areas[0] || null);
    setIsCapturing(false);
    setIsRetaking(false);
    setCountdown(0);
  };

  const saveToSessionAndPreview = () => {
    if (!frame) return;
    sessionStorage.setItem(`capturedPhotos-${frame.id}`, JSON.stringify(capturedPhotos));
    navigate(`/preview/${frame.id}`, { state: { capturedPhotos } });
  };

  // ------ Render ------
  if (!frame) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-muted-foreground">Memuat frame...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-photobooth-gradient py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-white text-center mb-2">
            Sesi Foto - {frame.name}
          </h1>
          <p className="text-primary-foreground/80 text-center">
            {frame.areas.length} foto akan diambil
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Kolom Kamera */}
          <div className="space-y-6 lg:col-span-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-black">
                  <span>Kamera</span>
                  {currentArea && (
                    <span className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded-full">
                      Area {currentArea.order} – {currentArea.type}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-lg bg-black"
                    style={getCameraStyle()}
                  />

                  {countdown > 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                      <div className="text-countdown text-8xl font-bold animate-ping">
                        {countdown}
                      </div>
                    </div>
                  )}

                  {currentArea && (
                    <div
                      className="border-2 border-camera-area rounded-lg pointer-events-none"
                      style={getCameraGuideStyle()}
                    >
                      <div className="absolute -top-6 left-0 bg-camera-area text-white px-2 py-1 rounded text-sm">
                        Area {currentArea.order}
                      </div>
                    </div>
                  )}
                </div>

                <canvas ref={canvasRef} className="hidden" />

                <div className="mt-6 flex flex-wrap gap-4">
                  <Button
                    onClick={startPhotoSession}
                    disabled={isCapturing || isRetaking || !stream}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {isCapturing ? 'Sedang Mengambil Foto...' : 'Mulai Sesi Foto'}
                  </Button>

                  {capturedPhotos.length > 0 && (
                    <>
                      <Button onClick={resetSession} variant="outline" className="text-black" disabled={isCapturing || isRetaking}>
                        <RotateCcw className="w-4 h-4 mr-2 text-black" />
                        Reset
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Kolom Hasil Foto */}
          <div className="space-y-4 lg:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-black">Hasil Foto</CardTitle>
              </CardHeader>
              <CardContent>
                {capturedPhotos.length === 0 ? (
                  <div className="aspect-[4/4] bg-white rounded-lg flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <div className="text-4xl mb-2">📸</div>
                      <p>Foto akan muncul di sini</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {capturedPhotos.map((photo, index) => {
                        const correspondingArea = frame.areas.find((a) => a.id === photo.areaId);
                        const aspect =
                          photo.aspectRatio || (correspondingArea ? getAreaAspect(correspondingArea) : 1);

                        const handleClick = async () => {
                          if (!correspondingArea) return;
                          if (isCapturing || isRetaking) return;
                          await retakePhoto(correspondingArea);
                        };

                        return (
                          <div
                            key={photo.id}
                            className="relative group cursor-pointer"
                            onClick={handleClick}
                          >
                            <img
                              src={photo.dataUrl}
                              alt={`Foto ${index + 1}`}
                              className="w-full object-cover rounded-lg"
                              style={{ aspectRatio: aspect as any }}
                            />

                            {/* Badge nomor */}
                            <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                              Foto {index + 1}
                            </div>

                            {/* Overlay RETAKE saat hover */}
                            <div
                              className={[
                                "absolute inset-0 rounded-lg flex items-center justify-center",
                                "bg-black/40 opacity-0 group-hover:opacity-100",
                                "transition-opacity duration-200",
                              ].join(' ')}
                            >
                              <span className="text-white font-semibold tracking-wide">
                                {isRetaking ? 'Retaking...' : 'Retake'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {capturedPhotos.length === frame.areas.length && (
                      <Button
                        className="w-full text-black"
                        variant="outline"
                        disabled={isCapturing || isRetaking}
                        onClick={saveToSessionAndPreview}
                      >
                        <Printer className="w-4 h-4 mr-2 text-black" />
                        Cetak Foto
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-black">
                    <span>Progress</span>
                    <span>
                      {capturedPhotos.length} / {frame.areas.length}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-photobooth-gradient h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(capturedPhotos.length / frame.areas.length) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-8 text-center text-black">
          <Button
            onClick={() => {
              if (stream) cameraUtils.stopStream(stream);
              navigate('/booth');
            }}
            variant="outline"
            disabled={isCapturing || isRetaking}
          >
            Kembali ke Booth
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TakePhoto;
