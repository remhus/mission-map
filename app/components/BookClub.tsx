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
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          className="text-lg leading-none transition-colors"
          style={{ color: n <= (hover || value) ? '#ffd700' : 'rgba(255,255,255,0.15)', cursor: onChange ? 'pointer' : 'default', background: 'none', border: 'none', padding: '2px' }}>
          ★
        </button>
      ))}
    </div>
  );
}

function BookCover({ book, onClick }: { book: Book; onClick: () => void }) {
  const src = coverUrl(book.cover_id);
  return (
    <button
      onClick={onClick}
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
      {/* Star overlay */}
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
  const src = coverUrl(doc.cover_i);
  return (
    <div className="rounded-xl overflow-hidden flex-shrink-0"
      style={{ width: size, height, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {src ? (
        <img src={src} alt={doc.title} className="w-full h-full object-cover" loading="lazy" />
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
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(175,198,255,0.3)'; (e.currentTarget as HTMLElement).style.color = '#afc6ff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#c1c6d8'; }}>
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px' }}>{l.icon}</span>
          <span className="text-sm font-medium">{l.label}</span>
          <span className="material-symbols-outlined ml-auto flex-shrink-0" style={{ fontSize: '16px', color: '#414655' }}>open_in_new</span>
        </a>
      ))}
    </div>
  );
}

export default function BookClub() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  // Add book modal
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OLDoc[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pendingBook, setPendingBook] = useState<OLDoc | null>(null);
  const [pendingRating, setPendingRating] = useState(3);
  const [addingBook, setAddingBook] = useState(false);

  // Book detail modal (existing library)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editRating, setEditRating] = useState(0);

  // Discover modal
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverBooks, setDiscoverBooks] = useState<OLDoc[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverSelected, setDiscoverSelected] = useState<OLDoc | null>(null);
  const [discoverAddRating, setDiscoverAddRating] = useState(3);
  const [discoverAdding, setDiscoverAdding] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBooks = useCallback(async () => {
    const res = await fetch('/api/books');
    if (res.ok) {
      const d = await res.json();
      setBooks(d.books || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  // Debounced Open Library search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const isIsbn = /^[\d\-]{10,17}$/.test(q.replace(/\s/g, ''));
        const url = isIsbn
          ? `https://openlibrary.org/search.json?isbn=${encodeURIComponent(q.replace(/[-\s]/g, ''))}&fields=key,title,author_name,cover_i,isbn&limit=5`
          : `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=key,title,author_name,cover_i,isbn&limit=8`;
        const res = await fetch(url);
        const data = await res.json();
        setSearchResults((data.docs || []).filter((d: OLDoc) => d.title));
      } catch { setSearchResults([]); }
      setSearchLoading(false);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  async function addBook(doc: OLDoc, rating: number) {
    setAddingBook(true);
    const body = {
      ol_key: doc.key,
      title: doc.title,
      author: doc.author_name?.[0] || '',
      cover_id: doc.cover_i ? String(doc.cover_i) : '',
      isbn: doc.isbn?.[0] || '',
      star_rating: rating,
    };
    const res = await fetch('/api/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      await fetchBooks();
    }
    setAddingBook(false);
    setShowAdd(false);
    setSearchQuery('');
    setSearchResults([]);
    setPendingBook(null);
    setPendingRating(3);
  }

  async function addDiscoverBook(doc: OLDoc, rating: number) {
    setDiscoverAdding(true);
    const body = {
      ol_key: doc.key,
      title: doc.title,
      author: doc.author_name?.[0] || '',
      cover_id: doc.cover_i ? String(doc.cover_i) : '',
      isbn: doc.isbn?.[0] || '',
      star_rating: rating,
    };
    const res = await fetch('/api/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) await fetchBooks();
    setDiscoverAdding(false);
    setDiscoverSelected(null);
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
  }

  async function openDiscover() {
    setShowDiscover(true);
    setDiscoverSelected(null);
    if (books.length === 0) { setDiscoverBooks([]); return; }
    setDiscoverLoading(true);
    try {
      // Top-rated books' authors (max 3 unique)
      const sorted = [...books].sort((a, b) => b.star_rating - a.star_rating);
      const seenAuthors = new Set<string>();
      const topAuthors: string[] = [];
      for (const b of sorted) {
        if (b.author && !seenAuthors.has(b.author.toLowerCase()) && topAuthors.length < 3) {
          seenAuthors.add(b.author.toLowerCase());
          topAuthors.push(b.author);
        }
      }
      const readKeys = new Set(books.map(b => b.ol_key).filter(Boolean));
      const readTitles = new Set(books.map(b => b.title.toLowerCase()));

      const results = await Promise.all(
        topAuthors.map(author =>
          fetch(`https://openlibrary.org/search.json?author=${encodeURIComponent(author)}&fields=key,title,author_name,cover_i,isbn,first_publish_year&limit=10`)
            .then(r => r.json())
            .then(d => (d.docs || []) as OLDoc[])
            .catch(() => [] as OLDoc[])
        )
      );

      const seen = new Set<string>();
      const suggestions: OLDoc[] = [];
      for (const batch of results) {
        for (const doc of batch) {
          if (!doc.title) continue;
          if (readKeys.has(doc.key)) continue;
          if (readTitles.has(doc.title.toLowerCase())) continue;
          if (seen.has(doc.key)) continue;
          seen.add(doc.key);
          suggestions.push(doc);
        }
      }
      // Shuffle
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
    setSearchQuery('');
    setSearchResults([]);
    setPendingBook(null);
    setPendingRating(3);
  }

  const isAlreadyAdded = (doc: OLDoc) =>
    books.some(b => (b.ol_key && b.ol_key === doc.key) || b.title.toLowerCase() === doc.title.toLowerCase());

  if (loading) return null;

  return (
    <>
      <div className="mt-6">
        <div className="glass-card p-6 rounded-3xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: '#8c90a1' }}>Book Club</h3>
            <div className="flex gap-2">
              <button
                onClick={openDiscover}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', color: '#ffd700' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,215,0,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,215,0,0.08)'; }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>explore</span>
                <span className="hidden sm:inline">Discover</span>
              </button>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(175,198,255,0.1)', border: '1px solid rgba(175,198,255,0.25)', color: '#afc6ff' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.18)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.1)'; }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                <span className="hidden sm:inline">Add Book</span>
              </button>
            </div>
          </div>

          {/* Shelf */}
          {books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="material-symbols-outlined mb-2" style={{ color: '#414655', fontSize: '36px' }}>menu_book</span>
              <p className="text-sm font-medium" style={{ color: '#414655' }}>Your reading list is empty</p>
              <p className="text-xs mt-1" style={{ color: '#2e3140' }}>Add books you&apos;ve read and discover new ones</p>
            </div>
          ) : (
            <div
              className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {books.map(book => (
                <BookCover key={book.id} book={book} onClick={() => { setSelectedBook(book); setEditRating(book.star_rating); }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Book Detail Modal ── */}
      {selectedBook && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSelectedBook(null)}>
          <div className="w-full max-w-sm rounded-t-3xl md:rounded-3xl p-6 animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex gap-4 mb-5">
              <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 72, height: 108, background: 'rgba(255,255,255,0.04)' }}>
                {selectedBook.cover_id ? (
                  <img src={coverUrl(selectedBook.cover_id)} alt={selectedBook.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-symbols-outlined" style={{ color: '#414655', fontSize: '28px' }}>menu_book</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-base leading-snug mb-1" style={{ color: '#e4e1e9', fontFamily: 'var(--font-jakarta)' }}>{selectedBook.title}</h3>
                {selectedBook.author && <p className="text-sm" style={{ color: '#8c90a1' }}>{selectedBook.author}</p>}
                <div className="mt-2">
                  <Stars value={editRating} onChange={r => { setEditRating(r); updateRating(selectedBook.id, r); }} />
                </div>
              </div>
            </div>
            <BuyLinks title={selectedBook.title} author={selectedBook.author} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setSelectedBook(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Close</button>
              <button onClick={() => deleteBook(selectedBook.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(255,180,171,0.08)', border: '1px solid rgba(255,180,171,0.2)', color: '#ffb4ab' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,180,171,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,180,171,0.08)'; }}>
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

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
              <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>Add a Book</h3>
              <button onClick={closeAdd} style={{ color: '#8c90a1' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Search */}
            <div className="px-6 pb-4 flex-shrink-0">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#414655' }}>search</span>
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setPendingBook(null); }}
                  placeholder="Search by title, author or ISBN..."
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: '#e4e1e9' }}
                />
                {searchLoading && <span className="material-symbols-outlined animate-spin flex-shrink-0" style={{ fontSize: '18px', color: '#414655' }}>progress_activity</span>}
              </div>
            </div>

            {/* Results or selected book */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
              {pendingBook ? (
                /* Selected book — confirm + rate */
                <div>
                  <button onClick={() => setPendingBook(null)}
                    className="flex items-center gap-1 text-xs mb-4"
                    style={{ color: '#8c90a1' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
                    Back to results
                  </button>
                  <div className="flex gap-4 mb-5">
                    <OLCover doc={pendingBook} size={72} height={108} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm leading-snug mb-1" style={{ color: '#e4e1e9' }}>{pendingBook.title}</h4>
                      {pendingBook.author_name?.[0] && <p className="text-xs" style={{ color: '#8c90a1' }}>{pendingBook.author_name[0]}</p>}
                      {pendingBook.first_publish_year && <p className="text-xs mt-0.5" style={{ color: '#414655' }}>{pendingBook.first_publish_year}</p>}
                    </div>
                  </div>
                  <div className="mb-5">
                    <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#8c90a1' }}>Your rating</p>
                    <Stars value={pendingRating} onChange={setPendingRating} />
                  </div>
                  <button
                    onClick={() => addBook(pendingBook, pendingRating)}
                    disabled={addingBook}
                    className="w-full py-3 rounded-xl font-bold text-sm"
                    style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 15px rgba(175,198,255,0.3)' }}>
                    {addingBook ? 'Adding...' : 'Add to Library'}
                  </button>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {searchResults.map(doc => {
                    const added = isAlreadyAdded(doc);
                    return (
                      <button
                        key={doc.key}
                        onClick={() => { if (!added) { setPendingBook(doc); setPendingRating(3); } }}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all w-full"
                        style={{
                          background: added ? 'rgba(175,198,255,0.05)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${added ? 'rgba(175,198,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                          opacity: added ? 0.6 : 1,
                          cursor: added ? 'default' : 'pointer',
                        }}>
                        <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 44, height: 64, background: 'rgba(255,255,255,0.04)' }}>
                          {doc.cover_i ? (
                            <img src={coverUrl(doc.cover_i, 'S')} alt={doc.title} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="material-symbols-outlined" style={{ color: '#414655', fontSize: '20px' }}>menu_book</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-snug" style={{ color: '#e4e1e9' }}>{doc.title}</p>
                          {doc.author_name?.[0] && <p className="text-xs mt-0.5" style={{ color: '#8c90a1' }}>{doc.author_name[0]}</p>}
                        </div>
                        {added ? (
                          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#afc6ff' }}>check_circle</span>
                        ) : (
                          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#414655' }}>chevron_right</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : searchQuery && !searchLoading ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <span className="material-symbols-outlined mb-2" style={{ color: '#414655', fontSize: '32px' }}>search_off</span>
                  <p className="text-sm" style={{ color: '#414655' }}>No results for &quot;{searchQuery}&quot;</p>
                </div>
              ) : !searchQuery ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <span className="material-symbols-outlined mb-2" style={{ color: '#2e3140', fontSize: '32px' }}>auto_stories</span>
                  <p className="text-sm" style={{ color: '#414655' }}>Start typing to search millions of books</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── Discover Modal ── */}
      {showDiscover && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => { setShowDiscover(false); setDiscoverSelected(null); }}>
          <div className="w-full max-w-lg rounded-t-3xl md:rounded-3xl flex flex-col animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
              <div>
                <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>Discover Books</h3>
                <p className="text-xs mt-0.5" style={{ color: '#8c90a1' }}>
                  {books.length > 0 ? 'Based on your library' : 'Add books first to get recommendations'}
                </p>
              </div>
              <button onClick={() => { setShowDiscover(false); setDiscoverSelected(null); }} style={{ color: '#8c90a1' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
              {discoverLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <span className="material-symbols-outlined animate-spin mb-3" style={{ color: '#afc6ff', fontSize: '32px' }}>progress_activity</span>
                  <p className="text-sm" style={{ color: '#8c90a1' }}>Finding books you&apos;ll love...</p>
                </div>
              ) : discoverBooks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="material-symbols-outlined mb-3" style={{ color: '#414655', fontSize: '36px' }}>explore</span>
                  <p className="text-sm font-medium mb-1" style={{ color: '#8c90a1' }}>Nothing to show yet</p>
                  <p className="text-xs" style={{ color: '#414655' }}>Add some books to your library first</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {discoverBooks.map(doc => {
                    const added = isAlreadyAdded(doc);
                    return (
                      <button
                        key={doc.key}
                        onClick={() => { setDiscoverSelected(doc); setDiscoverAddRating(3); }}
                        className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all relative"
                        style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${added ? 'rgba(175,198,255,0.3)' : 'rgba(255,255,255,0.06)'}` }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}>
                        {added && (
                          <span className="absolute top-1 right-1 z-10 material-symbols-outlined" style={{ fontSize: '14px', color: '#afc6ff' }}>check_circle</span>
                        )}
                        <OLCover doc={doc} size={70} height={105} />
                        <p className="text-[11px] leading-tight text-center w-full font-medium" style={{ color: '#c1c6d8', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{doc.title}</p>
                        {doc.author_name?.[0] && (
                          <p className="text-[10px] leading-tight text-center w-full" style={{ color: '#414655', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{doc.author_name[0]}</p>
                        )}
                      </button>
                    );
                  })}
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

            {isAlreadyAdded(discoverSelected) ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(175,198,255,0.08)', border: '1px solid rgba(175,198,255,0.2)' }}>
                <span className="material-symbols-outlined" style={{ color: '#afc6ff', fontSize: '18px' }}>check_circle</span>
                <span className="text-sm font-semibold" style={{ color: '#afc6ff' }}>Already in your library</span>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#8c90a1' }}>Rate it (optional)</p>
                <Stars value={discoverAddRating} onChange={setDiscoverAddRating} />
                <button
                  onClick={() => addDiscoverBook(discoverSelected, discoverAddRating)}
                  disabled={discoverAdding}
                  className="w-full py-3 rounded-xl font-bold text-sm mt-4"
                  style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 15px rgba(175,198,255,0.3)' }}>
                  {discoverAdding ? 'Adding...' : 'Add to My Library'}
                </button>
              </div>
            )}
            <button onClick={() => setDiscoverSelected(null)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
