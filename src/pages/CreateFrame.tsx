import { useState, useRef, useCallback } from 'react';
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

  const handleCropComplete = async () => {
    try {
      const payload: Blob | File = selectedFile ?? dataUrlToBlob(pendingImage);
      const publicUrl = await uploadToServer(payload);
      setFrameImage(publicUrl);
      setCropModalOpen(false);
      toast.success('Gambar berhasil diupload');
    } catch (e) {
      console.error(e);
      toast.error('Upload gagal');
    }
  };

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
    navigate('/');
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
              <Button onClick={() => navigate('/')} variant="outline" className="flex-1">
                Batal
              </Button>
              <Button onClick={saveFrame} className="flex-1 bg-primary hover:bg-primary/90">
                Simpan Frame
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={cropModalOpen} onOpenChange={setCropModalOpen}>
        <DialogContent className="max-w-md text-black">
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
                  <SelectItem value="4x6">4x6 inch</SelectItem>
                  <SelectItem value="2x4">2x4 inch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {pendingImage && (
              <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                <img src={pendingImage} alt="Crop preview" className="w-full h-full object-cover" />
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
