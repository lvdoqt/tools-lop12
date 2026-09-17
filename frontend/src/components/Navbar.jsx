import { Link, NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <div className="navbar-logo">T</div>
        <div>
          <div className="navbar-title">Công cụ cho Toán</div>
          <div className="navbar-subtitle">Soạn bài · Vẽ hình · Xử lý tài liệu</div>
        </div>
      </Link>
      <ul className="navbar-nav">
        <li><NavLink to="/word-shuffle">Trộn đề Word</NavLink></li>
        <li><NavLink to="/json-formatter">{`{ } JSON`}</NavLink></li>
        <li><NavLink to="/tikz-editor">TikZ</NavLink></li>
        <li><NavLink to="/tex-to-pdf">TeX → PDF</NavLink></li>
        <li><NavLink to="/latex-to-json">LaTeX → JSON</NavLink></li>
        <li><NavLink to="/json-to-word">JSON → Word</NavLink></li>
        <li><NavLink to="/edit-html">Edit HTML</NavLink></li>
        <li><NavLink to="/pdf-tools">Công cụ PDF</NavLink></li>
      </ul>
    </nav>
  );
}
