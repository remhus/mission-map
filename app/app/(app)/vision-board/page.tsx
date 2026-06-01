'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type VisionImage = { id: number; title: string; sort_order: number };

function compressImage(file: File, maxDim = 1200, quality = 0.78): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => resolve(blob!), 'image/jpeg', quality);
    };
    img.src = objectUrl;
  });
}

const SPAN_PATTERNS = [
  'md:col-span-2 md:row-span-2',
  'md:col-span-1 md:row-span-1',
  'md:col-span-1 md:row-span-2',
  'md:col-span-1 md:row-span-1',
  'md:col-span-1 md:row-span-1',
  'md:col-span-2 md:row-span-1',
];

export default function VisionBoardPage() {
  const [images, setImages] = useState<VisionImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editingTitle, setEditingTitle] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Trophy creation flow after upload
  const [uploadQueue, setUploadQueue] = useState<Array<{ id: number; defaultTitle: string }>>([]);
  const [trophyStep, setTrophyStep] = useState(0);
  const [trophyTitle, setTrophyTitle] = useState('');
  const [trophyDesc, setTrophyDesc] = useState('');
  const [savingTrophy, setSavingTrophy] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ imageId: number; trophy: { id: number; title: string } | null } | null>(null);
  const [checkingDelete, setCheckingDelete] = useState(false);

  const showTrophyPopup = uploadQueue.length > 0 && trophyStep < uploadQueue.length;

  async function saveTitle(id: number) {
    await fetch('/api/vision-board', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: titleDraft }),
    });
    setImages(prev => prev.map(img => img.id === id ? { ...img, title: titleDraft } : img));
    setEditingTitle(null);
  }

  const fetchImages = useCallback(async () => {
    const res = await fetch('/api/vision-board');
    const data = await res.json();
    setImages(data.images || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const created: Array<{ id: number; defaultTitle: string }> = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append('file', new File([compressed], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!uploadRes.ok) continue;
      const uploadData = await uploadRes.json();
      if (uploadData.url) {
        const cleanTitle = file.name.replace(/\.[^.]+$/, '');
        const vbRes = await fetch('/api/vision-board', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: uploadData.url, title: cleanTitle, sort_order: images.length + created.length }),
        });
        const vbData = await vbRes.json();
        if (vbData.image?.id) created.push({ id: vbData.image.id, defaultTitle: cleanTitle });
      }
    }

    await fetchImages();
    setUploading(false);

    if (created.length > 0) {
      setUploadQueue(created);
      setTrophyStep(0);
      setTrophyTitle(created[0].defaultTitle);
      setTrophyDesc('');
    }
  }

  async function saveTrophyAndAdvance() {
    setSavingTrophy(true);
    const current = uploadQueue[trophyStep];
    const finalTitle = trophyTitle.trim() || current.defaultTitle;
    // Create the trophy
    await fetch('/api/achievements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: finalTitle,
        description: trophyDesc.trim(),
        trophy_tier: 'platinum',
        is_locked: true,
        vision_board_image_id: current.id,
      }),
    });
    // Always sync the title back to the vision board image
    await fetch('/api/vision-board', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: current.id, title: finalTitle }),
    });
    setImages(prev => prev.map(img => img.id === current.id ? { ...img, title: finalTitle } : img));
    setSavingTrophy(false);
    const next = trophyStep + 1;
    if (next < uploadQueue.length) {
      setTrophyStep(next);
      setTrophyTitle(uploadQueue[next].defaultTitle);
      setTrophyDesc('');
    } else {
      setUploadQueue([]);
      setTrophyStep(0);
    }
  }

  function cancelTrophyCreation() {
    setUploadQueue([]);
    setTrophyStep(0);
  }

  async function deleteImageDirectly(id: number) {
    await fetch('/api/vision-board', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setImages(prev => prev.filter(img => img.id !== id));
    if (lightbox !== null) setLightbox(null);
  }

  async function initiateDelete(imageId: number) {
    setCheckingDelete(true);
    try {
      const res = await fetch(`/api/achievements?vision_board_image_id=${imageId}`);
      const data = await res.json();
      if (data.achievement) {
        setDeleteConfirm({ imageId, trophy: { id: data.achievement.id, title: data.achievement.title } });
      } else {
        await deleteImageDirectly(imageId);
      }
    } finally {
      setCheckingDelete(false);
    }
  }

  async function confirmDelete(keepTrophy: boolean) {
    if (!deleteConfirm) return;
    const { imageId, trophy } = deleteConfirm;
    setDeleteConfirm(null);
    await deleteImageDirectly(imageId);
    if (trophy && !keepTrophy) {
      await fetch('/api/achievements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: trophy.id }) });
    }
  }

  const lightboxImg = lightbox !== null ? images[lightbox] : null;

  useEffect(() => {
    if (lightbox === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setLightbox(l => l === null ? null : (l - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setLightbox(l => l === null ? null : (l + 1) % images.length);
      if (e.key === 'Escape') setLightbox(null);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightbox, images.length]);

  return (
    <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2" style={{ fontFamily: 'var(--font-jakarta)', color: '#afc6ff' }}>
            Vision Board
          </h1>
          <p className="text-sm max-w-xl leading-relaxed" style={{ color: '#8c90a1' }}>
            Curating the life you are building. Each image represents a cornerstone of your future reality.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {images.length > 0 && (
            <button onClick={() => setFullscreen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#afc6ff' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>fullscreen</span>
              <span className="text-xs font-bold tracking-widest uppercase hidden sm:inline">Visualise</span>
            </button>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-3 px-6 py-3 rounded-full transition-all group"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e4e1e9' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}>
            <span className="material-symbols-outlined group-hover:rotate-90 transition-transform duration-300" style={{ fontSize: '20px' }}>add</span>
            <span className="text-xs font-bold tracking-widest uppercase">{uploading ? 'Uploading...' : 'Upload'}</span>
          </button>
        </div>
      </header>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => handleFiles(e.target.files)} />

      {!loading && images.length === 0 && (
        <div className="rounded-3xl flex flex-col items-center justify-center py-28 transition-all cursor-pointer"
          style={{ border: `2px dashed ${dragOver ? '#afc6ff' : 'rgba(255,255,255,0.1)'}`, background: dragOver ? 'rgba(175,198,255,0.05)' : 'rgba(255,255,255,0.02)' }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}>
          <span className="material-symbols-outlined text-6xl mb-4" style={{ color: dragOver ? '#afc6ff' : '#414655' }}>add_photo_alternate</span>
          <p className="font-semibold text-lg" style={{ color: dragOver ? '#afc6ff' : '#8c90a1' }}>
            {dragOver ? 'Drop images here' : 'Build your vision board'}
          </p>
          <p className="text-sm mt-2" style={{ color: '#414655' }}>Drag & drop or click to upload</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-3xl" style={{ color: '#afc6ff' }}>progress_activity</span>
        </div>
      ) : images.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ gridAutoRows: '220px', gridAutoFlow: 'dense' }}>
          {images.map((img, idx) => {
            const spanClass = SPAN_PATTERNS[idx % SPAN_PATTERNS.length];
            return (
              <div key={img.id}
                className={`vision-card relative group rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 ${spanClass}`}
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                onClick={() => setLightbox(idx)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(175,198,255,0.3)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(175,198,255,0.4)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/vision-board/image?id=${img.id}`} alt={img.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />

                <div className="absolute inset-0 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(to top, rgba(10,10,15,0.9) 0%, rgba(10,10,15,0.2) 50%, transparent 100%)' }}>
                  {editingTitle === img.id ? (
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveTitle(img.id); if (e.key === 'Escape') setEditingTitle(null); }}
                        className="flex-1 px-2 py-1 rounded-lg text-sm outline-none text-white"
                        style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(175,198,255,0.5)' }} />
                      <button onClick={() => saveTitle(img.id)} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#afc6ff', color: '#002d6d' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-white truncate">{img.title || 'Untitled'}</p>
                      <button onClick={e => { e.stopPropagation(); setTitleDraft(img.title); setEditingTitle(img.id); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(255,255,255,0.15)', color: '#e4e1e9' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                      </button>
                    </div>
                  )}
                </div>

                <button onClick={e => { e.stopPropagation(); initiateDelete(img.id); }} disabled={checkingDelete}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.7)', color: '#ffb4ab' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && lightboxImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.95)' }} onClick={() => setLightbox(null)}>
          <div className="relative max-w-5xl max-h-[90vh] mx-4 md:mx-14" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/vision-board/image?id=${lightboxImg.id}`} alt={lightboxImg.title}
              className="max-w-full max-h-[85vh] object-contain rounded-2xl"
              style={{ boxShadow: '0 0 60px rgba(0,0,0,0.8)' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />

            <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between rounded-b-2xl"
              style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
              {editingTitle === lightboxImg.id ? (
                <div className="flex items-center gap-2 flex-1 mr-4" onClick={e => e.stopPropagation()}>
                  <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTitle(lightboxImg.id); if (e.key === 'Escape') setEditingTitle(null); }}
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none text-white"
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(175,198,255,0.5)' }} />
                  <button onClick={() => saveTitle(lightboxImg.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#afc6ff', color: '#002d6d' }}>Save</button>
                </div>
              ) : (
                <button className="flex items-center gap-2 text-left" onClick={e => { e.stopPropagation(); setTitleDraft(lightboxImg.title); setEditingTitle(lightboxImg.id); }}>
                  <p className="font-semibold text-white">{lightboxImg.title || 'Untitled'}</p>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)' }}>edit</span>
                </button>
              )}
              <button onClick={() => initiateDelete(lightboxImg.id)} disabled={checkingDelete}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(147,0,10,0.5)', color: '#ffb4ab', border: '1px solid rgba(255,180,171,0.2)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span> Remove
              </button>
            </div>

            {images.length > 1 && (
              <>
                <button onClick={() => setLightbox((lightbox! - 1 + images.length) % images.length)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 w-10 h-10 rounded-full flex items-center justify-center transition-all"
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#e4e1e9' }}>
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button onClick={() => setLightbox((lightbox! + 1) % images.length)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 w-10 h-10 rounded-full flex items-center justify-center transition-all"
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#e4e1e9' }}>
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </>
            )}
            <button onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.7)', color: '#e4e1e9' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen mosaic */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col animate-fade-in"
          style={{ background: 'rgba(10,10,15,0.98)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-xl font-black" style={{ fontFamily: 'var(--font-jakarta)', color: '#afc6ff' }}>Vision Board</h2>
            <div className="flex items-center gap-3">
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#e4e1e9' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span> Upload
              </button>
              <button onClick={() => setFullscreen(false)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#e4e1e9' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>fullscreen_exit</span> Close
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ gridAutoRows: '200px', gridAutoFlow: 'dense' }}>
              {images.map((img, idx) => {
                const spans = ['md:col-span-2 md:row-span-2','','md:col-span-1 md:row-span-2','','','md:col-span-2'];
                return (
                  <div key={img.id}
                    className={`relative group rounded-xl overflow-hidden cursor-pointer ${spans[idx % spans.length]}`}
                    onClick={() => { setFullscreen(false); setLightbox(idx); }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/vision-board/image?id=${img.id}`} alt={img.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
                      <p className="text-xs font-semibold text-white truncate">{img.title}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---- Trophy creation popup ---- */}
      {showTrophyPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md rounded-3xl p-6 animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,215,0,0.25)', boxShadow: '0 0 40px rgba(255,215,0,0.1)' }}>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.3)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#ffd700', fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
              </div>
              <div className="flex-1">
                <h3 className="font-black text-base" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>
                  Name Your Vision
                </h3>
                <p className="text-xs" style={{ color: '#8c90a1' }}>
                  Image {trophyStep + 1} of {uploadQueue.length} · Creates a locked platinum trophy
                </p>
              </div>
              <button onClick={cancelTrophyCreation}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#8c90a1' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#e4e1e9'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#8c90a1'}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold tracking-widest uppercase mb-1.5 block" style={{ color: '#c1c6d8' }}>Trophy Title</label>
                <input value={trophyTitle} onChange={e => setTrophyTitle(e.target.value)}
                  placeholder="e.g. Dream Home, First Million..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,215,0,0.25)', color: '#e4e1e9' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,215,0,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,215,0,0.25)'}
                />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest uppercase mb-1.5 block" style={{ color: '#c1c6d8' }}>Short Description</label>
                <textarea value={trophyDesc} onChange={e => setTrophyDesc(e.target.value)}
                  rows={2} placeholder="Describe this achievement or goal..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm resize-none outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e1e9' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(175,198,255,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>

            <button onClick={saveTrophyAndAdvance} disabled={savingTrophy || !trophyTitle.trim()}
              className="mt-5 w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{
                background: savingTrophy || !trophyTitle.trim() ? 'rgba(255,215,0,0.3)' : 'rgba(255,215,0,0.15)',
                border: '1px solid rgba(255,215,0,0.4)',
                color: '#ffd700',
                boxShadow: '0 0 20px rgba(255,215,0,0.1)',
              }}>
              {savingTrophy ? 'Saving...' : trophyStep < uploadQueue.length - 1 ? `Next →` : 'Done'}
            </button>
          </div>
        </div>
      )}

      {/* ---- Delete confirmation (trophy linked) ---- */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-sm rounded-3xl p-6 animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,180,171,0.2)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#ffb4ab' }}>warning</span>
              <h3 className="font-black text-base" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>Delete Image?</h3>
            </div>
            <p className="text-sm mb-1" style={{ color: '#c1c6d8' }}>
              This image is linked to a platinum trophy:
            </p>
            <p className="text-sm font-bold mb-4" style={{ color: '#ffd700' }}>
              🏆 {deleteConfirm.trophy?.title}
            </p>
            <p className="text-xs mb-5" style={{ color: '#8c90a1' }}>
              What would you like to do with the trophy?
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => confirmDelete(false)}
                className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: 'rgba(255,180,171,0.1)', border: '1px solid rgba(255,180,171,0.3)', color: '#ffb4ab' }}>
                Delete Image &amp; Trophy
              </button>
              <button onClick={() => confirmDelete(true)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', color: '#ffd700' }}>
                Keep Trophy, Delete Image
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#8c90a1' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
