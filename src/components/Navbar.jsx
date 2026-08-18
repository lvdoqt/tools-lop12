import { Link, NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <div className="navbar-logo">T</div>
        <div>
          <div className="navbar-title">Tools All</div>
          <div className="navbar-subtitle">Bộ công cụ đa năng</div>
        </div>
      </Link>
      <ul className="navbar-nav">
        <li><NavLink to="/" end>🏠 Trang chủ</NavLink></li>
        <li><NavLink to="/pdf-to-word">📄 PDF → Word</NavLink></li>
        <li><NavLink to="/drive-downloader">☁️ Drive Download</NavLink></li>
      </ul>
    </nav>
  );
}
