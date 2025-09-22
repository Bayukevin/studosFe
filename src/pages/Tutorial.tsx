import * as React from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaOptionsType, EmblaCarouselType } from "embla-carousel";
import { useNavigate } from "react-router-dom"; // ← opsional, kalau pakai React Router

type Slide = { title: string; desc: string };

const slides: Slide[] = [
  { title: "Step 1: Buka Aplikasi", desc: "Mulai dengan membuka aplikasi di perangkat kamu." },
  { title: "Step 2: Buat Akun", desc: "Daftarkan akun menggunakan email aktif." },
  { title: "Step 3: Pilih Paket", desc: "Pilih paket yang sesuai dengan kebutuhan kamu." },
  { title: "Step 4: Selesaikan", desc: "Konfirmasi data dan nikmati fitur yang tersedia." },
];

const AUTOPLAY_MS = 3000;

const OPTIONS: EmblaOptionsType = {
  loop: true,
  dragFree: false,
  align: "center",
  skipSnaps: false,
};

export default function Tutorial() {
  const navigate = useNavigate(); // pastikan komponen ini dirender di dalam <BrowserRouter>
  const [emblaRef, emblaApi] = useEmblaCarousel(OPTIONS);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [scrollSnaps, setScrollSnaps] = React.useState<number[]>([]);
  const isPausedRef = React.useRef(false);
  const intervalRef = React.useRef<number | null>(null);

  const onSelect = React.useCallback((api: EmblaCarouselType) => {
    setSelectedIndex(api.selectedScrollSnap());
  }, []);

  const scrollPrev = React.useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = React.useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = React.useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  // Setup embla events
  React.useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    onSelect(emblaApi);
    emblaApi.on("select", () => onSelect(emblaApi));
    emblaApi.on("reInit", () => {
      setScrollSnaps(emblaApi.scrollSnapList());
      onSelect(emblaApi);
    });
  }, [emblaApi, onSelect]);

  // Autoplay setiap 3 detik, pause saat hover/interaksi
  React.useEffect(() => {
    if (!emblaApi) return;

    const start = () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(() => {
        if (!isPausedRef.current) emblaApi.scrollNext();
      }, AUTOPLAY_MS);
    };

    const stop = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    start();
    return () => stop();
  }, [emblaApi]);

  const onSkip = () => {
    // Arahkan ke halaman mana pun, contoh: dashboard/home
    navigate("/booth"); // ← opsional, kalau pakai React Router
    // Jika kamu tidak memakai React Router:
    // window.location.href = "/";
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-background px-4 text-black"
      onMouseEnter={() => (isPausedRef.current = true)}
      onMouseLeave={() => (isPausedRef.current = false)}
    >
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Tutorial</h2>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              Slide {selectedIndex + 1} / {slides.length}
            </div>
            <button
              onClick={onSkip}
              className="text-sm px-3 py-2 rounded-lg border hover:bg-accent transition"
            >
              Skip Tutorial
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card" ref={emblaRef}>
          <div className="flex">
            {slides.map((s, i) => (
              <div className="min-w-0 basis-full shrink-0 grow-0 p-8" key={i}>
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-2">
                  <div className="text-2xl font-bold text-center">{s.title}</div>
                  <p className="text-center text-muted-foreground max-w-md">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={scrollPrev}
              className="px-3 py-2 rounded-lg border hover:bg-accent transition"
              aria-label="Previous"
            >
              Prev
            </button>
            <button
              onClick={scrollNext}
              className="px-3 py-2 rounded-lg border hover:bg-accent transition"
              aria-label="Next"
            >
              Next
            </button>
          </div>

          <div className="flex items-center gap-2">
            {scrollSnaps.map((_, i) => {
              const active = i === selectedIndex;
              return (
                <button
                  key={i}
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => scrollTo(i)}
                  className={[
                    "h-2.5 w-2.5 rounded-full transition",
                    active
                      ? "bg-foreground"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/60",
                  ].join(" ")}
                />
              );
            })}
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground text-center">
          Auto-slide tiap 3 detik • Pause saat hover • Geser untuk pindah slide
        </p>
      </div>
    </div>
  );
}
