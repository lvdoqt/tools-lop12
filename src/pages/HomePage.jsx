import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

const ALL_TOOLS = [
  {
    id: 'pdf-word', path: '/pdf-to-word', category: 'convert',
    icon: '📄', iconClass: 'red',
    title: 'PDF → Word',
    desc: 'Chuyển đổi file PDF sang Word (.docx) bằng Python. Hỗ trợ đề toán 12, công thức, bảng biểu với độ chính xác cao.',
    tags: [{ text: '🔥 Hot', cls: 'hot' }, { text: 'PDF' }, { text: 'DOCX' }],
    active: true,
  },
  {
    id: 'drive-dl', path: '/drive-downloader', category: 'download',
    icon: '☁️', iconClass: 'blue',
    title: 'Drive Downloader',
    desc: 'Tải file PDF/Word từ Google Drive bị hạn chế "chỉ xem". Bypass giới hạn tải về qua server proxy.',
    tags: [{ text: '🔥 Hot', cls: 'hot' }, { text: 'Google Drive' }, { text: 'Download' }],
    active: true,
  },
  {
    id: 'word-pdf', category: 'convert',
    icon: '📝', iconClass: 'purple',
    title: 'Word → PDF',
    desc: 'Chuyển đổi file Word (.docx) sang PDF chất lượng cao, giữ nguyên định dạng.',
    tags: [{ text: '🔜 Sắp ra mắt', cls: 'new' }, { text: 'DOCX' }, { text: 'PDF' }],
    active: false,
  },
  {
    id: 'tex-pdf', category: 'convert',
    icon: '🧮', iconClass: 'green',
    title: 'TeX → PDF',
    desc: 'Biên dịch file LaTeX (.tex) sang PDF. Hỗ trợ công thức toán phức tạp.',
    tags: [{ text: '🔜 Sắp ra mắt', cls: 'new' }, { text: 'LaTeX' }, { text: 'PDF' }],
    active: false,
  },
  {
    id: 'json-fmt', category: 'format',
    icon: '{ }', iconClass: 'cyan',
    title: 'JSON Formatter',
    desc: 'Định dạng, validate và chuyển đổi JSON. Hỗ trợ minify, beautify và tree view.',
    tags: [{ text: '🔜 Sắp ra mắt', cls: 'new' }, { text: 'JSON' }, { text: 'Format' }],
    active: false,
  },
  {
    id: 'merge-pdf', category: 'edit',
    icon: '📑', iconClass: 'orange',
    title: 'Merge PDF',
    desc: 'Gộp nhiều file PDF thành một. Sắp xếp thứ tự dễ dàng.',
    tags: [{ text: '🔜 Sắp ra mắt', cls: 'new' }, { text: 'PDF' }, { text: 'Merge' }],
    active: false,
  },
];

const CATEGORIES = [
  { id: 'all', label: '🔥 Tất cả' },
  { id: 'convert', label: '🔄 Chuyển đổi' },
  { id: 'download', label: '⬇️ Tải xuống' },
  { id: 'edit', label: '✏️ Chỉnh sửa' },
  { id: 'format', label: '📐 Định dạng' },
];

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredTools = useMemo(() => {
    return ALL_TOOLS.filter(tool => {
      const matchCategory = activeCategory === 'all' || tool.category === activeCategory;
      const query = search.toLowerCase();
      const matchSearch = !query ||
        tool.title.toLowerCase().includes(query) ||
        tool.desc.toLowerCase().includes(query) ||
        tool.tags.some(t => t.text.toLowerCase().includes(query));
      return matchCategory && matchSearch;
    });
  }, [search, activeCategory]);

  return (
    <main className="main-content">
      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">
          <span className="dot"></span>
          Phiên bản 1.0 — React + Python
        </div>
        <h1>
          Mọi công cụ bạn cần<br />
          <span className="gradient-text">trong một nơi duy nhất</span>
        </h1>
        <p>
          Xử lý file PDF, Word, TeX, JSON, tải file từ Google Drive và nhiều hơn nữa.
          Sức mạnh Python + giao diện React hiện đại.
        </p>
      </section>

      {/* Search */}
      <div className="search-container">
        <div className="search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Tìm kiếm công cụ..."
            value={search}
            onChange={e => { setSearch(e.target.value); setActiveCategory('all'); }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="stats-bar">
        <div className="stat-item"><div className="stat-number">6+</div><div className="stat-label">Công cụ</div></div>
        <div className="stat-item"><div className="stat-number">100%</div><div className="stat-label">Miễn phí</div></div>
        <div className="stat-item"><div className="stat-number">🐍</div><div className="stat-label">Python Backend</div></div>
        <div className="stat-item"><div className="stat-number">⚛️</div><div className="stat-label">React Frontend</div></div>
      </div>

      {/* Category Tabs */}
      <div className="category-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`tab-btn ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Tools Grid */}
      <div className="tools-grid">
        {filteredTools.map((tool, idx) => (
          tool.active ? (
            <Link
              key={tool.id}
              to={tool.path}
              className="tool-card"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="tool-card-arrow">→</div>
              <div className={`tool-card-icon ${tool.iconClass}`}>{tool.icon}</div>
              <div className="tool-card-content">
                <h3>{tool.title}</h3>
                <p>{tool.desc}</p>
              </div>
              <div className="tool-card-tags">
                {tool.tags.map((tag, i) => (
                  <span key={i} className={`tag ${tag.cls || ''}`}>{tag.text}</span>
                ))}
              </div>
            </Link>
          ) : (
            <div
              key={tool.id}
              className="tool-card disabled"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="tool-card-arrow">→</div>
              <div className={`tool-card-icon ${tool.iconClass}`}>{tool.icon}</div>
              <div className="tool-card-content">
                <h3>{tool.title}</h3>
                <p>{tool.desc}</p>
              </div>
              <div className="tool-card-tags">
                {tool.tags.map((tag, i) => (
                  <span key={i} className={`tag ${tag.cls || ''}`}>{tag.text}</span>
                ))}
              </div>
              <div className="coming-soon-overlay">
                <span className="coming-soon-text">🔜 Sắp ra mắt</span>
              </div>
            </div>
          )
        ))}
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>© 2026 <strong>Tools All</strong> — React + Python FastAPI. Made with ❤️</p>
      </footer>
    </main>
  );
}
