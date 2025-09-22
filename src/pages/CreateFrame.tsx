import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, RotateCw, Move, Square } from 'lucide-react';
import InteractiveArea from '@/components/InteractiveArea';
import { Frame, PhotoArea, CropSettings } from '@/types/photobooth';
import { storageUtils } from '@/utils/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const CreateFrame = () => {
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [areasOnTop, setAreasOnTop] = useState(true);
  const [frameName, setFrameName] = useState('');
  const [frameSize, setFrameSize] = useState<'4x6' | '2x4'>('4x6');
  const [frameImage, setFrameImage] = useState<string>('');
  const [areas, setAreas] = useState<PhotoArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropSettings] = useState<CropSettings>({ x: 0, y: 0, width: 100, height: 100 });

  // =============== Tambahan untuk CROP (draggable with fixed aspect) ===============
  const cropWrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  type CropBox = { x: number; y: number; w: number; h: number }; // 0..1 (persentase container)
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Simpan dimensi asli gambar saat onLoad
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);

  // Rasio untuk frameSize: 4x6 => 2:3 (≈0.6667), 2x4 => 1:2 (0.5)
  const cropAspect = frameSize === '4x6' ? 2 / 3 : 1 / 2;

  // Set posisi & ukuran awal cropBox saat modal dibuka / rasio berubah / gambar siap
  useEffect(() => {
    if (!cropModalOpen) return;
    const wrap = cropWrapRef.current;
    if (!wrap) return;

    const wrapW = wrap.clientWidth;
    const wrapH = wrap.clientHeight;
    if (!wrapW || !wrapH) return; // pastikan ukuran sudah ada

    const wrapAspect = wrapW / wrapH;

    let wPct: number, hPct: number;
    if (wrapAspect > cropAspect) {
      // container lebih lebar -> kunci tinggi 80%
      hPct = 0.8;
      wPct = (hPct * cropAspect) * (wrapH / wrapW);
    } else {
      // container lebih tinggi -> kunci lebar 80%
      wPct = 0.8;
      hPct = (wPct / cropAspect) * (wrapW / wrapH);
    }

    // clamp
    wPct = Math.min(1, Math.max(0.1, wPct));
    hPct = Math.min(1, Math.max(0.1, hPct));

    const x = (1 - wPct) / 2;
    const y = (1 - hPct) / 2;
    setCropBox({ x, y, w: wPct, h: hPct });
  }, [cropModalOpen, cropAspect, imgDims]);
  // ===============================================================================

  const dataUrlToBlob = (dataUrl: string) => {
    try {
      const arr = dataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      return new Blob([u8arr], { type: mime });
    } catch {
      return new Blob();
    }
  };

  const uploadToServer = async (blobOrFile: Blob | File) => {
    const form = new FormData();
    const filename = (blobOrFile as File).name || `frame_${Date.now()}.png`;
    form.append('file', blobOrFile, filename);

    const res = await fetch('/api/upload-frame', {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      throw new Error('Upload gagal');
    }

    const json = await res.json();
    return json.url as string;
  };

  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.match(/^image\/(png|jpg|jpeg)$/)) {
      toast.error('Format file harus PNG, JPG, atau JPEG');
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPendingImage(result);
      setImgDims(null); // reset dims agar wrapper pakai fallback sampai onLoad
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleImageUpload(files[0]);
      }
    },
    [handleImageUpload]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  // ===================== Handler drag crop box =====================
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const onCropMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingCrop(true);

    const wrap = cropWrapRef.current;
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width;
    const mouseY = (e.clientY - rect.top) / rect.height;

    dragOffsetRef.current = {
      dx: mouseX - cropBox.x,
      dy: mouseY - cropBox.y,
    };
  };

  const onCropMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCrop) return;

    const wrap = cropWrapRef.current;
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width;
    const mouseY = (e.clientY - rect.top) / rect.height;

    let nx = mouseX - dragOffsetRef.current.dx;
    let ny = mouseY - dragOffsetRef.current.dy;

    nx = clamp(nx, 0, 1 - cropBox.w);
    ny = clamp(ny, 0, 1 - cropBox.h);

    setCropBox((prev) => ({ ...prev, x: nx, y: ny }));
  };

  const onCropMouseUp = () => setIsDraggingCrop(false);
  const onCropMouseLeave = () => setIsDraggingCrop(false); // safety

  // Touch
  const onCropTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const wrap = cropWrapRef.current;
    if (!wrap) return;

    setIsDraggingCrop(true);

    const rect = wrap.getBoundingClientRect();
    const tx = (touch.clientX - rect.left) / rect.width;
    const ty = (touch.clientY - rect.top) / rect.height;

    dragOffsetRef.current = { dx: tx - cropBox.x, dy: ty - cropBox.y };
  };

  const onCropTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingCrop) return;
    const touch = e.touches[0];
    const wrap = cropWrapRef.current;
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const tx = (touch.clientX - rect.left) / rect.width;
    const ty = (touch.clientY - rect.top) / rect.height;

    let nx = tx - dragOffsetRef.current.dx;
    let ny = ty - dragOffsetRef.current.dy;

    nx = clamp(nx, 0, 1 - cropBox.w);
    ny = clamp(ny, 0, 1 - cropBox.h);

    setCropBox((prev) => ({ ...prev, x: nx, y: ny }));
  };

  const onCropTouchEnd = () => setIsDraggingCrop(false);
  // =================================================================

  // ===================== Crop & upload =====================
  const handleCropComplete = async () => {
    try {
      if (!pendingImage) return;

      // Buat Image untuk membaca dimensi asli
      const img = new Image();
      img.src = pendingImage;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });

      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      // Hitung area crop berdasarkan persentase container
      const sx = Math.round(cropBox.x * naturalW);
      const sy = Math.round(cropBox.y * naturalH);
      const sw = Math.round(cropBox.w * naturalW);
      const sh = Math.round(cropBox.h * naturalH);

      // Render ke canvas
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context tidak tersedia');

      // Pastikan latar transparan tetap bening
      ctx.clearRect(0, 0, sw, sh);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      // Ekspor PNG (preserve alpha)
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
      );

      // Upload hasil crop
      const publicUrl = await uploadToServer(blob);
      setFrameImage(publicUrl);
      setCropModalOpen(false);
      toast.success('Gambar berhasil di-crop & diupload');
    } catch (e) {
      console.error(e);
      toast.error('Crop/Upload gagal');
    }
  };
  // =========================================================

  const addArea = (type: 'square' | 'landscape' | 'portrait') => {
    const newArea: PhotoArea = {
      id: `area-${Date.now()}`,
      type,
      x: 50,
      y: 50,
      width: type === 'square' ? 100 : type === 'landscape' ? 120 : 80,
      height: type === 'square' ? 100 : type === 'landscape' ? 80 : 120,
      rotation: 0,
      order: areas.length + 1,
    };
    setAreas((prev) => [...prev, newArea]);
  };

  const updateArea = (areaId: string, updates: Partial<PhotoArea>) => {
    setAreas((prev) => prev.map((area) => (area.id === areaId ? { ...area, ...updates } : area)));
  };

  const removeArea = (areaId: string) => {
    setAreas((prev) => prev.filter((area) => area.id !== areaId));
    setSelectedArea(null);
  };

  const saveFrame = () => {
    if (!frameName.trim()) {
      toast.error('Nama frame harus diisi');
      return;
    }

    if (!frameImage) {
      toast.error('Gambar frame harus diupload');
      return;
    }

    const newFrame: Frame = {
      id: `frame-${Date.now()}`,
      name: frameName.trim(),
      image: frameImage,
      size: frameSize,
      areas,
      createdAt: new Date(),
      areasOnTop,
    };

    storageUtils.saveFrame(newFrame);
    toast.success('Frame berhasil disimpan');
    navigate('/booth'); // sesuaikan jika perlu
  };

  const previewDimensions =
    frameSize === '4x6'
      ? { width: 400, height: 600 }
      : { width: 600, height: 400 };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-photobooth-gradient py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-white text-center">Buat Frame Baru</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 text-black">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card className="text-black">
              <CardHeader>
                <CardTitle className="text-black">Informasi Frame</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="frameName">Nama Frame</Label>
                  <Input
                    id="frameName"
                    value={frameName}
                    onChange={(e) => setFrameName(e.target.value)}
                    placeholder="Masukkan nama frame"
                  />
                </div>
                <div>
                  <Label htmlFor="frameSize">Ukuran Frame</Label>
                  <Select value={frameSize} onValueChange={(value: '4x6' | '2x4') => setFrameSize(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-black">
                      <SelectItem value="4x6">4x6 inch</SelectItem>
                      <SelectItem value="2x4">2x4 inch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="text-black">
              <CardHeader>
                <CardTitle>Upload Gambar Frame</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => setIsDragging(true)}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-foreground font-medium mb-2">Drag & drop gambar atau klik untuk browse</p>
                  <p className="text-sm text-muted-foreground">Format: PNG, JPG, JPEG</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {!frameImage && pendingImage && (
                  <div className="mt-4">
                    <img src={pendingImage} alt="Frame preview (local)" className="w-full max-w-sm mx-auto rounded-lg" />
                  </div>
                )}

                {frameImage && (
                  <div className="mt-4">
                    <img src={frameImage} alt="Frame preview (server)" className="w-full max-w-sm mx-auto rounded-lg" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="text-black">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Preview Frame</CardTitle>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="areasOnTop" className="whitespace-nowrap">
                      {areasOnTop ? 'Area di depan' : 'Area di belakang'}
                    </Label>
                    <Switch id="areasOnTop" checked={areasOnTop} onCheckedChange={setAreasOnTop} />
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="bg-primary text-white" variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Tambah Area
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => addArea('square')}>
                        <Square className="w-4 h-4 mr-2" />
                        Square
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addArea('landscape')}>
                        <Move className="w-4 h-4 mr-2" />
                        Landscape
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addArea('portrait')}>
                        <RotateCw className="w-4 h-4 mr-2" />
                        Portrait
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent>
                <div
                  className="relative bg-white rounded-lg mx-auto border overflow-hidden"
                  style={{
                    width: previewDimensions.width,
                    height: previewDimensions.height,
                  }}
                >
                  {!frameImage && (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground z-0">
                      Upload gambar frame terlebih dahulu
                    </div>
                  )}

                  {frameImage && (
                    <img
                      src={frameImage}
                      alt="Frame"
                      className={`absolute inset-0 w-full h-full object-cover ${
                        areasOnTop ? 'z-0' : 'z-10'
                      } pointer-events-none`}
                    />
                  )}

                  <div className={`absolute inset-0 ${areasOnTop ? 'z-10' : 'z-0'}`}>
                    {areas.map((area) => (
                      <InteractiveArea
                        key={area.id}
                        area={area}
                        isSelected={selectedArea === area.id}
                        onSelect={() => setSelectedArea(area.id)}
                        onUpdate={(updates) => updateArea(area.id, updates)}
                        onRemove={() => removeArea(area.id)}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button onClick={() => navigate('/booth')} variant="outline" className="flex-1">
                Batal
              </Button>
              <Button onClick={saveFrame} className="flex-1 bg-primary hover:bg-primary/90">
                Simpan Frame
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Crop */}
      <Dialog open={cropModalOpen} onOpenChange={setCropModalOpen}>
        <DialogContent
          className="max-w-md text-black"
          onMouseMove={onCropMouseMove}
          onMouseUp={onCropMouseUp}
          onMouseLeave={onCropMouseLeave}
        >
          <DialogHeader>
            <DialogTitle>Crop Gambar</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Ukuran Crop</Label>
              <Select value={frameSize} onValueChange={(value: '4x6' | '2x4') => setFrameSize(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white text-black">
                  <SelectItem value="4x6">4x6 inch (2:3)</SelectItem>
                  <SelectItem value="2x4">2x4 inch (1:2)</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Geser kotak crop untuk menentukan posisi. Rasio mengikuti pilihan ukuran.
              </p>
            </div>

            {pendingImage && (
              <div
                ref={cropWrapRef}
                className="relative bg-muted rounded-lg overflow-hidden"
                // Biarkan wrapper mengikuti rasio gambar; fallback 2:3 agar default tidak 1:1
                style={{
                  width: '100%',
                  aspectRatio: imgDims ? `${imgDims.w} / ${imgDims.h}` : '2 / 3',
                }}
                onTouchMove={onCropTouchMove}
                onTouchEnd={onCropTouchEnd}
              >
                <img
                  ref={imgRef}
                  src={pendingImage}
                  alt="Crop preview"
                  className="absolute inset-0 w-full h-full object-contain"
                  draggable={false}
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    setImgDims({ w: el.naturalWidth, h: el.naturalHeight });
                  }}
                />

                {/* Area crop (draggable) */}
                <div
                  className="absolute border-2 border-primary bg-transparent cursor-move"
                  style={{
                    left: `${cropBox.x * 100}%`,
                    top: `${cropBox.y * 100}%`,
                    width: `${cropBox.w * 100}%`,
                    height: `${cropBox.h * 100}%`,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)', // gelapkan luar area crop
                  }}
                  onMouseDown={onCropMouseDown}
                  onTouchStart={onCropTouchStart}
                >
                  {/* Label rasio */}
                  <div className="absolute -top-6 left-0 bg-primary text-primary-foreground px-2 py-0.5 text-xs rounded">
                    Rasio {frameSize === '4x6' ? '2:3' : '1:2'}
                  </div>

                  {/* Rule-of-thirds grid */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-y-0 left-1/3 border-l border-primary/50" />
                    <div className="absolute inset-y-0 left-2/3 border-l border-primary/50" />
                    <div className="absolute inset-x-0 top-1/3 border-t border-primary/50" />
                    <div className="absolute inset-x-0 top-2/3 border-t border-primary/50" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => setCropModalOpen(false)} variant="outline" className="flex-1">
                Batal
              </Button>
              <Button onClick={handleCropComplete} className="flex-1">
                Selesai
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateFrame;
