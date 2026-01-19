import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw, Plus, Trash2, GripVertical, Download, Upload } from "lucide-react";

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
};

type AnimationFrame = {
  frameIndex: number;
  duration: number;
};

type LoopStrategy = "Freeze" | "End" | "Loop" | "PingPong";

type Animation = {
  name: string;
  frames: AnimationFrame[];
  loopStrategy: LoopStrategy;
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

  // Irregular mode state
  // const [isDrawing, setIsDrawing] = useState(false);
  // const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  // const [currentRect, setCurrentRect] = useState<SourceView | null>(null);
  const [selectedSourceView, setSelectedSourceView] = useState<number | null>(null);

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
    }));
    setFrames(newFrames);
  };

  useEffect(() => {
    if (parseMode === "grid") {
      parseGridFrames();
    } else if (parseMode === "sourceview") {
      parseSourceViewFrames();
    }
  }, [parseMode, gridConfig, sourceViews, image]);

  // Draw spritesheet with frame overlays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = image.width;
    canvas.height = image.height;

    ctx.drawImage(image, 0, 0);

    // Draw frame overlays
    frames.forEach(frame => {
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 2;
      ctx.strokeRect(frame.x, frame.y, frame.width, frame.height);

      ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
      ctx.fillRect(frame.x, frame.y, frame.width, frame.height);

      ctx.fillStyle = "#00ff00";
      ctx.font = "bold 14px monospace";
      ctx.fillText(frame.index.toString(), frame.x + 4, frame.y + 16);
    });

    // Draw current drawing rectangle
    // if (currentRect && parseMode === "sourceview") {
    //   ctx.strokeStyle = "#ffff00";
    //   ctx.lineWidth = 2;
    //   ctx.strokeRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
    // }

    // Highlight selected source view
    if (selectedSourceView !== null && parseMode === "sourceview") {
      const sv = sourceViews[selectedSourceView];
      if (sv) {
        ctx.strokeStyle = "#ff00ff";
        ctx.lineWidth = 3;
        ctx.strokeRect(sv.x, sv.y, sv.width, sv.height);
      }
    }
  }, [image, frames, selectedSourceView, parseMode]);

  useEffect(() => {
    setCurrentFrameIdx(0);
  }, [selectedAnimation, animations[selectedAnimation || 0]?.frames.length]);

  // Canvas mouse handlers for irregular mode
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));

    // If an animation is selected, click to add frame
    if (selectedAnimation !== null) {
      const clickedFrame = frames.find(f => x >= f.x && x <= f.x + f.width && y >= f.y && y <= f.y + f.height);

      if (clickedFrame) {
        addFrameToAnimation(selectedAnimation, clickedFrame.index);
      }
    }
  };

  // const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
  //   if (!isDrawing || !drawStart || parseMode !== "sourceview") return;

  //   const canvas = canvasRef.current;
  //   if (!canvas) return;

  //   const rect = canvas.getBoundingClientRect();
  //   const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
  //   const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));

  //   const width = x - drawStart.x;
  //   const height = y - drawStart.y;

  //   setCurrentRect({
  //     x: width < 0 ? x : drawStart.x,
  //     y: height < 0 ? y : drawStart.y,
  //     width: Math.abs(width),
  //     height: Math.abs(height),
  //   });
  // };

  // const handleCanvasMouseUp = () => {
  //   if (!isDrawing || !currentRect || parseMode !== "sourceview") return;

  //   if (currentRect.width > 5 && currentRect.height > 5) {
  //     setSourceViews([...sourceViews, currentRect]);
  //   }

  //   setIsDrawing(false);
  //   setDrawStart(null);
  //   setCurrentRect(null);
  // };

  // Animation management
  const addAnimation = () => {
    const newAnim: Animation = {
      name: `Animation${animations.length + 1}`,
      frames: [],
      loopStrategy: "Loop",
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
    const newFrame: AnimationFrame = { frameIndex, duration: defaultDuration };
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

    canvas.width = frame.width * 4;
    canvas.height = frame.height * 4;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, canvas.width, canvas.height);
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

    code += `// Animation definitions\n`;
    code += `export const ${animationGroupName} = {\n`;

    animations.forEach((anim, i) => {
      const strategyMap: Record<LoopStrategy, string> = {
        Loop: "Loop",
        Freeze: "Freeze",
        End: "End",
        PingPong: "PingPong",
      };

      code += `  ${anim.name}: new Animation({\n`;
      code += `    frames: [\n`;
      anim.frames.forEach((f, fIdx) => {
        code += `      { graphic: spriteSheet.sprites[${f.frameIndex}], duration: ${f.duration} }`;
        code += fIdx < anim.frames.length - 1 ? ",\n" : "\n";
      });
      code += `    ]`;
      code += `,\n    strategy: AnimationStrategy.${strategyMap[anim.loopStrategy]}`;

      code += `\n  })`;
      code += i < animations.length - 1 ? ",\n" : "\n";
    });

    code += `};\n`;

    return code;
  };

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
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-blue-400">Excalibur Animation Builder</h1>
          <p className="text-gray-400 mt-1">Parse spritesheets and generate animation code</p>
        </header>

        <div className="grid grid-cols-12 gap-6">
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
          <div className="col-span-6">
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-1">Spritesheet</h2>
              <p className="text-xs text-gray-400 mb-3">
                {selectedAnimation !== null
                  ? "Click a frame to add it to the selected animation."
                  : "Select an animation on the right to start adding frames."}
              </p>
              <div className="bg-gray-900 rounded overflow-auto" style={{ maxHeight: "600px" }}>
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
          <div className="col-span-3 space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
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
                  onChange={e => setDefaultDuration(parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-700 px-3 py-1 rounded mt-1"
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
                  <div className="flex justify-between items-center mb-2">
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
                      <div className="text-sm font-semibold mb-2">Frames</div>
                      {anim.frames.map((frame, frameIdx) => (
                        <div key={frameIdx} className="flex items-center gap-2 bg-gray-700 p-2 rounded">
                          <GripVertical size={14} className="text-gray-500" />
                          <span className="text-sm flex-1">Frame {frame.frameIndex}</span>
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

                      <div className="pt-2">
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
                      </div>
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
          <div className="mt-6 bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">Generated Code Preview</h2>
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
