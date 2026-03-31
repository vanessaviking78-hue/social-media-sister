import React, { useState, useCallback, useRef } from "react";
import { UploadCloud, Image as ImageIcon, FileText, Loader2, Download, RefreshCcw, Layers, X, GripHorizontal } from "lucide-react";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";

import { useGenerateCarousel } from "@workspace/api-client-react";
import type { CarouselResult, CarouselSlide } from "@workspace/api-client-react/src/generated/api.schemas";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const [photos, setPhotos] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [generatedResult, setGeneratedResult] = useState<CarouselResult | null>(null);
  
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const generateCarousel = useGenerateCarousel();

  // Photo handlers
  const handlePhotosDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingPhotos(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setPhotos((prev) => [...prev, ...Array.from(e.dataTransfer.files)].filter(f => f.type.startsWith("image/")));
    }
  }, []);

  const handlePhotosChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPhotos((prev) => [...prev, ...Array.from(e.target.files!)].filter(f => f.type.startsWith("image/")));
    }
  }, []);

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // CSV handlers
  const processCsvFile = (file: File) => {
    setCsvFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvPreview(results.data.slice(0, 5));
      },
      error: (error) => {
        toast.error("Failed to parse CSV file: " + error.message);
      }
    });
  };

  const handleCsvDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingCsv(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv") || file.type === "text/csv") {
        processCsvFile(file);
      } else {
        toast.error("Please upload a valid CSV file");
      }
    }
  }, []);

  const handleCsvChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processCsvFile(e.target.files[0]);
    }
  }, []);

  // Generate handler
  const handleGenerate = () => {
    if (photos.length === 0) {
      toast.error("Please upload at least one photo");
      return;
    }
    if (!csvFile) {
      toast.error("Please upload a CSV file");
      return;
    }

    generateCarousel.mutate({
      data: {
        photos: photos,
        csv: csvFile
      }
    }, {
      onSuccess: (data) => {
        setGeneratedResult(data);
        toast.success(`Generated ${data.totalSlides} slides successfully`);
      },
      onError: (err) => {
        toast.error(err.error?.error || "Failed to generate carousel posts");
      }
    });
  };

  const handleStartOver = () => {
    setPhotos([]);
    setCsvFile(null);
    setCsvPreview([]);
    setGeneratedResult(null);
  };

  const downloadAllAsZip = async () => {
    if (!generatedResult || generatedResult.slides.length === 0) return;
    
    const toastId = toast.loading("Preparing ZIP for download...");
    
    try {
      const zip = new JSZip();
      
      for (const slide of generatedResult.slides) {
        const res = await fetch(slide.imageUrl);
        const blob = await res.blob();
        
        const img = new Image();
        const imgLoadPromise = new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = URL.createObjectURL(blob);
        });
        await imgLoadPromise;
        
        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        
        // Draw image covered
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width / 2) - (img.width / 2) * scale;
        const y = (canvas.height / 2) - (img.height / 2) * scale;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        
        // Overlay gradient/bar
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fillRect(0, canvas.height - 350, canvas.width, 350);
        
        // Draw text
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 44px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        const words = slide.text.split(" ");
        let line = "";
        let yText = canvas.height - 250;
        const lineHeight = 60;
        
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + " ";
          const metrics = ctx.measureText(testLine);
          const testWidth = metrics.width;
          if (testWidth > canvas.width - 120 && n > 0) {
            ctx.fillText(line, canvas.width / 2, yText);
            line = words[n] + " ";
            yText += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, canvas.width / 2, yText);
        
        // Draw slide number badge
        ctx.fillStyle = "#334155";
        ctx.font = "600 24px sans-serif";
        ctx.fillText(`${slide.index} / ${generatedResult.totalSlides}`, canvas.width / 2, canvas.height - 40);

        const outBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
        if (outBlob) {
          zip.file(`slide-${String(slide.index).padStart(2, "0")}.png`, outBlob);
        }
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "carousel-posts.zip");
      toast.success("Download started", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Failed to create ZIP file", { id: toastId });
    }
  };

  return (
    <div className="min-h-[100dvh] w-full pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <Layers className="w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">Carousel Studio</h1>
        </div>
        {generatedResult && (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleStartOver} className="text-muted-foreground border-muted-foreground/30 hover:text-foreground">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Start Over
            </Button>
            <Button size="sm" onClick={downloadAllAsZip}>
              <Download className="w-4 h-4 mr-2" />
              Download ZIP
            </Button>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 md:px-10 mt-10">
        {!generatedResult ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Upload Section */}
            <div className="lg:col-span-8 flex flex-col gap-8">
              <div>
                <h2 className="text-2xl font-bold mb-2">Upload Assets</h2>
                <p className="text-muted-foreground">Add your photos and CSV text to generate up to 30 slides.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Photos Upload */}
                <Card className="bg-card border-border/50 overflow-hidden shadow-sm">
                  <div
                    className={`p-8 h-full flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${isDraggingPhotos ? "bg-primary/5 border-primary" : "hover:bg-muted/50"} border-2 border-dashed border-transparent`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingPhotos(true); }}
                    onDragLeave={() => setIsDraggingPhotos(false)}
                    onDrop={handlePhotosDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      multiple
                      accept="image/*"
                      onChange={handlePhotosChange}
                    />
                    <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-4 text-primary">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold mb-1">Photos</h3>
                    <p className="text-sm text-muted-foreground">Drag & drop or click to upload</p>
                  </div>
                </Card>

                {/* CSV Upload */}
                <Card className="bg-card border-border/50 overflow-hidden shadow-sm">
                  <div
                    className={`p-8 h-full flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${isDraggingCsv ? "bg-primary/5 border-primary" : "hover:bg-muted/50"} border-2 border-dashed border-transparent`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingCsv(true); }}
                    onDragLeave={() => setIsDraggingCsv(false)}
                    onDrop={handleCsvDrop}
                    onClick={() => csvInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={csvInputRef}
                      className="hidden"
                      accept=".csv,text/csv"
                      onChange={handleCsvChange}
                    />
                    <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-4 text-primary">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold mb-1">CSV File</h3>
                    <p className="text-sm text-muted-foreground">{csvFile ? csvFile.name : "Drag & drop or click to upload"}</p>
                  </div>
                </Card>
              </div>

              {/* Photos Preview */}
              {photos.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      Selected Photos <Badge variant="secondary" className="bg-accent">{photos.length}</Badge>
                    </h3>
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                    {photos.map((file, i) => (
                      <div key={i} className="relative aspect-square rounded-md overflow-hidden group bg-accent">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="preview" 
                          className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                        />
                        <button 
                          onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar - Setup & CSV Preview */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <Card className="bg-card border-border/50 sticky top-24">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4 border-b border-border/50 pb-4">Configuration</h3>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Photos</span>
                      <span className="font-medium">{photos.length} uploaded</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">CSV Text</span>
                      <span className="font-medium">{csvFile ? "Ready" : "Missing"}</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20" 
                    onClick={handleGenerate}
                    disabled={generateCarousel.isPending}
                  >
                    {generateCarousel.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      "Generate Carousel Posts"
                    )}
                  </Button>

                  {csvPreview.length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">CSV Preview</h4>
                      <ScrollArea className="h-48 rounded-md border border-border/50 bg-background/50">
                        <div className="p-3 space-y-3">
                          {csvPreview.map((row, i) => (
                            <div key={i} className="text-sm bg-accent/50 p-2 rounded text-muted-foreground">
                              {Object.entries(row).map(([k, v]) => (
                                <div key={k} className="line-clamp-2"><span className="font-medium text-foreground">{k}:</span> {String(v)}</div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2">Your Carousel is Ready</h2>
                <p className="text-muted-foreground">Preview your {generatedResult.totalSlides} slides below before downloading.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {generatedResult.slides.map((slide) => (
                <div key={slide.index} className="relative group rounded-xl overflow-hidden shadow-md border border-border/50 aspect-square bg-card">
                  <img 
                    src={slide.imageUrl} 
                    alt={`Slide ${slide.index}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent p-6 flex flex-col justify-end">
                    <p className="text-sm font-medium text-foreground leading-snug line-clamp-4">{slide.text}</p>
                    <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-semibold">
                      {slide.index}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
