'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type Book = {
  id: number;
  ol_key: string;
  title: string;
  author: string;
  cover_id: string;
  isbn: string;
  star_rating: number;
  status: string;
};

type OLDoc = {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  isbn?: string[];
  first_publish_year?: number;
};

function coverUrl(coverId: string | number | undefined, size: 'S' | 'M' | 'L' = 'M') {
  if (!coverId) return '';
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

function olSearchUrl(q: string) {
  const isIsbn = /^[\d\-]{10,17}$/.test(q.replace(/\s/g, ''));
  return isIsbn
    ? `https://openlibrary.org/search.json?isbn=${encodeURIComponent(q.replace(/[-\s]/g, ''))}&fields=key,title,author_name,cover_i,isbn,first_publish_year&limit=5`
    : `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=key,title,author_name,cover_i,isbn,first_publish_year&limit=8`;
}

// Fetches and renders a book description from Open Library Works API
function BookDescription({ olKey }: { olKey: string }) {
  const [desc, setDesc] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!olKey) { setLoading(false); return; }
    setDesc(null); setExpanded(false); setLoading(true);
    fetch(`https://openlibrary.org${olKey}.json`)
      .then(r => r.json())
      .then(d => {
        const text = typeof d.description === 'string'
          ? d.description
          : (d.description?.value as string | undefined) ?? null;
        setDesc(text?.trim() || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [olKey]);

  if (loading) return (
    <div className="flex flex-col gap-1.5 mt-1">
      {[100, 90, 60].map((w, i) => (
        <div key={i} className="h-3 rounded-full animate-pulse" style={{ width: `${w}%`, background: 'rgba(255,255,255,0.06)' }} />
      ))}
    </div>
  );
  if (!desc) return null;

  const LIMIT = 220;
  const long = desc.length > LIMIT;

  return (
    <div>
      <p className="text-sm leading-relaxed" style={{ color: '#8c90a1' }}>
        {!expanded && long ? desc.slice(0, LIMIT).trimEnd() + '…' : desc}
      </p>
      {long && (
        <button onClick={() => setExpanded(v => !v)}
          className="text-xs font-bold mt-1.5"
          style={{ color: '#afc6ff', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          style={{ color: n <= (hover || value) ? '#ffd700' : 'rgba(255,255,255,0.15)', cursor: onChange ? 'pointer' : 'default', background: 'none', border: 'none', padding: '3px', fontSize: '20px', lineHeight: 1 }}>
          ★
        </button>
      ))}
    </div>
  );
}

// Cover image with fade-in on load
function FadeImg({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src} alt={alt}
      className={className}
      style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.35s ease', width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      loading="eager"
      onLoad={() => setLoaded(true)}
    />
  );
}

function CoverBox({ coverId, title, size = 'M', className = '' }: { coverId?: string; title: string; size?: 'S' | 'M' | 'L'; className?: string }) {
  const src = coverUrl(coverId, size);
  return src ? (
    <FadeImg src={src} alt={title} className={className} />
  ) : (
    <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <span className="material-symbols-outlined" style={{ color: '#2e3140', fontSize: '28px' }}>menu_book</span>
    </div>
  );
}

function OLCoverBox({ doc, size = 'M' }: { doc: OLDoc; size?: 'S' | 'M' | 'L' }) {
  const src = coverUrl(doc.cover_i, size);
  return src ? (
    <FadeImg src={src} alt={doc.title} />
  ) : (
    <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <span className="material-symbols-outlined" style={{ color: '#2e3140', fontSize: '28px' }}>menu_book</span>
    </div>
  );
}

function BuyLinks({ title, author }: { title: string; author: string }) {
  const q = encodeURIComponent(`${title} ${author}`).replace(/%20/g, '+');
  const links = [
    { label: 'Amazon', icon: 'shopping_cart', url: `https://www.amazon.co.uk/s?k=${q}` },
    { label: 'Google Books', icon: 'search', url: `https://books.google.com/books?q=${q}` },
    { label: 'Bookshop.org', icon: 'store', url: `https://bookshop.org/search?keywords=${encodeURIComponent(title)}` },
  ];
  return (
    <div className="flex flex-col gap-2 w-full">
      <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#8c90a1' }}>Where to buy</p>
      {links.map(l => (
        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#c1c6d8', textDecoration: 'none' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.1)'; (e.currentTarget as HTMLElement).style.color = '#afc6ff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#c1c6d8'; }}>
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px' }}>{l.icon}</span>
          <span className="text-sm font-medium">{l.label}</span>
          <span className="material-symbols-outlined ml-auto flex-shrink-0" style={{ fontSize: '16px', color: '#414655' }}>open_in_new</span>
        </a>
      ))}
    </div>
  );
}

// Skeleton card shown while initial book list loads
function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2">
      <div className="w-full rounded-2xl animate-pulse" style={{ aspectRatio: '2/3', background: 'rgba(255,255,255,0.06)' }} />
      <div className="flex flex-col gap-1">
        <div className="h-2.5 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.05)', width: '85%' }} />
        <div className="h-2 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.03)', width: '60%' }} />
      </div>
    </div>
  );
}

