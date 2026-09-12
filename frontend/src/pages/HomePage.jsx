import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

const ALL_TOOLS = [
  {
    id: 'tex-pdf', path: '/tex-to-pdf', category: 'convert',
    icon: '🧮', iconClass: 'green',
    title: 'TeX → PDF',
    desc: 'Biên dịch file LaTeX (.tex) sang PDF. Hỗ trợ công thức toán phức tạp.',
    tags: [{ text: 'Mới', cls: 'new' }, { text: 'LaTeX' }, { text: 'PDF' }],
    active: true,
  },
  {
    id: 'tikz-editor', path: '/tikz-editor', category: 'edit',
    icon: '△', iconClass: 'purple',
    title: 'TikZ Editor',
    desc: 'Dán mã LaTeX TikZ, biên dịch thành hình, xem trước và tải về dưới dạng PNG, PDF hoặc TEX.',
    tags: [{ text: 'Mới', cls: 'new' }, { text: 'TikZ' }, { text: 'LaTeX' }],
    active: true,
  },
  {
    id: 'json-fmt', path: '/json-formatter', category: 'format',
    icon: '{ }', iconClass: 'cyan',
    title: 'JSON Formatter',
    desc: 'Định dạng, validate và chuyển đổi JSON. Hỗ trợ minify, beautify và tree view.',
    tags: [{ text: 'Mới', cls: 'new' }, { text: 'JSON' }, { text: 'Format' }],
    active: true,
  },
  {
    id: 'pdf-tools', path: '/pdf-tools', category: 'edit',
    icon: '📑', iconClass: 'orange',
    title: 'Công cụ PDF',
    desc: 'Gộp, chia PDF thành nhiều file nhỏ hoặc chuyển từng trang sang PNG.',
    tags: [{ text: 'Mới', cls: 'new' }, { text: 'PDF' }, { text: 'PNG' }],
    active: true,
  },
];

const CATEGORIES = [
  { id: 'all', label: '🔥 Tất cả' },
  { id: 'convert', label: '🔄 Chuyển đổi' },
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
          Hỗ trợ dạy và học Toán
        </div>
        <h1>
          Công cụ <span className="gradient-text">cho Toán</span>
        </h1>
        <p>
          Biên dịch LaTeX, vẽ hình TikZ, xử lý tài liệu PDF và định dạng dữ liệu JSON.
          Các tiện ích giúp bạn chuẩn bị bài giảng, đề thi và tài liệu học tập.
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
        <div className="stat-item"><div className="stat-number">{ALL_TOOLS.length}</div><div className="stat-label">Công cụ</div></div>
        <div className="stat-item"><div className="stat-number">100%</div><div className="stat-label">Miễn phí</div></div>
        <div className="stat-item"><div className="stat-number">TeX</div><div className="stat-label">Soạn tài liệu Toán</div></div>
        <div className="stat-item"><div className="stat-number">TikZ</div><div className="stat-label">Vẽ hình Toán học</div></div>
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
        <p>© 2026 <strong>Công cụ cho Toán</strong> — Hỗ trợ dạy và học Toán.</p>
      </footer>
    </main>
  );
}
