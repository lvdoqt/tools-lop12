import { useState } from 'react';
import { api } from '../api';
import { useToast, ToastContainer } from '../components/Toast';

const FORMATS = [
  { id: 'pdf', label: '📄 PDF' },
  { id: 'docx', label: '📝 DOCX' },
  { id: 'doc', label: '📃 DOC' },
  { id: 'txt', label: '📋 TXT' },
  { id: 'rtf', label: '📰 RTF' },
  { id: 'odt', label: '📓 ODT' },
  { id: 'html', label: '🌐 HTML' },
  { id: 'epub', label: '📚 EPUB' },
];

const COLOR_MAP = {
  blue: { bg: 'rgba(79, 140, 255, 0.15)', color: 'var(--accent-blue)' },
  purple: { bg: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)' },
  green: { bg: 'rgba(52, 211, 153, 0.15)', color: 'var(--accent-green)' },
  red: { bg: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-red)' },
  orange: { bg: 'rgba(251, 146, 60, 0.15)', color: 'var(--accent-orange)' },
  cyan: { bg: 'rgba(34, 211, 238, 0.15)', color: 'var(--accent-cyan)' },
};

export default function DriveDownloaderPage() {
  const { toasts, addToast } = useToast();

  const [activeMethod, setActiveMethod] = useState('direct');
  const [driveUrl, setDriveUrl] = useState('');
  const [exportUrl, setExportUrl] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [loading, setLoading] = useState(false);
  const [downloadLinks, setDownloadLinks] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [exportResult, setExportResult] = useState(null);

  // Generate download links via Python backend
  const handleGenerate = async () => {
    if (!driveUrl.trim()) {
      addToast('⚠️ Vui lòng nhập link Google Drive!', 'warning');
      return;
    }
    setLoading(true);
    try {
      const data = await api.parseDriveUrl(driveUrl);
      setDownloadLinks(data.download_links);
      setFileInfo(data.file_info);
      addToast(`✅ Tìm thấy file: ${data.file_info.filename}`, 'success');
    } catch (err) {
      addToast(`❌ ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Export format
  const handleExport = async () => {
    if (!exportUrl.trim()) {
      addToast('⚠️ Vui lòng nhập link Google Docs!', 'warning');
      return;
    }
    setLoading(true);
    try {
      const data = await api.getExportLink(exportUrl, selectedFormat);
      setExportResult(data);
      addToast('✅ Link xuất file đã sẵn sàng!', 'success');
    } catch (err) {
      addToast(`❌ ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Copy link
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast('📋 Đã copy link!', 'success');
    } catch {
      addToast('❌ Không thể copy', 'error');
    }
  };

  const resetDirect = () => {
    setDriveUrl('');
    setDownloadLinks(null);
    setFileInfo(null);
  };

  return (
    <main className="main-content">
      <div className="tool-page">
        {/* Header */}
        <div className="tool-header">
          <div className="tool-header-icon" style={{ background: 'rgba(79, 140, 255, 0.15)', color: 'var(--accent-blue)' }}>☁️</div>
          <h1>Drive <span className="gradient-text">Downloader</span></h1>
          <p>Tải file PDF/Word từ Google Drive bị giới hạn "chỉ cho xem". Python backend hỗ trợ proxy download.</p>
        </div>

        {/* Main Panel */}
        <div className="glass-panel">
          {/* Method Tabs */}
          <div className="method-tabs">
            {[
              { id: 'direct', label: '⚡ Tải trực tiếp' },
              { id: 'export', label: '📤 Xuất định dạng' },
              { id: 'guide', label: '📖 Hướng dẫn' },
            ].map(m => (
              <button
                key={m.id}
                className={`method-tab ${activeMethod === m.id ? 'active' : ''}`}
                onClick={() => setActiveMethod(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* ===== Direct Download ===== */}
          {activeMethod === 'direct' && (
            <div style={{ animation: 'fadeInUp 0.3s ease-out' }}>
              <div className="alert alert-info">
                <span>💡</span>
                <span>Dán link Google Drive vào ô bên dưới. Python backend sẽ phân tích link và tạo nhiều phương thức tải.</span>
              </div>

              <div className="input-group">
                <label>🔗 Link Google Drive</label>
                <input
                  type="url"
                  className="input-field mono"
                  placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
                  value={driveUrl}
                  onChange={e => setDriveUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                />
                <div className="input-hint">Hỗ trợ: drive.google.com/file/d/..., docs.google.com/document/d/..., v.v.</div>
              </div>

              <div className="link-examples">
                <h4>📎 Ví dụ link hợp lệ:</h4>
                <code>https://drive.google.com/file/d/1AbCdEfGhIjKl/view</code>
                <code>https://docs.google.com/document/d/1AbCdEfGhIjKl/edit</code>
              </div>

              {!downloadLinks && (
                <button
                  className="btn btn-primary btn-lg btn-block"
                  style={{ marginTop: '1.5rem' }}
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading ? <><span className="spinner"></span> Đang xử lý...</> : '🚀 Tạo link tải xuống'}
                </button>
              )}

              {/* Download Links */}
              {downloadLinks && (
                <div style={{ marginTop: '1.5rem' }}>
                  {fileInfo && (
                    <div className="alert alert-success">
                      <span>✅</span>
                      <span>Tìm thấy: <strong>{fileInfo.filename}</strong> • ID: {fileInfo.file_id.slice(0, 12)}...</span>
                    </div>
                  )}

                  <div className="download-links-grid">
                    {downloadLinks.map((link, i) => {
                      const colors = COLOR_MAP[link.color] || COLOR_MAP.blue;
                      return (
                        <div key={i} className="download-link-card" style={{ animationDelay: `${i * 0.05}s` }}>
                          <div className="dl-icon" style={{ background: colors.bg, color: colors.color }}>
                            {link.icon}
                          </div>
                          <div className="dl-info">
                            <h4>{link.title}</h4>
                            <p>{link.desc}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="dl-btn copy-btn"
                              onClick={() => copyToClipboard(link.url)}
                              title="Copy link"
                            >📋</button>
                            <a className="dl-btn" href={link.url} target="_blank" rel="noopener noreferrer">⬇️ Tải</a>
                          </div>
                        </div>
                      );
                    })}

                    {/* Proxy download through our server */}
                    {fileInfo && (
                      <div className="download-link-card" style={{ borderColor: 'rgba(52, 211, 153, 0.2)' }}>
                        <div className="dl-icon" style={{ background: 'rgba(52, 211, 153, 0.15)', color: 'var(--accent-green)' }}>
                          🐍
                        </div>
                        <div className="dl-info">
                          <h4>Proxy qua Python Server</h4>
                          <p>Tải qua server Python — Bypass CORS & giới hạn mạnh nhất</p>
                        </div>
                        <a
                          className="dl-btn"
                          href={api.getProxyDownloadUrl(fileInfo.file_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ background: 'var(--gradient-green)' }}
                        >🐍 Proxy Tải</a>
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <button className="btn btn-secondary" onClick={resetDirect}>🔄 Tạo link khác</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== Export Format ===== */}
          {activeMethod === 'export' && (
            <div style={{ animation: 'fadeInUp 0.3s ease-out' }}>
              <div className="alert alert-info">
                <span>💡</span>
                <span>Dán link Google Docs/Sheets/Slides để xuất sang định dạng mong muốn.</span>
              </div>

              <div className="input-group">
                <label>🔗 Link Google Docs / Sheets / Slides</label>
                <input
                  type="url"
                  className="input-field mono"
                  placeholder="https://docs.google.com/document/d/FILE_ID/edit"
                  value={exportUrl}
                  onChange={e => setExportUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleExport()}
                />
              </div>

              <div className="input-group">
                <label>📁 Chọn định dạng xuất</label>
                <div className="format-options">
                  {FORMATS.map(f => (
                    <button
                      key={f.id}
                      className={`format-btn ${selectedFormat === f.id ? 'active' : ''}`}
                      onClick={() => setSelectedFormat(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg btn-block"
                style={{ marginTop: '1rem' }}
                onClick={handleExport}
                disabled={loading}
              >
                {loading ? <><span className="spinner"></span> Đang xử lý...</> : '📤 Xuất & Tải xuống'}
              </button>

              {exportResult && (
                <div style={{ marginTop: '1.5rem' }}>
                  <div className="result-card">
                    <div className="icon">✅</div>
                    <div className="info">
                      <h4>Xuất file dạng {exportResult.format.toUpperCase()}</h4>
                      <p>Google {exportResult.doc_type} → {exportResult.format.toUpperCase()}</p>
                    </div>
                    <a className="dl-btn" href={exportResult.export_url} target="_blank" rel="noopener noreferrer">⬇️ Tải về</a>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <button className="btn btn-secondary" onClick={() => copyToClipboard(exportResult.export_url)}>📋 Copy link</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== Guide ===== */}
          {activeMethod === 'guide' && (
            <div style={{ animation: 'fadeInUp 0.3s ease-out' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>📖 Hướng dẫn sử dụng chi tiết</h3>
              <div className="how-steps">
                {[
                  { title: 'Mở file trên Google Drive', desc: 'Truy cập file PDF/Word mà bạn muốn tải. File hiển thị "Bạn chỉ có quyền xem".' },
                  { title: 'Sao chép link từ thanh địa chỉ', desc: 'Copy toàn bộ URL từ thanh địa chỉ trình duyệt.' },
                  { title: 'Dán link vào công cụ', desc: 'Dán link vào tab "⚡ Tải trực tiếp" hoặc "📤 Xuất định dạng".' },
                  { title: 'Tạo link tải & Download', desc: 'Bấm nút tạo link. Thử từng phương thức. Phương thức "🐍 Proxy Python" mạnh nhất!' },
                ].map((s, i) => (
                  <div key={i} className="how-step">
                    <div className="how-step-num">{i + 1}</div>
                    <div className="how-step-content">
                      <h4>{s.title}</h4>
                      <p>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="alert alert-warning" style={{ marginTop: '1.5rem' }}>
                <span>⚠️</span>
                <div>
                  <strong>Lưu ý quan trọng:</strong>
                  <ul style={{ marginTop: '0.3rem', paddingLeft: '1.2rem', fontSize: '0.82rem', lineHeight: 1.7 }}>
                    <li>File phải được chia sẻ "Bất kỳ ai có link đều xem được"</li>
                    <li>File riêng tư hoàn toàn sẽ không tải được</li>
                    <li>Phương thức <strong>Proxy Python</strong> bypass được nhiều giới hạn nhất</li>
                    <li>File lớn (&gt;100MB) có thể cần đăng nhập Google</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="footer">
        <p>© 2026 <strong>Tools All</strong> — Python proxy bypass CORS & giới hạn tải.</p>
      </footer>

      <ToastContainer toasts={toasts} />
    </main>
  );
}
