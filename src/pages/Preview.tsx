import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, RotateCcw, Download } from 'lucide-react';
import { Frame, PhotoArea, CapturedPhoto } from '@/types/photobooth';
import { storageUtils } from '@/utils/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

type NavState = {
  capturedPhotos?: CapturedPhoto[];
};

const getBaseDims = (size: Frame['size']) => {
  // Samakan dengan CreateFrame
  return size === '2x4' ? { w: 600, h: 400 } : { w: 400, h: 600 };
};

const getAspectClass = (size: Frame['size']) => {
  // Kartu preview aspect agar sesuai dimensi dasar
  return size === '2x4' ? 'aspect-[1/2]' : 'aspect-[2/3]';
};

const Preview = () => {
  const { frameId } = useParams<{ frameId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const navState = location.state as NavState | null;

  const [frame, setFrame] = useState<Frame | null>(null);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);

  useEffect(() => {
    if (!frameId) {
      navigate('/');
      return;
    }

    const frames = storageUtils.getFrames();
    const selected = frames.find((f) => f.id === frameId);
    if (!selected) {
      toast.error('Frame tidak ditemukan');
      navigate('/');
      return;
    }

    // Normalisasi data lama: bila areasOnTop belum ada, asumsikan true (area di depan)
    const normalized: Frame = {
      ...selected,
      areasOnTop:
        typeof (selected as any).areasOnTop === 'boolean'
          ? (selected as any).areasOnTop
          : true,
    };

    setFrame(normalized);

    if (navState?.capturedPhotos?.length) {
      setPhotos(navState.capturedPhotos);
    } else {
      try {
        const raw = sessionStorage.getItem(`capturedPhotos-${normalized.id}`);
        if (raw) {
          const parsed = JSON.parse(raw) as CapturedPhoto[];
          setPhotos(parsed ?? []);
        }
      } catch {
        // ignore
      }
    }
  }, [frameId, navState, navigate]);

  const aspectClass = useMemo(() => (frame ? getAspectClass(frame.size) : 'aspect-[2/3]'), [frame]);
  const baseDims = useMemo(() => (frame ? getBaseDims(frame.size) : { w: 400, h: 600 }), [frame]);

  const photoForArea = (area: PhotoArea) =>
    photos.find((p) => p.areaId === area.id) || null;

  if (!frame) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-muted-foreground">Memuat preview...</p>
        </div>
      </div>
    );
  }

  const allFilled = frame.areas.length > 0 && frame.areas.every((a) => !!photoForArea(a));

  const handleDownloadComposite = () => {
    toast.info('Fitur download komposit bisa ditambahkan dengan canvas—siap kalau kamu mau 🙂');
  };

  // Layering: jika areasOnTop = true → foto/areas z-10, image frame z-0 (area di depan).
  // jika false → foto/areas z-0, image frame z-10 (area di belakang).
  const areasOnTop =
    typeof (frame as any).areasOnTop === 'boolean' ? (frame as any).areasOnTop : true;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-photobooth-gradient py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-white text-center mb-2">
            Preview – {frame.name}
          </h1>
          <p className="text-primary-foreground/80 text-center">
            {frame.size} inch · {frame.areas.length} area
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-black">Pratinjau Hasil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`relative ${aspectClass} bg-muted rounded-lg overflow-hidden mx-auto max-w-[640px]`}>
                {/* Container foto/areas dengan z-index dinamis */}
                <div className={`absolute inset-0 ${areasOnTop ? 'z-10' : 'z-0'}`}>
                  {frame.areas.map((area) => {
                    const shot = photoForArea(area);
                    const left = (area.x / baseDims.w) * 100;
                    const top = (area.y / baseDims.h) * 100;
                    const width = (area.width / baseDims.w) * 100;
                    const height = (area.height / baseDims.h) * 100;

                    return (
                      <div
                        key={area.id}
                        className="absolute overflow-hidden rounded-md"
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          width: `${width}%`,
                          height: `${height}%`,
                          transform: `rotate(${area.rotation}deg)`,
                          transformOrigin: 'center',
                          border: shot ? undefined : '2px dashed rgba(255,255,255,0.4)',
                          background: shot ? undefined : 'rgba(0,0,0,0.15)',
                        }}
                        title={`Area ${area.order}`}
                      >
                        {shot ? (
                          <img
                            src={shot.dataUrl}
                            alt={`Foto area ${area.order}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-white/80">
                            Foto area {area.order} belum ada
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Gambar frame dengan z-index kebalikan dari areas */}
                <img
                  src={frame.image}
                  alt={frame.name}
                  className={`absolute inset-0 w-full h-full object-cover ${areasOnTop ? 'z-0' : 'z-10'}`}
                />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => navigate(-1)} variant="outline" className="text-black">
                  <RotateCcw className="w-4 h-4 mr-2 text-black" />
                  Kembali
                </Button>

                <Button
                  className="bg-primary hover:bg-primary/90"
                  disabled={!allFilled}
                  onClick={handleDownloadComposite}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {allFilled ? 'Download Hasil' : 'Lengkapi Semua Foto'}
                </Button>

                {allFilled && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      toast.success('Siap dicetak! (opsional: kirim ke printer / share)');
                    }}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Tandai Selesai
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-black">Detail & Foto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Info Frame */}
                <div className="text-sm text-black">
                  <div>
                    Nama: <span className="text-muted-foreground font-medium">{frame.name}</span>
                  </div>
                  <div>
                    Ukuran: <span className="text-muted-foreground font-medium">{frame.size}</span>
                  </div>
                  <div>
                    Area: <span className="text-muted-foreground font-medium">{frame.areas.length}</span>
                  </div>
                  <div>
                    Layer:{" "}
                    <span className="text-muted-foreground font-medium">
                      {areasOnTop ? 'Area di depan gambar' : 'Area di belakang gambar'}
                    </span>
                  </div>
                </div>

                {frame.areas.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {frame.areas
                      .sort((a, b) => a.order - b.order)
                      .map((area) => {
                        const shot = photoForArea(area);
                        const aspect = Math.max(1, area.width) / Math.max(1, area.height);
                        return (
                          <div key={area.id} className="relative">
                            <div
                              className="w-full bg-muted rounded-md overflow-hidden"
                              style={{ aspectRatio: aspect }}
                            >
                              {shot ? (
                                <img
                                  src={shot.dataUrl}
                                  alt={`Foto area ${area.order}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                  Kosong
                                </div>
                              )}
                            </div>
                            <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                              Area {area.order}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">Tidak ada area pada frame ini.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center text-black">
          <Button onClick={() => navigate('/')} variant="outline">
            Kembali ke Booth
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Preview;
