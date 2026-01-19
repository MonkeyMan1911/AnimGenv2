import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw, Plus, Trash2, GripVertical, Download, Upload, Copy } from "lucide-react";

// Type definitions
type ParseMode = "grid" | "sourceview";

type GridConfig = {
  spriteWidth: number;
  spriteHeight: number;
  rows: number;
  columns: number;
  originOffset: { x: number; y: number };
  margin: { x: number; y: number };
};

type SourceView = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Frame = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  flipH: boolean;
  flipV: boolean;
};

type AnimationFrame = {
  frameIndex: number;
  duration: number;
  flipH: boolean;
  flipV: boolean;
};

type LoopStrategy = "Freeze" | "End" | "Loop" | "PingPong";

type Animation = {
  name: string;
  frames: AnimationFrame[];
  loopStrategy: LoopStrategy;
  flipH: boolean;
  flipV: boolean;
};

const App = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [parseMode, setParseMode] = useState<ParseMode | null>(null);
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    spriteWidth: 32,
    spriteHeight: 32,
    rows: 1,
    columns: 1,
    originOffset: { x: 0, y: 0 },
    margin: { x: 0, y: 0 },
  });
  const [sourceViews, setSourceViews] = useState<SourceView[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [selectedAnimation, setSelectedAnimation] = useState<number | null>(null);
  const [animationGroupName, setAnimationGroupName] = useState("PlayerAnimations");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [imagePath, setImagePath] = useState("path/to/spritesheet.png");
  // New state for default duration
  const [defaultDuration, setDefaultDuration] = useState(150);
  const [copySuccess, setCopySuccess] = useState(false);

  // Irregular mode state
  // const [isDrawing, setIsDrawing] = useState(false);
  // const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  // const [currentRect, setCurrentRect] = useState<SourceView | null>(null);
  const [selectedSourceView, setSelectedSourceView] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1); // 1 = 100%
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 8;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationTimerRef = useRef<number | null>(null);

  const addSourceView = () => {
    const newView: SourceView = {
      x: 0,
      y: 0,
      width: gridConfig.spriteWidth,
      height: gridConfig.spriteHeight,
    };
    setSourceViews([...sourceViews, newView]);
    setSelectedSourceView(sourceViews.length);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generateCode());
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000); // hide after 2 seconds
  };

  const updateFrame = (animIndex: number, frameIndex: number, patch: Partial<AnimationFrame>) => {
    //updateFrame(i, frameIdx, { flipH: e.target.checked });
    setAnimations(prev =>
      prev.map((a, i) =>
        i === animIndex
          ? {
              ...a,
              frames: a.frames.map((f, fi) => (fi === frameIndex ? { ...f, ...patch } : f)),
            }
          : a,
      ),
    );
  };

  const updateSourceView = (index: number, updates: Partial<SourceView>) => {
    const updated = [...sourceViews];
    updated[index] = { ...updated[index], ...updates };
    setSourceViews(updated);
  };

  // Load image
  const handleImageLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setImagePath(file.name);
        setParseMode(null);
        setFrames([]);
        setSourceViews([]);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Parse frames from grid
  const parseGridFrames = () => {
    if (!image) return;

    const newFrames: Frame[] = [];
    let index = 0;

    for (let row = 0; row < gridConfig.rows; row++) {
      for (let col = 0; col < gridConfig.columns; col++) {
        newFrames.push({
          index,
          x: gridConfig.originOffset.x + col * (gridConfig.spriteWidth + gridConfig.margin.x),
          y: gridConfig.originOffset.y + row * (gridConfig.spriteHeight + gridConfig.margin.y),
          width: gridConfig.spriteWidth,
          height: gridConfig.spriteHeight,
          flipH: false,
          flipV: false,
        });
        index++;
      }
    }

    setFrames(newFrames);
  };

  // Parse frames from source views
  const parseSourceViewFrames = () => {
    const newFrames: Frame[] = sourceViews.map((sv, index) => ({
      index,
      x: sv.x,
      y: sv.y,
      width: sv.width,
      height: sv.height,
      flipH: false,
      flipV: false,
    }));
    setFrames(newFrames);
  };

  useEffect(() => {
    if (parseMode === "grid") {
      parseGridFrames();
    } else if (parseMode === "sourceview") {
      parseSourceViewFrames();
    }
  }, [parseMode, gridConfig, sourceViews, image, zoom]);

  useEffect(() => {
    if (!canvasRef.current || !image) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    canvasRef.current.width = image.width * zoom;
    canvasRef.current.height = image.height * zoom;

    ctx.setTransform(zoom, 0, 0, zoom, 0, 0); // scale everything
    ctx.clearRect(0, 0, image.width, image.height);
    ctx.drawImage(image, 0, 0);

    frames.forEach(frame => {
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 2;
      ctx.strokeRect(frame.x, frame.y, frame.width, frame.height);

      ctx.fillStyle = "rgba(0,255,0,0.2)";
      ctx.fillRect(frame.x, frame.y, frame.width, frame.height);

      ctx.fillStyle = "#ffee00";
      ctx.font = "bold 14px monospace";
      ctx.fillText(frame.index.toString(), frame.x + 4, frame.y + 16);
    });

    // highlight selected sourceView if needed
    if (selectedSourceView !== null && parseMode === "sourceview") {
      const sv = sourceViews[selectedSourceView];
      if (sv) {
        ctx.strokeStyle = "#ff00ff";
        ctx.lineWidth = 3;
        ctx.strokeRect(sv.x, sv.y, sv.width, sv.height);
      }
    }
  }, [image, frames, zoom, selectedSourceView, sourceViews, parseMode]);

  useEffect(() => {
    setCurrentFrameIdx(0);
  }, [selectedAnimation, animations[selectedAnimation || 0]?.frames.length]);

  function getImageCoords(e: React.MouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement, zoom: number) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }

  // Canvas mouse handlers for irregular mode
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !image || selectedAnimation === null) return;

    const canvas = canvasRef.current;
    const { x, y } = getImageCoords(e, canvas, zoom);

    // Find the frame under the cursor
    const clickedFrame = frames.find(f => x >= f.x && x < f.x + f.width && y >= f.y && y < f.y + f.height);

    if (clickedFrame) {
      addFrameToAnimation(selectedAnimation, clickedFrame.index);
    }
  };

  // Animation management
  const addAnimation = () => {
    const newAnim: Animation = {
      name: `Animation${animations.length + 1}`,
      frames: [],
      loopStrategy: "Loop",
      flipH: false,
      flipV: false,
    };
    setAnimations([...animations, newAnim]);
    setSelectedAnimation(animations.length);
  };

  const updateAnimation = (index: number, updates: Partial<Animation>) => {
    const updated = [...animations];
    updated[index] = { ...updated[index], ...updates };
    setAnimations(updated);
  };

  const deleteAnimation = (index: number) => {
    const updated = animations.filter((_, i) => i !== index);
    setAnimations(updated);
    if (selectedAnimation === index) {
      setSelectedAnimation(null);
    } else if (selectedAnimation !== null && selectedAnimation > index) {
      setSelectedAnimation(selectedAnimation - 1);
    }
  };

  const addFrameToAnimation = (animIndex: number, frameIndex: number) => {
    const anim = animations[animIndex];
    const newFrame: AnimationFrame = {
      frameIndex,
      duration: defaultDuration,
      flipH: false,
      flipV: false,
    };
    updateAnimation(animIndex, {
      frames: [...anim.frames, newFrame],
    });
  };

  const removeFrameFromAnimation = (animIndex: number, frameIdx: number) => {
    const anim = animations[animIndex];
    updateAnimation(animIndex, {
      frames: anim.frames.filter((_, i) => i !== frameIdx),
    });
  };

  const updateFrameDuration = (animIndex: number, frameIdx: number, duration: number) => {
    const anim = animations[animIndex];
    const updated = [...anim.frames];
    updated[frameIdx] = { ...updated[frameIdx], duration };
    updateAnimation(animIndex, { frames: updated });
  };

  // Animation preview
  useEffect(() => {
    if (!isPlaying || selectedAnimation === null) {
      if (animationTimerRef.current) {
        cancelAnimationFrame(animationTimerRef.current);
        animationTimerRef.current = null;
      }
      return;
    }

    const anim = animations[selectedAnimation];
    if (!anim || anim.frames.length === 0) return;

    let frameIdx = currentFrameIdx;
    let lastTime = performance.now();
    let direction = 1;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - lastTime;
      const currentAnimFrame = anim.frames[frameIdx];

      if (elapsed >= currentAnimFrame.duration) {
        lastTime = currentTime;

        if (anim.loopStrategy === "PingPong") {
          frameIdx += direction;
          if (frameIdx >= anim.frames.length) {
            frameIdx = anim.frames.length - 2;
            direction = -1;
          } else if (frameIdx < 0) {
            frameIdx = 1;
            direction = 1;
          }
        } else if (anim.loopStrategy === "Loop") {
          frameIdx = (frameIdx + 1) % anim.frames.length;
        } else {
          frameIdx++;
          if (frameIdx >= anim.frames.length) {
            if (anim.loopStrategy === "Freeze") {
              frameIdx = anim.frames.length - 1;
            } else {
              setIsPlaying(false);
              return;
            }
          }
        }

        setCurrentFrameIdx(frameIdx);
      }

      animationTimerRef.current = requestAnimationFrame(animate);
    };

    animationTimerRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationTimerRef.current) {
        cancelAnimationFrame(animationTimerRef.current);
      }
    };
  }, [isPlaying, selectedAnimation, currentFrameIdx, animations]);

  // Draw preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !image || selectedAnimation === null) return;

    const anim = animations[selectedAnimation];
    if (!anim || anim.frames.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animFrame = anim.frames[currentFrameIdx];
    if (!animFrame) {
      setCurrentFrameIdx(0);
      return;
    }

    const frame = frames[animFrame.frameIndex];
    if (!frame) return;

    // Apply zoom or fixed scale for preview
    const scale = 4;
    canvas.width = frame.width * scale;
    canvas.height = frame.height * scale;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Determine flipping
    const flipH = animFrame.flipH || anim.flipH;
    const flipV = animFrame.flipV || anim.flipV;

    ctx.save();
    ctx.translate(flipH ? canvas.width : 0, flipV ? canvas.height : 0);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, canvas.width, canvas.height);

    ctx.restore();
  }, [image, selectedAnimation, currentFrameIdx, animations, frames]);

  // Generate TypeScript code
  const generateCode = () => {
    if (!image || frames.length === 0) return "";

    let code = `import { ImageSource, SpriteSheet, Animation, AnimationStrategy } from 'excalibur';\n\n`;
    code += `// Load the spritesheet image\n`;
    code += `// !!!! THIS IS /public FOLDER IF USING VITE !!!!\n`;
    code += `const imageSource = new ImageSource('${imagePath}');\n\n`;
    code += `// Wait for the image to load\n`;
    code += `await imageSource.load();\n\n`;

    if (parseMode === "grid") {
      code += `// Create spritesheet using grid-based parsing\n`;
      code += `const spriteSheet = SpriteSheet.fromImageSource({\n`;
      code += `  image: imageSource,\n`;
      code += `  grid: {\n`;
      code += `    rows: ${gridConfig.rows},\n`;
      code += `    columns: ${gridConfig.columns},\n`;
      code += `    spriteWidth: ${gridConfig.spriteWidth},\n`;
      code += `    spriteHeight: ${gridConfig.spriteHeight}\n`;
      code += `  }`;

      const hasSpacing =
        gridConfig.originOffset.x !== 0 || gridConfig.originOffset.y !== 0 || gridConfig.margin.x !== 0 || gridConfig.margin.y !== 0;

      if (hasSpacing) {
        code += `,\n  spacing: {\n`;
        code += `    originOffset: { x: ${gridConfig.originOffset.x}, y: ${gridConfig.originOffset.y} },\n`;
        code += `    margin: { x: ${gridConfig.margin.x}, y: ${gridConfig.margin.y} }\n`;
        code += `  }`;
      }

      code += `\n});\n\n`;
    } else if (parseMode === "sourceview") {
      code += `// Create spritesheet using source views (irregular frames)\n`;
      code += `const spriteSheet = SpriteSheet.fromImageSourceWithSourceViews({\n`;
      code += `  image: imageSource,\n`;
      code += `  sourceViews: [\n`;
      sourceViews.forEach((sv, i) => {
        code += `    { x: ${sv.x}, y: ${sv.y}, width: ${sv.width}, height: ${sv.height} }`;
        code += i < sourceViews.length - 1 ? ",\n" : "\n";
      });
      code += `  ]\n`;
      code += `});\n\n`;
    }

    const strategyMap: Record<LoopStrategy, string> = {
      Loop: "Loop",
      Freeze: "Freeze",
      End: "End",
      PingPong: "PingPong",
    };

    code += `// Frame graphics (with optional per-frame flipping)\n\n`;

    animations.forEach(anim => {
      anim.frames.forEach((f, fIdx) => {
        const baseName = `${anim.name}_Frame${fIdx}`;
        const baseGraphic = `${baseName}Graphic`;

        // Base graphic
        code += `const ${baseGraphic} = spriteSheet.sprites[${f.frameIndex}];\n`;

        // Flipped variant (if needed)
        if (f.flipH || f.flipV) {
          const flippedGraphic = `${baseGraphic}Flipped`;
          code += `const ${flippedGraphic} = ${baseGraphic}.clone();\n`;
          if (f.flipH) {
            code += `${flippedGraphic}.flipHorizontal = true;\n`;
          }
          if (f.flipV) {
            code += `${flippedGraphic}.flipVertical = true;\n`;
          }
          code += `\n`;
        }
      });
    });

    code += `\n`;

    code += `// Animation definitions\n\n`;

    // 1️⃣ Create base animations
    animations.forEach(anim => {
      code += `const ${anim.name}Base = new Animation({\n`;
      code += `  frames: [\n`;

      anim.frames.forEach((f, fIdx) => {
        const baseGraphic = `${anim.name}_Frame${fIdx}Graphic`;
        const graphicVar = f.flipH || f.flipV ? `${baseGraphic}Flipped` : baseGraphic;

        code += `    { graphic: ${graphicVar}, duration: ${f.duration} }`;
        code += fIdx < anim.frames.length - 1 ? ",\n" : "\n";
      });

      code += `  ],\n`;
      code += `  strategy: AnimationStrategy.${strategyMap[anim.loopStrategy]}\n`;
      code += `});\n\n`;

      // Animation-level flipping (unchanged from Issue #1)
      if (anim.flipH || anim.flipV) {
        code += `const ${anim.name} = ${anim.name}Base.clone();\n`;
        if (anim.flipH) {
          code += `${anim.name}.flipHorizontal = true;\n`;
        }
        if (anim.flipV) {
          code += `${anim.name}.flipVertical = true;\n`;
        }
        code += `\n`;
      } else {
        code += `const ${anim.name} = ${anim.name}Base;\n\n`;
      }
    });

    // 3️⃣ Export object references
    code += `export const ${animationGroupName} = {\n`;
    animations.forEach((anim, i) => {
      code += `  ${anim.name}`;
      code += i < animations.length - 1 ? ",\n" : "\n";
    });
    code += `};\n`;

    return code;
  };

  useEffect(() => {
    if (parseMode === "grid") {
      parseGridFrames(); // recalculates frames
    } else if (parseMode === "sourceview") {
      parseSourceViewFrames();
    }
  }, [parseMode, gridConfig, sourceViews, image]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scaledWidth = image.width * zoom;
    const scaledHeight = image.height * zoom;

    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    ctx.imageSmoothingEnabled = false; // important for pixel art
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0);

    ctx.clearRect(0, 0, image.width, image.height);
    ctx.drawImage(image, 0, 0);

    // draw grid / selections in *unscaled coordinates*
  }, [image, zoom]);

  const downloadCode = () => {
    const code = generateCode();
    const blob = new Blob([code], { type: "text/typescript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${animationGroupName}.ts`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-20">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-blue-400">Excalibur Animation Builder (v2.1)</h1>
          <p className="text-gray-400 mt-1">Parse spritesheets and generate animation code</p>
        </header>

        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel - Configuration */}
          <div className="col-span-3 space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">1. Load Image</h2>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageLoad} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center justify-center gap-2"
              >
                <Upload size={16} />
                Load Spritesheet
              </button>
              {image && (
                <div className="mt-2 text-sm text-gray-400">
                  {image.width} × {image.height}
                </div>
              )}
            </div>

            {image && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-3">2. Parse Mode</h2>
                <div className="space-y-2">
                  <button
                    onClick={() => setParseMode("grid")}
                    className={`w-full px-4 py-2 rounded ${parseMode === "grid" ? "bg-green-600" : "bg-gray-700 hover:bg-gray-600"}`}
                  >
                    Grid-Based
                  </button>
                  <button
                    onClick={() => setParseMode("sourceview")}
                    className={`w-full px-4 py-2 rounded ${
                      parseMode === "sourceview" ? "bg-green-600" : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    Irregular (Manual)
                  </button>
                </div>
              </div>
            )}

            {parseMode === "grid" && (
              <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Grid Config</h3>
                <div>
                  <label className="text-sm text-gray-400">Sprite Width</label>
                  <input
                    type="number"
                    value={gridConfig.spriteWidth}
                    onChange={e => setGridConfig({ ...gridConfig, spriteWidth: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-700 px-3 py-1 rounded mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Sprite Height</label>
                  <input
                    type="number"
                    value={gridConfig.spriteHeight}
                    onChange={e => setGridConfig({ ...gridConfig, spriteHeight: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-700 px-3 py-1 rounded mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm text-gray-400">Rows</label>
                    <input
                      type="number"
                      value={gridConfig.rows}
                      onChange={e => setGridConfig({ ...gridConfig, rows: parseInt(e.target.value) || 1 })}
                      className="w-full bg-gray-700 px-3 py-1 rounded mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Columns</label>
                    <input
                      type="number"
                      value={gridConfig.columns}
                      onChange={e => setGridConfig({ ...gridConfig, columns: parseInt(e.target.value) || 1 })}
                      className="w-full bg-gray-700 px-3 py-1 rounded mt-1"
                    />
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-700">
                  <label className="text-sm text-gray-400">Origin Offset</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input
                      type="number"
                      placeholder="X"
                      value={gridConfig.originOffset.x}
                      onChange={e =>
                        setGridConfig({
                          ...gridConfig,
                          originOffset: { ...gridConfig.originOffset, x: parseInt(e.target.value) || 0 },
                        })
                      }
                      className="bg-gray-700 px-3 py-1 rounded"
                    />
                    <input
                      type="number"
                      placeholder="Y"
                      value={gridConfig.originOffset.y}
                      onChange={e =>
                        setGridConfig({
                          ...gridConfig,
                          originOffset: { ...gridConfig.originOffset, y: parseInt(e.target.value) || 0 },
                        })
                      }
                      className="bg-gray-700 px-3 py-1 rounded"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Margin</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input
                      type="number"
                      placeholder="X"
                      value={gridConfig.margin.x}
                      onChange={e =>
                        setGridConfig({ ...gridConfig, margin: { ...gridConfig.margin, x: parseInt(e.target.value) || 0 } })
                      }
                      className="bg-gray-700 px-3 py-1 rounded"
                    />
                    <input
                      type="number"
                      placeholder="Y"
                      value={gridConfig.margin.y}
                      onChange={e =>
                        setGridConfig({ ...gridConfig, margin: { ...gridConfig.margin, y: parseInt(e.target.value) || 0 } })
                      }
                      className="bg-gray-700 px-3 py-1 rounded"
                    />
                  </div>
                </div>
              </div>
            )}

            {parseMode === "sourceview" && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Source Views</h3>
                  <button onClick={addSourceView} className="bg-blue-600 hover:bg-blue-500 p-1 rounded" title="Add New Source View">
                    <Plus size={18} />
                  </button>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {sourceViews.map((sv, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded border-l-4 ${
                        selectedSourceView === i ? "bg-gray-700 border-blue-500" : "bg-gray-700/50 border-transparent"
                      }`}
                      onClick={() => setSelectedSourceView(i)}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-mono font-bold text-gray-400">INDEX {i}</span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSourceViews(sourceViews.filter((_, idx) => idx !== i));
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 w-4">X:</span>
                          <input
                            type="number"
                            value={sv.x}
                            onChange={e => updateSourceView(i, { x: parseInt(e.target.value) || 0 })}
                            className="w-full bg-gray-900 text-xs p-1 rounded border border-gray-600 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 w-4">Y:</span>
                          <input
                            type="number"
                            value={sv.y}
                            onChange={e => updateSourceView(i, { y: parseInt(e.target.value) || 0 })}
                            className="w-full bg-gray-900 text-xs p-1 rounded border border-gray-600 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 w-4">W:</span>
                          <input
                            type="number"
                            value={sv.width}
                            onChange={e => updateSourceView(i, { width: parseInt(e.target.value) || 0 })}
                            className="w-full bg-gray-900 text-xs p-1 rounded border border-gray-600 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 w-4">H:</span>
                          <input
                            type="number"
                            value={sv.height}
                            onChange={e => updateSourceView(i, { height: parseInt(e.target.value) || 0 })}
                            className="w-full bg-gray-900 text-xs p-1 rounded border border-gray-600 focus:border-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {sourceViews.length === 0 && <div className="text-center py-4 text-gray-500 text-sm">No source views defined.</div>}
                </div>
              </div>
            )}
          </div>

          {/* Center Panel - Canvas */}
          <div className="col-span-5">
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-1">Spritesheet</h2>
              <p className="text-xs text-gray-400 mb-3">
                {selectedAnimation !== null
                  ? "Click a frame to add it to the selected animation."
                  : "Select an animation on the right to start adding frames."}
              </p>
              <div className="flex items-center gap-2 mb-2 text-sm">
                <span className="text-gray-400">Zoom</span>

                <button
                  onClick={() => setZoom(z => Math.max(MIN_ZOOM, z / 1.25))}
                  className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                >
                  −
                </button>

                <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>

                <button
                  onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.25))}
                  className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                >
                  +
                </button>

                <button onClick={() => setZoom(1)} className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded ml-2">
                  Reset
                </button>
              </div>

              <div className="bg-gray-900 rounded overflow-auto" style={{ maxHeight: "700px" }}>
                {image && <canvas ref={canvasRef} className="cursor-pointer" onMouseDown={handleCanvasMouseDown} />}
              </div>
            </div>

            {selectedAnimation !== null && (
              <div className="bg-gray-800 rounded-lg p-4 mt-4">
                <h2 className="text-lg font-semibold mb-3">Animation Preview</h2>
                <div className="bg-gray-900 rounded p-4 flex items-center justify-center" style={{ minHeight: "200px" }}>
                  <canvas ref={previewCanvasRef} className="pixelated" />
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      setIsPlaying(!isPlaying);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center gap-2"
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <button
                    onClick={() => {
                      setCurrentFrameIdx(0);
                      setIsPlaying(false);
                    }}
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded flex items-center gap-2"
                  >
                    <RotateCcw size={16} />
                    Restart
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Animations */}
          <div className="col-span-4 space-y-4">
            <div className="bg-gray-800 rounded-lg p-3">
              <h2 className="text-lg font-semibold mb-3">3. Animations</h2>
              <div>
                <label className="text-sm text-gray-400">Group Name</label>
                <input
                  type="text"
                  value={animationGroupName}
                  onChange={e => setAnimationGroupName(e.target.value)}
                  className="w-full bg-gray-700 px-3 py-1 rounded mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Default Duration (ms)</label>
                <input
                  type="number"
                  value={defaultDuration}
                  onChange={e => setDefaultDuration(parseInt(e.target.value) || 150)}
                  className="w-full bg-gray-700 px-3 py-1 rounded mt-1 mb-2"
                />
              </div>

              <button
                onClick={addAnimation}
                className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                New Animation
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {animations.map((anim, i) => (
                <div
                  key={i}
                  className={`bg-gray-800 rounded-lg p-3 cursor-pointer ${selectedAnimation === i ? "ring-2 ring-blue-500" : ""}`}
                  onClick={() => {
                    setSelectedAnimation(i);
                    setCurrentFrameIdx(0);
                    setIsPlaying(false);
                  }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <input
                      type="text"
                      value={anim.name}
                      onChange={e => {
                        e.stopPropagation();
                        updateAnimation(i, { name: e.target.value });
                      }}
                      className="bg-gray-700 px-2 py-1 rounded text-sm flex-1 mr-2"
                      onClick={e => e.stopPropagation()}
                    />
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        deleteAnimation(i);
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex gap-3 mb-2">
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!anim.flipH}
                        onChange={e => {
                          e.stopPropagation();
                          updateAnimation(i, { flipH: e.target.checked });
                        }}
                        className="accent-gray-500"
                      />
                      Flip H
                    </label>

                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!anim.flipV}
                        onChange={e => {
                          e.stopPropagation();
                          updateAnimation(i, { flipV: e.target.checked });
                        }}
                        className="accent-gray-500"
                      />
                      Flip V
                    </label>
                  </div>

                  <div className="mb-2">
                    <label className="text-xs text-gray-400">Loop Strategy</label>
                    <select
                      value={anim.loopStrategy}
                      onChange={e => {
                        e.stopPropagation();
                        updateAnimation(i, { loopStrategy: e.target.value as LoopStrategy });
                      }}
                      onClick={e => e.stopPropagation()}
                      className="w-full bg-gray-700 px-2 py-1 rounded text-sm mt-1"
                    >
                      <option value="Loop">Loop</option>
                      <option value="Freeze">Freeze</option>
                      <option value="End">End</option>
                      <option value="PingPong">PingPong</option>
                    </select>
                  </div>

                  <div className="text-xs text-gray-400 mb-2">{anim.frames.length} frames</div>

                  {selectedAnimation === i && (
                    <div className="space-y-2 mt-3 pt-3 border-t border-gray-700">
                      <div className="text-sm font-semibold mb-2">Frames - click framed images on spritesheet to edit</div>
                      {anim.frames.map((frame, frameIdx) => (
                        <div key={frameIdx} className="flex items-center gap-2 bg-gray-700 p-2 rounded">
                          <GripVertical size={14} className="text-gray-500" />
                          <span className="text-sm flex-1">Frame {frame.frameIndex}</span>
                          <div className="flex gap-2">
                            <label
                              className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer"
                              onClick={e => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={!!frame.flipH}
                                title="Flip Horizontal"
                                onChange={e => {
                                  e.stopPropagation();
                                  updateFrame(i, frameIdx, { flipH: e.target.checked });
                                }}
                                className="accent-gray-500"
                              />
                              H
                            </label>

                            <label
                              className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer"
                              onClick={e => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={!!frame.flipV}
                                title="Flip Vertical"
                                onChange={e => {
                                  e.stopPropagation();
                                  updateFrame(i, frameIdx, { flipV: e.target.checked });
                                }}
                                className="accent-gray-500"
                              />
                              V
                            </label>
                          </div>
                          <input
                            type="number"
                            value={frame.duration}
                            onChange={e => {
                              e.stopPropagation();
                              updateFrameDuration(i, frameIdx, parseInt(e.target.value) || 150);
                            }}
                            onClick={e => e.stopPropagation()}
                            className="w-16 bg-gray-600 px-2 py-1 rounded text-xs"
                            placeholder="ms"
                          />
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              removeFrameFromAnimation(i, frameIdx);
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}

                      {/* <div className="pt-2">
                        <label className="text-xs text-gray-400 mb-1 block">Add Frame</label>
                        <select
                          onChange={e => {
                            const frameIndex = parseInt(e.target.value);
                            if (!isNaN(frameIndex)) {
                              addFrameToAnimation(i, frameIndex);
                              e.target.value = "";
                            }
                          }}
                          onClick={e => e.stopPropagation()}
                          className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Select frame...
                          </option>
                          {frames.map(f => (
                            <option key={f.index} value={f.index}>
                              Frame {f.index}
                            </option>
                          ))}
                        </select>
                      </div> */}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {animations.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-3">4. Export Code</h2>
                <div className="mb-3">
                  <label className="text-sm text-gray-400">Image Path</label>
                  <input
                    type="text"
                    value={imagePath}
                    onChange={e => setImagePath(e.target.value)}
                    className="w-full bg-gray-700 px-3 py-1 rounded mt-1 text-sm"
                  />
                </div>
                <button
                  onClick={downloadCode}
                  className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Download TypeScript
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Code Preview */}
        {animations.length > 0 && (
          <div className="mt-6 bg-gray-800 rounded-lg p-4 relative">
            <h2 className="text-lg font-semibold mb-3">Generated Code Preview</h2>

            {/* Copy button */}
            <button
              onClick={handleCopyCode}
              className="absolute top-4 right-4 bg-gray-700 hover:bg-gray-600 p-2 rounded"
              title="Copy to clipboard"
            >
              <Copy size={16} />
            </button>

            {/* Toast message */}
            {copySuccess && (
              <div className="absolute top-2 right-16 bg-green-600 text-white px-3 py-1 rounded shadow-lg transition-opacity duration-300">
                Copied!
              </div>
            )}

            <pre className="bg-gray-900 p-4 rounded overflow-x-auto text-sm">
              <code className="text-green-400">{generateCode()}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
