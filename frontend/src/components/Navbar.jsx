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
        <li><NavLink to="/" end>Trang chủ</NavLink></li>
        <li><Link to={{ pathname: '/', hash: '#danh-sach-cong-cu' }}>Tất cả công cụ</Link></li>
      </ul>
    </nav>
  );
}
