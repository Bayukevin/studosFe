import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Plus, Trash } from 'lucide-react';
import { Frame } from '@/types/photobooth';
import { storageUtils, initializeDefaultFrames } from '@/utils/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

const Booth = () => {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [hoveredFrame, setHoveredFrame] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Pastikan template default ada
    initializeDefaultFrames();

    // Ambil semua frame dari storage dan normalisasi
    const stored = storageUtils.getFrames() as Frame[];
    const normalized = stored.map((f) => ({
      ...f,
      areasOnTop:
        typeof (f as any).areasOnTop === 'boolean' ? (f as any).areasOnTop : true,
    })) as Frame[];
    setFrames(normalized);
  }, []);

  const handleFrameClick = (frameId: string) => {
    navigate(`/take-photo/${frameId}`);
  };

  const handleCreateFrame = () => {
    navigate('/create-frame');
  };

  const handleDeleteFrame = (
    frameId: string,
    imagePath: string,
    e?: React.MouseEvent
  ) => {
    e?.preventDefault();
    e?.stopPropagation();

    // Tampilkan konfirmasi sebelum menghapus
    const confirmDelete = window.confirm(
      'Apakah kamu yakin ingin menghapus frame ini?'
    );

    if (!confirmDelete) return;

    // Optimistic update: hapus langsung dari state
    setFrames((prevFrames) => prevFrames.filter((frame) => frame.id !== frameId));

    try {
      storageUtils.deleteFrame(frameId);
      storageUtils.deleteImage(imagePath);
      toast.success('Frame dan gambar berhasil dihapus');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus frame dari penyimpanan');
    }
  };

  // Class aspect ratio untuk preview kartu
  const getAspectClass = (size: Frame['size']) => {
    switch (size) {
      case '4x6':
        return 'aspect-[2/3]'; // 4x6 -> 2:3 (portrait)
      case '2x4':
        return 'aspect-[1/2]'; // 2x4 -> 1:2
      default:
        return 'aspect-[2/3]';
    }
  };

  // Basis dimensi untuk skala posisi/ukuran area (harus konsisten dengan CreateFrame.tsx)
  const getBaseDims = (size: Frame['size']) => {
    if (size === '2x4') return { w: 600, h: 400 };
    return { w: 400, h: 600 };
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-photobooth-gradient py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold text-white text-center mb-2">
            Photo Booth Studio
          </h1>
          <p className="text-primary-foreground/80 text-center">
            Pilih frame yang Anda suka dan mulai sesi foto
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold text-foreground">Template Frame</h2>
          <Button
            onClick={handleCreateFrame}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Frame
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {frames.map((frame) => {
            const { w: baseW, h: baseH } = getBaseDims(frame.size);
            const aspectClass = getAspectClass(frame.size);
            const areasOnTop =
              typeof (frame as any).areasOnTop === 'boolean'
                ? (frame as any).areasOnTop
                : true;

            return (
              <Card
                key={frame.id}
                className="group cursor-pointer transition-all duration-300 hover:shadow-frame border-border/50 hover:border-primary/50"
                onMouseEnter={() => setHoveredFrame(frame.id)}
                onMouseLeave={() => setHoveredFrame(null)}
                onClick={() => handleFrameClick(frame.id)}
              >
                <CardContent className="p-4">
                  <div
                    className={`relative ${aspectClass} bg-muted rounded-lg overflow-hidden mb-4`}
                  >
                    {/* Gambar frame */}
                    <img
                      src={frame.image}
                      alt={frame.name}
                      className={`absolute inset-0 w-full h-full object-cover ${
                        areasOnTop ? 'z-0' : 'z-10'
                      }`}
                    />

                    {/* Area foto */}
                    <div
                      className={`absolute inset-0 ${
                        areasOnTop ? 'z-10' : 'z-0'
                      }`}
                    >
                      {frame.areas.map((area) => (
                        <div
                          key={area.id}
                          className="absolute border-2 border-area-highlight bg-area-highlight/60 flex items-center justify-center text-white font-bold"
                          style={{
                            left: `${(area.x / baseW) * 100}%`,
                            top: `${(area.y / baseH) * 100}%`,
                            width: `${(area.width / baseW) * 100}%`,
                            height: `${(area.height / baseH) * 100}%`,
                            transform: `rotate(${area.rotation}deg)`,
                            transformOrigin: 'center',
                          }}
                        >
                          {area.order}
                        </div>
                      ))}
                    </div>

                    {/* Overlay kamera saat hover */}
                    {hoveredFrame === frame.id && (
                      <div className="absolute inset-0 z-20 bg-camera-overlay flex items-center justify-center transition-all duration-300">
                        <div className="bg-primary p-4 rounded-full">
                          <Camera className="w-8 h-8 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground line-clamp-1">
                      {frame.name}
                    </h3>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{frame.size} inch</span>
                      <span>{frame.areas.length} foto</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button
                      onClick={(e) =>
                        handleDeleteFrame(frame.id, frame.image, e)
                      }
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      <Trash className="w-4 h-4 mr-2" />
                      Hapus Frame
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {frames.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📷</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Belum ada frame tersedia
            </h3>
            <p className="text-muted-foreground mb-6">
              Buat frame pertama Anda untuk memulai sesi foto
            </p>
            <Button
              onClick={handleCreateFrame}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Buat Frame Baru
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Booth;
