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
  status: string; // 'read' | 'wishlist'
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

function BookCover({ book, onClick }: { book: Book; onClick: () => void }) {
  const src = coverUrl(book.cover_id);
  return (
    <button onClick={onClick}
      className="flex-shrink-0 relative group rounded-xl overflow-hidden snap-start"
      style={{ width: 90, height: 135, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {src ? (
        <img src={src} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
          <span className="material-symbols-outlined mb-1" style={{ color: '#414655', fontSize: '24px' }}>menu_book</span>
          <span className="text-[9px] leading-tight" style={{ color: '#414655' }}>{book.title}</span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}>
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map(n => (
            <span key={n} className="text-[10px] leading-none" style={{ color: n <= book.star_rating ? '#ffd700' : 'rgba(255,255,255,0.2)' }}>★</span>
          ))}
        </div>
      </div>
    </button>
  );
}

function OLCover({ doc, size = 90, height = 135 }: { doc: OLDoc; size?: number; height?: number }) {
  return (
    <div className="rounded-xl overflow-hidden flex-shrink-0"
      style={{ width: size, height, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {coverUrl(doc.cover_i) ? (
        <img src={coverUrl(doc.cover_i)} alt={doc.title} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="material-symbols-outlined" style={{ color: '#414655', fontSize: '24px' }}>menu_book</span>
        </div>
      )}
    </div>
  );
}

function SavedCover({ book, size = 90, height = 135 }: { book: Book; size?: number; height?: number }) {
  return (
    <div className="rounded-xl overflow-hidden flex-shrink-0"
      style={{ width: size, height, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {book.cover_id ? (
        <img src={coverUrl(book.cover_id)} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="material-symbols-outlined" style={{ color: '#414655', fontSize: '24px' }}>menu_book</span>
        </div>
      )}
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

function olSearch(q: string): string {
  const isIsbn = /^[\d\-]{10,17}$/.test(q.replace(/\s/g, ''));
  return isIsbn
    ? `https://openlibrary.org/search.json?isbn=${encodeURIComponent(q.replace(/[-\s]/g, ''))}&fields=key,title,author_name,cover_i,isbn,first_publish_year&limit=5`
    : `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=key,title,author_name,cover_i,isbn,first_publish_year&limit=8`;
}

export default function BookClub() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  // Add book modal (read)
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

  // Discover tab
  const [discoverBooks, setDiscoverBooks] = useState<OLDoc[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverSelected, setDiscoverSelected] = useState<OLDoc | null>(null);
  const [discoverAddRating, setDiscoverAddRating] = useState(3);
  const [discoverAdding, setDiscoverAdding] = useState(false);

  // Wishlist tab
  const [wlQuery, setWlQuery] = useState('');
  const [wlResults, setWlResults] = useState<OLDoc[]>([]);
  const [wlSearching, setWlSearching] = useState(false);
  const [savingWl, setSavingWl] = useState<string | null>(null); // ol_key being saved
  const [wlSelected, setWlSelected] = useState<Book | null>(null); // existing wishlist book detail
  const [markReadRating, setMarkReadRating] = useState(3);
  const [markingRead, setMarkingRead] = useState(false);
  const wlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBooks = useCallback(async () => {
    const res = await fetch('/api/books');
    if (res.ok) {
      const d = await res.json();
      setBooks(d.books || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  // Add Book search debounce
  useEffect(() => {
    if (addTimer.current) clearTimeout(addTimer.current);
    const q = addQuery.trim();
    if (!q) { setAddResults([]); return; }
    addTimer.current = setTimeout(async () => {
      setAddSearching(true);
      try {
        const res = await fetch(olSearch(q));
        const data = await res.json();
        setAddResults((data.docs || []).filter((d: OLDoc) => d.title));
      } catch { setAddResults([]); }
      setAddSearching(false);
    }, 400);
    return () => { if (addTimer.current) clearTimeout(addTimer.current); };
  }, [addQuery]);

  // Wishlist tab search debounce
  useEffect(() => {
    if (wlTimer.current) clearTimeout(wlTimer.current);
    const q = wlQuery.trim();
    if (!q) { setWlResults([]); return; }
    wlTimer.current = setTimeout(async () => {
      setWlSearching(true);
      try {
        const res = await fetch(olSearch(q));
        const data = await res.json();
        setWlResults((data.docs || []).filter((d: OLDoc) => d.title));
      } catch { setWlResults([]); }
      setWlSearching(false);
    }, 400);
    return () => { if (wlTimer.current) clearTimeout(wlTimer.current); };
  }, [wlQuery]);

  const readBooks = books.filter(b => b.status === 'read');
  const wishlistBooks = books.filter(b => b.status === 'wishlist');

  const isInReadLib = (doc: OLDoc) =>
    readBooks.some(b => (b.ol_key && b.ol_key === doc.key) || b.title.toLowerCase() === doc.title.toLowerCase());
  const isInWishlist = (doc: OLDoc) =>
    wishlistBooks.some(b => (b.ol_key && b.ol_key === doc.key) || b.title.toLowerCase() === doc.title.toLowerCase());

  async function postBook(doc: OLDoc, status: 'read' | 'wishlist', rating: number) {
    return fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ol_key: doc.key,
        title: doc.title,
        author: doc.author_name?.[0] || '',
        cover_id: doc.cover_i ? String(doc.cover_i) : '',
        isbn: doc.isbn?.[0] || '',
        star_rating: rating,
        status,
      }),
    });
  }

  async function addReadBook(doc: OLDoc, rating: number) {
    setAddingBook(true);
    const res = await postBook(doc, 'read', rating);
    if (res.ok) await fetchBooks();
    setAddingBook(false);
    closeAdd();
  }

  async function saveToWishlist(doc: OLDoc) {
    setSavingWl(doc.key);
    const res = await postBook(doc, 'wishlist', 0);
    if (res.ok) await fetchBooks();
    setSavingWl(null);
  }

  async function addDiscoverAsRead(doc: OLDoc, rating: number) {
    setDiscoverAdding(true);
    const res = await postBook(doc, 'read', rating);
    if (res.ok) await fetchBooks();
    setDiscoverAdding(false);
    setDiscoverSelected(null);
  }

  async function markAsRead(book: Book, rating: number) {
    setMarkingRead(true);
    await fetch('/api/books', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: book.id, status: 'read', star_rating: rating }),
    });
    await fetchBooks();
    setMarkingRead(false);
    setWlSelected(null);
  }

  async function updateRating(id: number, rating: number) {
    await fetch('/api/books', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, star_rating: rating }) });
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
    setWlSelected(null);
    if (tab === 'discover' && discoverBooks.length === 0) {
      loadDiscoverBooks();
    }
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
          seenAuthors.add(b.author.toLowerCase());
          topAuthors.push(b.author);
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
          seen.add(doc.key);
          suggestions.push(doc);
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
    setShowAdd(false);
    setAddQuery('');
    setAddResults([]);
    setAddPending(null);
    setAddRating(3);
  }

  function closeDiscover() {
    setShowDiscover(false);
    setDiscoverSelected(null);
    setWlSelected(null);
    setWlQuery('');
    setWlResults([]);
  }

  if (loading) return null;

  return (
    <>
      {/* ── Book Club Section ── */}
      <div className="mt-6">
        <div className="glass-card p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: '#8c90a1' }}>Book Club</h3>
            <div className="flex gap-2">
              <button onClick={() => openDiscover('wishlist')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', color: '#ffd700' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,215,0,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,215,0,0.08)'; }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>bookmark</span>
                <span className="hidden sm:inline">Wishlist{wishlistBooks.length > 0 ? ` (${wishlistBooks.length})` : ''}</span>
              </button>
              <button onClick={() => openDiscover('discover')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(175,198,255,0.08)', border: '1px solid rgba(175,198,255,0.2)', color: '#afc6ff' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.08)'; }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>explore</span>
                <span className="hidden sm:inline">Discover</span>
              </button>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#c1c6d8' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                <span className="hidden sm:inline">Add Book</span>
              </button>
            </div>
          </div>

          {readBooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="material-symbols-outlined mb-2" style={{ color: '#414655', fontSize: '36px' }}>menu_book</span>
              <p className="text-sm font-medium" style={{ color: '#414655' }}>No books read yet</p>
              <p className="text-xs mt-1" style={{ color: '#2e3140' }}>Add books you&apos;ve read and discover new ones</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {readBooks.map(book => (
                <BookCover key={book.id} book={book} onClick={() => { setSelectedBook(book); setEditRating(book.star_rating); }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Read Book Detail ── */}
      {selectedBook && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSelectedBook(null)}>
          <div className="w-full max-w-sm rounded-t-3xl md:rounded-3xl p-6 flex flex-col gap-5 animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex gap-4">
              <SavedCover book={selectedBook} size={72} height={108} />
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-base leading-snug mb-1" style={{ color: '#e4e1e9', fontFamily: 'var(--font-jakarta)' }}>{selectedBook.title}</h3>
                {selectedBook.author && <p className="text-sm" style={{ color: '#8c90a1' }}>{selectedBook.author}</p>}
                <div className="mt-2">
                  <Stars value={editRating} onChange={r => { setEditRating(r); updateRating(selectedBook.id, r); }} />
                </div>
              </div>
            </div>
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

      {/* ── Add Book Modal (read) ── */}
      {showAdd && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={closeAdd}>
          <div className="w-full max-w-md rounded-t-3xl md:rounded-3xl flex flex-col animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
              <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>Add a Book</h3>
              <button onClick={closeAdd} style={{ color: '#8c90a1' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
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
                  <div className="flex gap-4 mb-5">
                    <OLCover doc={addPending} size={72} height={108} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm leading-snug mb-1" style={{ color: '#e4e1e9' }}>{addPending.title}</h4>
                      {addPending.author_name?.[0] && <p className="text-xs" style={{ color: '#8c90a1' }}>{addPending.author_name[0]}</p>}
                      {addPending.first_publish_year && <p className="text-xs mt-0.5" style={{ color: '#414655' }}>{addPending.first_publish_year}</p>}
                    </div>
                  </div>
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
                    const inLib = isInReadLib(doc);
                    return (
                      <button key={doc.key}
                        onClick={() => { if (!inLib) { setAddPending(doc); setAddRating(3); } }}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all w-full"
                        style={{ background: inLib ? 'rgba(175,198,255,0.05)' : 'rgba(255,255,255,0.04)', border: `1px solid ${inLib ? 'rgba(175,198,255,0.2)' : 'rgba(255,255,255,0.08)'}`, opacity: inLib ? 0.6 : 1, cursor: inLib ? 'default' : 'pointer' }}>
                        <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 44, height: 64, background: 'rgba(255,255,255,0.04)' }}>
                          {doc.cover_i ? <img src={coverUrl(doc.cover_i, 'S')} alt={doc.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined" style={{ color: '#414655', fontSize: '20px' }}>menu_book</span></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-snug" style={{ color: '#e4e1e9' }}>{doc.title}</p>
                          {doc.author_name?.[0] && <p className="text-xs mt-0.5" style={{ color: '#8c90a1' }}>{doc.author_name[0]}</p>}
                        </div>
                        {inLib
                          ? <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#afc6ff' }}>check_circle</span>
                          : <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#414655' }}>chevron_right</span>}
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

            {/* Header + tabs */}
            <div className="px-6 pt-6 pb-0 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>
                  {discoverTab === 'discover' ? 'Discover Books' : 'Wishlist'}
                </h3>
                <button onClick={closeDiscover} style={{ color: '#8c90a1' }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              {/* Tab switcher */}
              <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {(['discover', 'wishlist'] as const).map(tab => (
                  <button key={tab}
                    onClick={() => {
                      setDiscoverTab(tab);
                      if (tab === 'discover' && discoverBooks.length === 0) loadDiscoverBooks();
                    }}
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

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">

              {/* ── DISCOVER TAB ── */}
              {discoverTab === 'discover' && (
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
                      const inRead = isInReadLib(doc);
                      const inWl = isInWishlist(doc);
                      return (
                        <button key={doc.key}
                          onClick={() => { setDiscoverSelected(doc); setDiscoverAddRating(3); }}
                          className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all relative"
                          style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${inRead ? 'rgba(175,198,255,0.3)' : inWl ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.06)'}` }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}>
                          {inRead && <span className="absolute top-1 right-1 z-10 material-symbols-outlined" style={{ fontSize: '14px', color: '#afc6ff' }}>check_circle</span>}
                          {!inRead && inWl && <span className="absolute top-1 right-1 z-10 material-symbols-outlined" style={{ fontSize: '14px', color: '#ffd700', fontVariationSettings: "'FILL' 1" }}>bookmark</span>}
                          <OLCover doc={doc} size={70} height={105} />
                          <p className="text-[11px] leading-tight text-center w-full font-medium" style={{ color: '#c1c6d8', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{doc.title}</p>
                          {doc.author_name?.[0] && <p className="text-[10px] leading-tight text-center w-full" style={{ color: '#414655', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{doc.author_name[0]}</p>}
                        </button>
                      );
                    })}
                  </div>
                )
              )}

              {/* ── WISHLIST TAB ── */}
              {discoverTab === 'wishlist' && (
                <div className="flex flex-col gap-4">
                  {/* Search */}
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#414655' }}>search</span>
                    <input type="text" value={wlQuery} onChange={e => setWlQuery(e.target.value)}
                      placeholder="Search books to add to wishlist..."
                      className="flex-1 bg-transparent outline-none text-sm" style={{ color: '#e4e1e9' }} />
                    {wlSearching
                      ? <span className="material-symbols-outlined animate-spin flex-shrink-0" style={{ fontSize: '18px', color: '#414655' }}>progress_activity</span>
                      : wlQuery && <button onClick={() => setWlQuery('')} style={{ color: '#414655' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span></button>}
                  </div>

                  {/* Search results */}
                  {wlResults.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {wlResults.map(doc => {
                        const inRead = isInReadLib(doc);
                        const inWl = isInWishlist(doc);
                        const saving = savingWl === doc.key;
                        return (
                          <div key={doc.key}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 40, height: 58, background: 'rgba(255,255,255,0.04)' }}>
                              {doc.cover_i ? <img src={coverUrl(doc.cover_i, 'S')} alt={doc.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined" style={{ color: '#414655', fontSize: '18px' }}>menu_book</span></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold leading-snug" style={{ color: '#e4e1e9' }}>{doc.title}</p>
                              {doc.author_name?.[0] && <p className="text-xs mt-0.5" style={{ color: '#8c90a1' }}>{doc.author_name[0]}</p>}
                            </div>
                            {inRead ? (
                              <span className="flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(175,198,255,0.1)', color: '#afc6ff' }}>Read</span>
                            ) : inWl ? (
                              <span className="flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(255,215,0,0.1)', color: '#ffd700' }}>Saved</span>
                            ) : (
                              <button onClick={() => saveToWishlist(doc)} disabled={saving}
                                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)', color: '#ffd700' }}>
                                {saving ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '14px' }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bookmark_add</span>}
                                Save
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {wlQuery && !wlSearching && wlResults.length === 0 && (
                    <p className="text-sm text-center py-4" style={{ color: '#414655' }}>No results for &quot;{wlQuery}&quot;</p>
                  )}

                  {/* Saved wishlist */}
                  {wishlistBooks.length > 0 && (
                    <div>
                      {!wlQuery && <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#414655' }}>Saved ({wishlistBooks.length})</p>}
                      <div className="flex flex-col gap-2">
                        {wishlistBooks.map(book => (
                          <button key={book.id}
                            onClick={() => { setWlSelected(book); setMarkReadRating(3); }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left w-full transition-all"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}>
                            <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 40, height: 58, background: 'rgba(255,255,255,0.04)' }}>
                              {book.cover_id ? <img src={coverUrl(book.cover_id, 'S')} alt={book.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined" style={{ color: '#414655', fontSize: '18px' }}>menu_book</span></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold leading-snug" style={{ color: '#e4e1e9' }}>{book.title}</p>
                              {book.author && <p className="text-xs mt-0.5" style={{ color: '#8c90a1' }}>{book.author}</p>}
                            </div>
                            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#414655' }}>chevron_right</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {wishlistBooks.length === 0 && !wlQuery && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <span className="material-symbols-outlined mb-2" style={{ color: '#414655', fontSize: '36px' }}>bookmark</span>
                      <p className="text-sm" style={{ color: '#414655' }}>Your wishlist is empty</p>
                      <p className="text-xs mt-1" style={{ color: '#2e3140' }}>Search above or save books from Discover</p>
                    </div>
                  )}
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
          onClick={() => setDiscoverSelected(null)}>
          <div className="w-full max-w-sm rounded-t-3xl md:rounded-3xl p-6 flex flex-col gap-4 animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex gap-4">
              <OLCover doc={discoverSelected} size={80} height={120} />
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-base leading-snug mb-1" style={{ color: '#e4e1e9', fontFamily: 'var(--font-jakarta)' }}>{discoverSelected.title}</h3>
                {discoverSelected.author_name?.[0] && <p className="text-sm" style={{ color: '#8c90a1' }}>{discoverSelected.author_name[0]}</p>}
                {discoverSelected.first_publish_year && <p className="text-xs mt-0.5" style={{ color: '#414655' }}>First published {discoverSelected.first_publish_year}</p>}
              </div>
            </div>

            <BuyLinks title={discoverSelected.title} author={discoverSelected.author_name?.[0] || ''} />

            {isInReadLib(discoverSelected) ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(175,198,255,0.08)', border: '1px solid rgba(175,198,255,0.2)' }}>
                <span className="material-symbols-outlined" style={{ color: '#afc6ff', fontSize: '18px' }}>check_circle</span>
                <span className="text-sm font-semibold" style={{ color: '#afc6ff' }}>Already in your library</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {isInWishlist(discoverSelected) ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
                    <span className="material-symbols-outlined" style={{ color: '#ffd700', fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>bookmark</span>
                    <span className="text-sm font-semibold" style={{ color: '#ffd700' }}>In your wishlist</span>
                  </div>
                ) : (
                  <button onClick={() => { saveToWishlist(discoverSelected); setDiscoverSelected(null); }}
                    disabled={savingWl === discoverSelected.key}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
                    style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)', color: '#ffd700' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bookmark_add</span>
                    Save to Wishlist
                  </button>
                )}
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#8c90a1' }}>I&apos;ve read it — rate it</p>
                  <Stars value={discoverAddRating} onChange={setDiscoverAddRating} />
                  <button onClick={() => addDiscoverAsRead(discoverSelected, discoverAddRating)} disabled={discoverAdding}
                    className="w-full py-3 rounded-xl font-bold text-sm mt-3"
                    style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 15px rgba(175,198,255,0.3)' }}>
                    {discoverAdding ? 'Adding...' : "I've Read This"}
                  </button>
                </div>
              </div>
            )}
            <button onClick={() => setDiscoverSelected(null)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Close</button>
          </div>
        </div>
      )}

      {/* ── Wishlist Book Detail ── */}
      {wlSelected && (
        <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setWlSelected(null)}>
          <div className="w-full max-w-sm rounded-t-3xl md:rounded-3xl p-6 flex flex-col gap-4 animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex gap-4">
              <SavedCover book={wlSelected} size={80} height={120} />
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-base leading-snug mb-1" style={{ color: '#e4e1e9', fontFamily: 'var(--font-jakarta)' }}>{wlSelected.title}</h3>
                {wlSelected.author && <p className="text-sm" style={{ color: '#8c90a1' }}>{wlSelected.author}</p>}
                <div className="mt-2 flex items-center gap-2 px-2 py-1 rounded-lg w-fit" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
                  <span className="material-symbols-outlined" style={{ color: '#ffd700', fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>bookmark</span>
                  <span className="text-xs font-bold" style={{ color: '#ffd700' }}>Wishlist</span>
                </div>
              </div>
            </div>

            <BuyLinks title={wlSelected.title} author={wlSelected.author} />

            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#8c90a1' }}>Mark as read — rate it</p>
              <Stars value={markReadRating} onChange={setMarkReadRating} />
              <button onClick={() => markAsRead(wlSelected, markReadRating)} disabled={markingRead}
                className="w-full py-3 rounded-xl font-bold text-sm mt-3"
                style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 15px rgba(175,198,255,0.3)' }}>
                {markingRead ? 'Moving...' : 'Mark as Read'}
              </button>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setWlSelected(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Close</button>
              <button onClick={() => deleteBook(wlSelected.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,180,171,0.08)', border: '1px solid rgba(255,180,171,0.2)', color: '#ffb4ab' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
