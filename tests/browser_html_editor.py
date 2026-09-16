"""HTML editor integration checks; run with the Vite server on port 5173."""
import argparse
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:5173')
    args = parser.parse_args()
    Path('.artifacts').mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 1080}, permissions=['clipboard-read', 'clipboard-write'])
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.url + '/edit-html')
        source = page.get_by_role('textbox', name='Mã HTML', exact=True)
        preview = page.frame_locator('iframe[title="Bản xem trước HTML"]')
        expect(preview.locator('.katex').first).to_be_visible()
        assert preview.locator('body').evaluate("async () => { await document.fonts.ready; return [...document.fonts].every(font => font.status !== 'error'); }")
        page.screenshot(path='.artifacts/html-editor-desktop.png', full_page=True)
        assert preview.locator('h1').evaluate("el => getComputedStyle(el).color") == 'rgb(155, 96, 14)'

        # HTML round trip, Vietnamese, CSS, LaTeX and source formatting selection.
        original = '<!DOCTYPE html><html lang="vi"><head><title>Kiểm tra</title><style>h1{color:rgb(12,34,56)}</style></head><body><h1>Xin chào</h1><p>Văn bản $x^2$</p></body></html>'
        upload = page.locator('input[type=file]')
        upload.set_input_files({'name': 'kiem-tra.html', 'mimeType': 'text/html', 'buffer': original.encode()})
        expect(source).to_have_value(original)
        expect(preview.locator('h1')).to_have_text('Xin chào')
        expect(preview.locator('.katex')).to_have_count(1)
        assert preview.locator('h1').evaluate("el => getComputedStyle(el).color") == 'rgb(12, 34, 56)'
        source.evaluate("el => { el.focus(); const i = el.value.indexOf('Xin chào'); el.setSelectionRange(i, i + 8); el.dispatchEvent(new Event('select', {bubbles:true})); }")
        page.get_by_role('button', name='In đậm', exact=True).click()
        expect(source).to_have_value(original.replace('Xin chào', '<strong>Xin chào</strong>'))
        page.get_by_role('button', name='Hoàn tác (Ctrl+Z)', exact=True).click()
        expect(source).to_have_value(original)
        page.get_by_role('button', name='Làm lại (Ctrl+Shift+Z)', exact=True).click()
        expect(preview.locator('h1 strong')).to_have_text('Xin chào')

        # Visual editing synchronizes to source while retaining document head/CSS.
        page.get_by_role('button', name='Văn bản', exact=True).click()
        visual = page.frame_locator('iframe[title="Soạn văn bản trực quan"]')
        expect(visual.locator('body')).to_have_attribute('contenteditable', 'true')
        visual.locator('p').evaluate("el => { el.focus(); const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }")
        page.get_by_role('button', name='In nghiêng', exact=True).click()
        expect(visual.locator('p i, p em')).to_have_count(1)
        page.get_by_role('button', name='Hoàn tác (Ctrl+Z)', exact=True).click()
        expect(visual.locator('p i, p em')).to_have_count(0)
        page.get_by_role('button', name='Làm lại (Ctrl+Shift+Z)', exact=True).click()
        expect(visual.locator('p i, p em')).to_have_count(1)
        visual.locator('h1').click()
        page.keyboard.press('End')
        page.keyboard.type(' - edited')
        expect(preview.locator('h1')).to_contain_text('edited')
        page.get_by_role('button', name='Mã HTML', exact=True).click()
        assert '<title>Kiểm tra</title>' in source.input_value()
        assert 'edited' in source.input_value()

        # Insert a valid math formula into the selected range; cancel leaves text intact.
        source.evaluate("el => { el.focus(); const i=el.value.indexOf('</body>'); el.setSelectionRange(i,i); }")
        page.get_by_role('button', name='LaTeX', exact=True).click()
        page.get_by_label('Công thức LaTeX', exact=True).fill(r'\frac{1}{2}')
        page.get_by_role('button', name='Chèn vào tài liệu').click()
        expect(preview.locator('.katex')).to_have_count(2)
        assert r'\frac{1}{2}' in source.input_value()
        page.get_by_role('button', name='Chèn bảng', exact=True).click()
        page.get_by_label('Số hàng nội dung').fill('2')
        page.get_by_label('Số cột').fill('2')
        page.get_by_role('button', name='Chèn vào tài liệu').click()
        expect(preview.locator('table td')).to_have_count(4)
        page.get_by_role('button', name='Chèn liên kết', exact=True).click()
        page.get_by_label('Đường dẫn').fill('javascript:alert(1)')
        page.get_by_role('button', name='Chèn vào tài liệu').click()
        expect(page.get_by_role('alert')).to_be_visible()
        page.get_by_role('button', name='Hủy', exact=True).click()

        # Copy and download exactly the source, including LaTeX and Unicode.
        expected = source.input_value()
        page.get_by_role('button', name='Sao chép', exact=True).click()
        expect(page.get_by_text('Đã sao chép mã HTML', exact=True)).to_be_visible()
        # Windows clipboard normalizes line endings to CRLF.
        assert page.evaluate('navigator.clipboard.readText()').replace('\r\n', '\n') == expected.replace('\r\n', '\n')
        with page.expect_download() as result:
            page.get_by_role('button', name='Tải HTML', exact=True).click()
        assert result.value.suggested_filename == 'kiem-tra.html'
        assert Path(result.value.path()).read_text(encoding='utf-8') == expected
        upload.set_input_files({'name': 'large.html', 'mimeType': 'text/html', 'buffer': b'x' * (2 * 1024 * 1024 + 1)})
        expect(source).to_have_value(expected)
        expect(page.get_by_text('Tệp HTML tối đa 2 MB.', exact=True)).to_be_visible()

        # No execution, navigation or DOM access from uploaded markup in either mode.
        hostile = '<meta http-equiv="refresh" content="0;url=https://example.com"><p>Safe content</p><script>parent.document.body.dataset.pwned="yes"</script><img src="x" onerror="parent.document.body.dataset.pwned=\'yes\'"><iframe srcdoc="<script>parent.alert(1)</script>"></iframe>'
        source.fill(hostile)
        expect(preview.get_by_text('Safe content', exact=True)).to_be_visible()
        assert preview.locator('script, iframe, [onerror], meta[http-equiv="refresh"]').count() == 0
        page.get_by_role('button', name='Văn bản', exact=True).click()
        expect(visual.locator('p')).to_have_text('Safe content')
        assert visual.locator('script, iframe, [onerror], meta[http-equiv="refresh"]').count() == 0
        assert page.locator('body').get_attribute('data-pwned') is None

        # Mobile layout, device preview and discoverability on the home page.
        page.get_by_role('button', name='Mã HTML', exact=True).click()
        source.fill(original)
        page.get_by_role('button', name='Xem trước điện thoại', exact=True).click()
        assert page.locator('iframe[title="Bản xem trước HTML"]').bounding_box()['width'] <= 375
        page.set_viewport_size({'width': 390, 'height': 844})
        expect(preview.locator('h1')).to_have_text('Xin chào')
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        page.screenshot(path='.artifacts/html-editor-mobile.png', full_page=True)
        page.goto(args.url + '/')
        page.get_by_role('link').filter(has=page.get_by_role('heading', name='Edit HTML', exact=True)).click()
        expect(source).to_be_visible()
        assert not errors, errors
        browser.close()
        print('PASS: import, CSS, LaTeX, formatting, undo/redo, visual sync, dialogs, copy/export, upload limit, sandbox, responsive layout and navigation.')


if __name__ == '__main__':
    main()