export default function BookClub() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Book modal
  const [showAdd, setShowAdd] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<OLDoc[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addPending, setAddPending] = useState<OLDoc | null>(null);
  const [addRating, setAddRating] = useState(3);
  const [addingBook, setAddingBook] = useState(false);
  const addTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read book detail
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editRating, setEditRating] = useState(0);

  // Discover / Wishlist modal
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverTab, setDiscoverTab] = useState<'discover' | 'wishlist'>('discover');

  // Discover tab — recommendations
  const [discoverBooks, setDiscoverBooks] = useState<OLDoc[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  // Discover tab — search (moved from wishlist)
  const [dQuery, setDQuery] = useState('');
  const [dResults, setDResults] = useState<OLDoc[]>([]);
  const [dSearching, setDSearching] = useState(false);
  const dTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Discover detail + read flow
  const [discoverSelected, setDiscoverSelected] = useState<OLDoc | null>(null);
  const [discoverReadView, setDiscoverReadView] = useState(false); // true = rate+confirm step
  const [discoverAddRating, setDiscoverAddRating] = useState(3);
  const [discoverAdding, setDiscoverAdding] = useState(false);
  const [savingWl, setSavingWl] = useState<string | null>(null);

  // Wishlist book detail
  const [wlSelected, setWlSelected] = useState<Book | null>(null);
  const [markReadRating, setMarkReadRating] = useState(3);
  const [markingRead, setMarkingRead] = useState(false);
  const [wlReadView, setWlReadView] = useState(false);

  const fetchBooks = useCallback(async () => {
    const res = await fetch('/api/books');
    if (res.ok) {
      const d = await res.json();
      setBooks(d.books || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  // Add Book search
  useEffect(() => {
    if (addTimer.current) clearTimeout(addTimer.current);
    const q = addQuery.trim();
    if (!q) { setAddResults([]); return; }
    addTimer.current = setTimeout(async () => {
      setAddSearching(true);
      try {
        const res = await fetch(olSearchUrl(q));
        const data = await res.json();
        setAddResults((data.docs || []).filter((d: OLDoc) => d.title));
      } catch { setAddResults([]); }
      setAddSearching(false);
    }, 400);
    return () => { if (addTimer.current) clearTimeout(addTimer.current); };
  }, [addQuery]);

  // Discover tab search
  useEffect(() => {
    if (dTimer.current) clearTimeout(dTimer.current);
    const q = dQuery.trim();
    if (!q) { setDResults([]); return; }
    dTimer.current = setTimeout(async () => {
      setDSearching(true);
      try {
        const res = await fetch(olSearchUrl(q));
        const data = await res.json();
        setDResults((data.docs || []).filter((d: OLDoc) => d.title));
      } catch { setDResults([]); }
      setDSearching(false);
    }, 400);
    return () => { if (dTimer.current) clearTimeout(dTimer.current); };
  }, [dQuery]);

  const readBooks = books.filter(b => b.status === 'read');
  const wishlistBooks = books.filter(b => b.status === 'wishlist');

  function docStatus(doc: OLDoc): 'read' | 'wishlist' | null {
    if (readBooks.some(b => (b.ol_key && b.ol_key === doc.key) || b.title.toLowerCase() === doc.title.toLowerCase())) return 'read';
    if (wishlistBooks.some(b => (b.ol_key && b.ol_key === doc.key) || b.title.toLowerCase() === doc.title.toLowerCase())) return 'wishlist';
    return null;
  }

  async function postBook(doc: OLDoc, status: 'read' | 'wishlist', rating: number) {
    return fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ol_key: doc.key, title: doc.title,
        author: doc.author_name?.[0] || '',
        cover_id: doc.cover_i ? String(doc.cover_i) : '',
        isbn: doc.isbn?.[0] || '',
        star_rating: rating, status,
      }),
    });
  }

  async function addReadBook(doc: OLDoc, rating: number) {
    setAddingBook(true);
    if ((await postBook(doc, 'read', rating)).ok) await fetchBooks();
    setAddingBook(false);
    closeAdd();
  }

  async function saveToWishlist(doc: OLDoc) {
    setSavingWl(doc.key);
    if ((await postBook(doc, 'wishlist', 0)).ok) await fetchBooks();
    setSavingWl(null);
  }

  async function addDiscoverAsRead(doc: OLDoc, rating: number) {
    setDiscoverAdding(true);
    if ((await postBook(doc, 'read', rating)).ok) await fetchBooks();
    setDiscoverAdding(false);
    setDiscoverSelected(null);
    setDiscoverReadView(false);
  }

  async function markAsRead(book: Book, rating: number) {
    setMarkingRead(true);
    await fetch('/api/books', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: book.id, status: 'read', star_rating: rating }),
    });
    await fetchBooks();
    setMarkingRead(false);
    setWlSelected(null);
    setWlReadView(false);
  }

  async function updateRating(id: number, rating: number) {
    await fetch('/api/books', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, star_rating: rating }),
    });
    setBooks(prev => prev.map(b => b.id === id ? { ...b, star_rating: rating } : b));
    if (selectedBook?.id === id) setSelectedBook(prev => prev ? { ...prev, star_rating: rating } : prev);
  }

  async function deleteBook(id: number) {
    await fetch('/api/books', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setBooks(prev => prev.filter(b => b.id !== id));
    setSelectedBook(null);
    setWlSelected(null);
  }

  async function openDiscover(tab: 'discover' | 'wishlist' = 'discover') {
    setShowDiscover(true);
    setDiscoverTab(tab);
    setDiscoverSelected(null);
    setDiscoverReadView(false);
    setWlSelected(null);
    setWlReadView(false);
    if (tab === 'discover' && discoverBooks.length === 0) loadDiscoverBooks();
  }

  async function loadDiscoverBooks() {
    if (books.length === 0) { setDiscoverBooks([]); return; }
    setDiscoverLoading(true);
    try {
      const sorted = [...books].sort((a, b) => b.star_rating - a.star_rating);
      const seenAuthors = new Set<string>();
      const topAuthors: string[] = [];
      for (const b of sorted) {
        if (b.author && !seenAuthors.has(b.author.toLowerCase()) && topAuthors.length < 3) {
          seenAuthors.add(b.author.toLowerCase()); topAuthors.push(b.author);
        }
      }
      const allKeys = new Set(books.map(b => b.ol_key).filter(Boolean));
      const allTitles = new Set(books.map(b => b.title.toLowerCase()));
      const results = await Promise.all(
        topAuthors.map(author =>
          fetch(`https://openlibrary.org/search.json?author=${encodeURIComponent(author)}&fields=key,title,author_name,cover_i,isbn,first_publish_year&limit=10`)
            .then(r => r.json()).then(d => (d.docs || []) as OLDoc[]).catch(() => [] as OLDoc[])
        )
      );
      const seen = new Set<string>();
      const suggestions: OLDoc[] = [];
      for (const batch of results) {
        for (const doc of batch) {
          if (!doc.title || allKeys.has(doc.key) || allTitles.has(doc.title.toLowerCase()) || seen.has(doc.key)) continue;
          seen.add(doc.key); suggestions.push(doc);
        }
      }
      for (let i = suggestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [suggestions[i], suggestions[j]] = [suggestions[j], suggestions[i]];
      }
      setDiscoverBooks(suggestions.slice(0, 20));
    } catch { setDiscoverBooks([]); }
    setDiscoverLoading(false);
  }

  function closeAdd() {
    setShowAdd(false); setAddQuery(''); setAddResults([]); setAddPending(null); setAddRating(3);
  }

  function closeDiscover() {
    setShowDiscover(false);
    setDiscoverSelected(null); setDiscoverReadView(false);
    setWlSelected(null); setWlReadView(false);
    setDQuery(''); setDResults([]);
  }

  function openDiscoverDetail(doc: OLDoc) {
    setDiscoverSelected(doc);
    setDiscoverReadView(false);
    setDiscoverAddRating(3);
  }

  // ── Render ──

  const bookCoverStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  return (
    <>
      <div className="px-4 md:px-8 py-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#afc6ff' }}>Reading Shelf</p>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>Book Club</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => openDiscover('wishlist')}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', color: '#ffd700' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,215,0,0.15)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,215,0,0.08)'; }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bookmark</span>
              Wishlist{wishlistBooks.length > 0 ? ` (${wishlistBooks.length})` : ''}
            </button>
            <button onClick={() => openDiscover('discover')}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(175,198,255,0.08)', border: '1px solid rgba(175,198,255,0.2)', color: '#afc6ff' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.15)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.08)'; }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>explore</span>
              Discover
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e4e1e9' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
              Add Book
            </button>
          </div>
        </div>

        {/* Book grid */}
        {loading ? (
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : readBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="material-symbols-outlined mb-4" style={{ color: '#2e3140', fontSize: '56px' }}>menu_book</span>
            <p className="text-lg font-bold mb-2" style={{ color: '#414655' }}>No books yet</p>
            <p className="text-sm mb-6" style={{ color: '#2e3140' }}>Add books you&apos;ve read or explore recommendations</p>
            <button onClick={() => setShowAdd(true)}
              className="px-6 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: 'rgba(175,198,255,0.1)', border: '1px solid rgba(175,198,255,0.25)', color: '#afc6ff' }}>
              Add your first book
            </button>
          </div>
        ) : (
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
            {readBooks.map(book => (
              <button key={book.id}
                onClick={() => { setSelectedBook(book); setEditRating(book.star_rating); }}
                className="flex flex-col gap-2 text-left group">
                <div className="w-full rounded-2xl overflow-hidden"
                  style={{ ...bookCoverStyle, aspectRatio: '2/3', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.4)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                  <CoverBox coverId={book.cover_id} title={book.title} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-snug truncate" style={{ color: '#c1c6d8' }}>{book.title}</p>
                  {book.author && <p className="text-[11px] mt-0.5 truncate" style={{ color: '#414655' }}>{book.author}</p>}
                  {book.star_rating > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: '10px', color: n <= book.star_rating ? '#ffd700' : 'rgba(255,255,255,0.12)' }}>★</span>)}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Read Book Detail ── */}
      {selectedBook && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSelectedBook(null)}>
          <div className="w-full max-w-sm rounded-t-3xl md:rounded-3xl p-6 flex flex-col gap-4 animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex gap-4">
              <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ ...bookCoverStyle, width: 72, height: 108 }}>
                <CoverBox coverId={selectedBook.cover_id} title={selectedBook.title} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-base leading-snug mb-1" style={{ color: '#e4e1e9', fontFamily: 'var(--font-jakarta)' }}>{selectedBook.title}</h3>
                {selectedBook.author && <p className="text-sm" style={{ color: '#8c90a1' }}>{selectedBook.author}</p>}
                <div className="mt-2">
                  <Stars value={editRating} onChange={r => { setEditRating(r); updateRating(selectedBook.id, r); }} />
                </div>
              </div>
            </div>
            {selectedBook.ol_key && <BookDescription olKey={selectedBook.ol_key} />}
            <BuyLinks title={selectedBook.title} author={selectedBook.author} />
            <div className="flex gap-3">
              <button onClick={() => setSelectedBook(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Close</button>
              <button onClick={() => deleteBook(selectedBook.id)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,180,171,0.08)', border: '1px solid rgba(255,180,171,0.2)', color: '#ffb4ab' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Book Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={closeAdd}>
          <div className="w-full max-w-md rounded-t-3xl md:rounded-3xl flex flex-col animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
              <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>Add a Book</h3>
              <button onClick={closeAdd} style={{ color: '#8c90a1' }}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="px-6 pb-4 flex-shrink-0">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#414655' }}>search</span>
                <input type="text" autoFocus value={addQuery}
                  onChange={e => { setAddQuery(e.target.value); setAddPending(null); }}
                  placeholder="Search by title, author or ISBN..."
                  className="flex-1 bg-transparent outline-none text-sm" style={{ color: '#e4e1e9' }} />
                {addSearching && <span className="material-symbols-outlined animate-spin flex-shrink-0" style={{ fontSize: '18px', color: '#414655' }}>progress_activity</span>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
              {addPending ? (
                <div>
                  <button onClick={() => setAddPending(null)} className="flex items-center gap-1 text-xs mb-4" style={{ color: '#8c90a1' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                    Back to results
                  </button>
                  <div className="flex gap-4 mb-4">
                    <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ ...bookCoverStyle, width: 72, height: 108 }}>
                      <OLCoverBox doc={addPending} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm leading-snug mb-1" style={{ color: '#e4e1e9' }}>{addPending.title}</h4>
                      {addPending.author_name?.[0] && <p className="text-xs" style={{ color: '#8c90a1' }}>{addPending.author_name[0]}</p>}
                      {addPending.first_publish_year && <p className="text-xs mt-0.5" style={{ color: '#414655' }}>{addPending.first_publish_year}</p>}
                    </div>
                  </div>
                  {addPending.key && <div className="mb-4"><BookDescription olKey={addPending.key} /></div>}
                  <div className="mb-5">
                    <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#8c90a1' }}>Your rating</p>
                    <Stars value={addRating} onChange={setAddRating} />
                  </div>
                  <button onClick={() => addReadBook(addPending, addRating)} disabled={addingBook}
                    className="w-full py-3 rounded-xl font-bold text-sm"
                    style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 15px rgba(175,198,255,0.3)' }}>
                    {addingBook ? 'Adding...' : 'Add to Library'}
                  </button>
                </div>
              ) : addResults.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {addResults.map(doc => {
                    const status = docStatus(doc);
                    return (
                      <button key={doc.key}
                        onClick={() => { if (!status) { setAddPending(doc); setAddRating(3); } }}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl text-left w-full transition-all"
                        style={{ background: status ? 'rgba(175,198,255,0.04)' : 'rgba(255,255,255,0.04)', border: `1px solid ${status ? 'rgba(175,198,255,0.15)' : 'rgba(255,255,255,0.08)'}`, opacity: status ? 0.65 : 1, cursor: status ? 'default' : 'pointer' }}>
                        <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ ...bookCoverStyle, width: 44, height: 64 }}>
                          <OLCoverBox doc={doc} size="S" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-snug" style={{ color: '#e4e1e9' }}>{doc.title}</p>
                          {doc.author_name?.[0] && <p className="text-xs mt-0.5" style={{ color: '#8c90a1' }}>{doc.author_name[0]}</p>}
                        </div>
                        {status === 'read' && <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#afc6ff' }}>check_circle</span>}
                        {status === 'wishlist' && <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#ffd700', fontVariationSettings: "'FILL' 1" }}>bookmark</span>}
                        {!status && <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#414655' }}>chevron_right</span>}
                      </button>
                    );
                  })}
                </div>
              ) : addQuery && !addSearching ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <span className="material-symbols-outlined mb-2" style={{ color: '#414655', fontSize: '32px' }}>search_off</span>
                  <p className="text-sm" style={{ color: '#414655' }}>No results for &quot;{addQuery}&quot;</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <span className="material-symbols-outlined mb-2" style={{ color: '#2e3140', fontSize: '32px' }}>auto_stories</span>
                  <p className="text-sm" style={{ color: '#414655' }}>Search millions of books</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Discover / Wishlist Modal ── */}
      {showDiscover && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={closeDiscover}>
          <div className="w-full max-w-lg rounded-t-3xl md:rounded-3xl flex flex-col animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}>

            <div className="px-6 pt-6 pb-0 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>
                  {discoverTab === 'discover' ? 'Discover' : 'Wishlist'}
                </h3>
                <button onClick={closeDiscover} style={{ color: '#8c90a1' }}><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {(['discover', 'wishlist'] as const).map(tab => (
                  <button key={tab}
                    onClick={() => { setDiscoverTab(tab); if (tab === 'discover' && discoverBooks.length === 0) loadDiscoverBooks(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all"
                    style={discoverTab === tab
                      ? { background: tab === 'wishlist' ? 'rgba(255,215,0,0.15)' : 'rgba(175,198,255,0.15)', color: tab === 'wishlist' ? '#ffd700' : '#afc6ff', border: `1px solid ${tab === 'wishlist' ? 'rgba(255,215,0,0.3)' : 'rgba(175,198,255,0.3)'}` }
                      : { color: '#8c90a1', border: '1px solid transparent' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{tab === 'discover' ? 'explore' : 'bookmark'}</span>
                    {tab === 'discover' ? 'Discover' : `Wishlist${wishlistBooks.length > 0 ? ` (${wishlistBooks.length})` : ''}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">

              {/* ── DISCOVER TAB ── */}
              {discoverTab === 'discover' && (
                <div className="flex flex-col gap-4">
                  {/* Search */}
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#414655' }}>search</span>
                    <input type="text" value={dQuery} onChange={e => setDQuery(e.target.value)}
                      placeholder="Search for a book..."
                      className="flex-1 bg-transparent outline-none text-sm" style={{ color: '#e4e1e9' }} />
                    {dSearching
                      ? <span className="material-symbols-outlined animate-spin flex-shrink-0" style={{ fontSize: '18px', color: '#414655' }}>progress_activity</span>
                      : dQuery ? <button onClick={() => setDQuery('')} style={{ color: '#414655' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span></button> : null}
                  </div>

                  {/* Search results */}
                  {dQuery ? (
                    dResults.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {dResults.map(doc => {
                          const status = docStatus(doc);
                          return (
                            <button key={doc.key}
                              onClick={() => openDiscoverDetail(doc)}
                              className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all relative"
                              style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${status === 'read' ? 'rgba(175,198,255,0.3)' : status === 'wishlist' ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.06)'}` }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}>
                              {status === 'read' && <span className="absolute top-1 right-1 z-10 material-symbols-outlined" style={{ fontSize: '14px', color: '#afc6ff' }}>check_circle</span>}
                              {status === 'wishlist' && <span className="absolute top-1 right-1 z-10 material-symbols-outlined" style={{ fontSize: '14px', color: '#ffd700', fontVariationSettings: "'FILL' 1" }}>bookmark</span>}
                              <div className="w-full rounded-xl overflow-hidden" style={{ ...bookCoverStyle, aspectRatio: '2/3' }}>
                                <OLCoverBox doc={doc} />
                              </div>
                              <p className="text-[11px] leading-tight text-center w-full font-medium" style={{ color: '#c1c6d8', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{doc.title}</p>
                              {doc.author_name?.[0] && <p className="text-[10px] leading-tight text-center w-full" style={{ color: '#414655', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{doc.author_name[0]}</p>}
                            </button>
                          );
                        })}
                      </div>
                    ) : !dSearching ? (
                      <p className="text-sm text-center py-6" style={{ color: '#414655' }}>No results for &quot;{dQuery}&quot;</p>
                    ) : null
                  ) : (
                    /* Recommendations */
                    discoverLoading ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <span className="material-symbols-outlined animate-spin mb-3" style={{ color: '#afc6ff', fontSize: '32px' }}>progress_activity</span>
                        <p className="text-sm" style={{ color: '#8c90a1' }}>Finding books you&apos;ll love...</p>
                      </div>
                    ) : discoverBooks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <span className="material-symbols-outlined mb-3" style={{ color: '#414655', fontSize: '36px' }}>explore</span>
                        <p className="text-sm font-medium mb-1" style={{ color: '#8c90a1' }}>Nothing to show yet</p>
                        <p className="text-xs" style={{ color: '#414655' }}>Add some books you&apos;ve read to get recommendations</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {discoverBooks.map(doc => {
                          const status = docStatus(doc);
                          return (
                            <button key={doc.key}
                              onClick={() => openDiscoverDetail(doc)}
                              className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all relative"
                              style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${status === 'read' ? 'rgba(175,198,255,0.3)' : status === 'wishlist' ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.06)'}` }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}>
                              {status === 'read' && <span className="absolute top-1 right-1 z-10 material-symbols-outlined" style={{ fontSize: '14px', color: '#afc6ff' }}>check_circle</span>}
                              {status === 'wishlist' && <span className="absolute top-1 right-1 z-10 material-symbols-outlined" style={{ fontSize: '14px', color: '#ffd700', fontVariationSettings: "'FILL' 1" }}>bookmark</span>}
                              <div className="w-full rounded-xl overflow-hidden" style={{ ...bookCoverStyle, aspectRatio: '2/3' }}>
                                <OLCoverBox doc={doc} />
                              </div>
                              <p className="text-[11px] leading-tight text-center w-full font-medium" style={{ color: '#c1c6d8', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{doc.title}</p>
                              {doc.author_name?.[0] && <p className="text-[10px] leading-tight text-center w-full" style={{ color: '#414655', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{doc.author_name[0]}</p>}
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* ── WISHLIST TAB ── */}
              {discoverTab === 'wishlist' && (
                <div className="flex flex-col gap-3">
                  {wishlistBooks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <span className="material-symbols-outlined mb-3" style={{ color: '#414655', fontSize: '36px' }}>bookmark</span>
                      <p className="text-sm font-medium mb-1" style={{ color: '#8c90a1' }}>Your wishlist is empty</p>
                      <p className="text-xs" style={{ color: '#414655' }}>Search or browse in the Discover tab to save books</p>
                    </div>
                  ) : wishlistBooks.map(book => (
                    <button key={book.id}
                      onClick={() => { setWlSelected(book); setMarkReadRating(3); setWlReadView(false); }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left w-full transition-all"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}>
                      <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ ...bookCoverStyle, width: 40, height: 58 }}>
                        <CoverBox coverId={book.cover_id} title={book.title} size="S" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-snug" style={{ color: '#e4e1e9' }}>{book.title}</p>
                        {book.author && <p className="text-xs mt-0.5" style={{ color: '#8c90a1' }}>{book.author}</p>}
                      </div>
                      <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#414655' }}>chevron_right</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Discover Book Detail ── */}
      {discoverSelected && (
        <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => { setDiscoverSelected(null); setDiscoverReadView(false); }}>
          <div className="w-full max-w-sm rounded-t-3xl md:rounded-3xl p-6 flex flex-col gap-4 animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>

            {discoverReadView ? (
              /* ── Rate & confirm view ── */
              <>
                <button onClick={() => setDiscoverReadView(false)}
                  className="flex items-center gap-1 text-xs self-start" style={{ color: '#8c90a1' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                  Back
                </button>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ ...bookCoverStyle, width: 72, height: 108 }}>
                    <OLCoverBox doc={discoverSelected} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-base leading-snug mb-1" style={{ color: '#e4e1e9', fontFamily: 'var(--font-jakarta)' }}>{discoverSelected.title}</h3>
                    {discoverSelected.author_name?.[0] && <p className="text-sm" style={{ color: '#8c90a1' }}>{discoverSelected.author_name[0]}</p>}
                    {discoverSelected.first_publish_year && <p className="text-xs mt-0.5" style={{ color: '#414655' }}>First published {discoverSelected.first_publish_year}</p>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#8c90a1' }}>Rate it</p>
                  <Stars value={discoverAddRating} onChange={setDiscoverAddRating} />
                </div>
                <button onClick={() => addDiscoverAsRead(discoverSelected, discoverAddRating)} disabled={discoverAdding}
                  className="w-full py-3 rounded-xl font-bold text-sm"
                  style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 15px rgba(175,198,255,0.3)' }}>
                  {discoverAdding ? 'Adding...' : 'Add to Library'}
                </button>
                <button onClick={() => { setDiscoverSelected(null); setDiscoverReadView(false); }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Cancel</button>
              </>
            ) : (
              /* ── Detail view ── */
              <>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ ...bookCoverStyle, width: 80, height: 120 }}>
                    <OLCoverBox doc={discoverSelected} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-base leading-snug mb-1" style={{ color: '#e4e1e9', fontFamily: 'var(--font-jakarta)' }}>{discoverSelected.title}</h3>
                    {discoverSelected.author_name?.[0] && <p className="text-sm" style={{ color: '#8c90a1' }}>{discoverSelected.author_name[0]}</p>}
                    {discoverSelected.first_publish_year && <p className="text-xs mt-0.5" style={{ color: '#414655' }}>First published {discoverSelected.first_publish_year}</p>}
                  </div>
                </div>

                <BookDescription olKey={discoverSelected.key} />
                <BuyLinks title={discoverSelected.title} author={discoverSelected.author_name?.[0] || ''} />

                {docStatus(discoverSelected) === 'read' ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(175,198,255,0.08)', border: '1px solid rgba(175,198,255,0.2)' }}>
                    <span className="material-symbols-outlined" style={{ color: '#afc6ff', fontSize: '18px' }}>check_circle</span>
                    <span className="text-sm font-semibold" style={{ color: '#afc6ff' }}>Already in your library</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {docStatus(discoverSelected) === 'wishlist' ? (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
                        <span className="material-symbols-outlined" style={{ color: '#ffd700', fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>bookmark</span>
                        <span className="text-sm font-semibold" style={{ color: '#ffd700' }}>In your wishlist</span>
                      </div>
                    ) : (
                      <button onClick={() => { saveToWishlist(discoverSelected); setDiscoverSelected(null); }}
                        disabled={savingWl === discoverSelected.key}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                        style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)', color: '#ffd700' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bookmark_add</span>
                        Save to Wishlist
                      </button>
                    )}
                    <button onClick={() => setDiscoverReadView(true)}
                      className="w-full py-3 rounded-xl font-bold text-sm"
                      style={{ background: 'rgba(175,198,255,0.12)', border: '1px solid rgba(175,198,255,0.3)', color: '#afc6ff' }}>
                      I&apos;ve Read This
                    </button>
                  </div>
                )}
                <button onClick={() => setDiscoverSelected(null)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Close</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Wishlist Book Detail ── */}
      {wlSelected && (
        <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => { setWlSelected(null); setWlReadView(false); }}>
          <div className="w-full max-w-sm rounded-t-3xl md:rounded-3xl p-6 flex flex-col gap-4 animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>

            {wlReadView ? (
              /* ── Mark as read / rate view ── */
              <>
                <button onClick={() => setWlReadView(false)}
                  className="flex items-center gap-1 text-xs self-start" style={{ color: '#8c90a1' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                  Back
                </button>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ ...bookCoverStyle, width: 72, height: 108 }}>
                    <CoverBox coverId={wlSelected.cover_id} title={wlSelected.title} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-base leading-snug mb-1" style={{ color: '#e4e1e9', fontFamily: 'var(--font-jakarta)' }}>{wlSelected.title}</h3>
                    {wlSelected.author && <p className="text-sm" style={{ color: '#8c90a1' }}>{wlSelected.author}</p>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#8c90a1' }}>Rate it</p>
                  <Stars value={markReadRating} onChange={setMarkReadRating} />
                </div>
                <button onClick={() => markAsRead(wlSelected, markReadRating)} disabled={markingRead}
                  className="w-full py-3 rounded-xl font-bold text-sm"
                  style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 15px rgba(175,198,255,0.3)' }}>
                  {markingRead ? 'Moving...' : 'Add to Library'}
                </button>
                <button onClick={() => { setWlSelected(null); setWlReadView(false); }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Cancel</button>
              </>
            ) : (
              /* ── Wishlist detail view ── */
              <>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ ...bookCoverStyle, width: 80, height: 120 }}>
                    <CoverBox coverId={wlSelected.cover_id} title={wlSelected.title} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-base leading-snug mb-1" style={{ color: '#e4e1e9', fontFamily: 'var(--font-jakarta)' }}>{wlSelected.title}</h3>
                    {wlSelected.author && <p className="text-sm" style={{ color: '#8c90a1' }}>{wlSelected.author}</p>}
                    <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg w-fit" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
                      <span className="material-symbols-outlined" style={{ color: '#ffd700', fontSize: '13px', fontVariationSettings: "'FILL' 1" }}>bookmark</span>
                      <span className="text-xs font-bold" style={{ color: '#ffd700' }}>Wishlist</span>
                    </div>
                  </div>
                </div>
                {wlSelected.ol_key && <BookDescription olKey={wlSelected.ol_key} />}
                <BuyLinks title={wlSelected.title} author={wlSelected.author} />
                <button onClick={() => setWlReadView(true)}
                  className="w-full py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'rgba(175,198,255,0.12)', border: '1px solid rgba(175,198,255,0.3)', color: '#afc6ff' }}>
                  I&apos;ve Read This
                </button>
                <div className="flex gap-3">
                  <button onClick={() => { setWlSelected(null); setWlReadView(false); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Close</button>
                  <button onClick={() => deleteBook(wlSelected.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(255,180,171,0.08)', border: '1px solid rgba(255,180,171,0.2)', color: '#ffb4ab' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                    Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
