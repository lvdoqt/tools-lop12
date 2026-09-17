"""Run against local frontend/backend; downloads public images from the input quiz."""
from pathlib import Path
from playwright.sync_api import sync_playwright


def main():
    Path('.artifacts').mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page(viewport={'width': 1366, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('response', lambda response: print(response.text(), flush=True) if '/json-to-word/export' in response.url and response.status != 200 else None)
        page.goto('http://localhost:5173/json-to-word')
        page.get_by_label('Nội dung JSON').fill('broken')
        page.get_by_role('button', name='1. Kiểm tra JSON').click()
        page.get_by_role('alert').wait_for()
        page.get_by_role('button', name='Dùng ví dụ').click()
        page.get_by_role('button', name='1. Kiểm tra JSON').click()
        page.get_by_role('heading', name='3 câu hỏi', exact=True).wait_for()
        with page.expect_download(timeout=120000) as download:
            page.get_by_role('button', name='2. Xuất ZIP Word').click()
        download.value.save_as('.artifacts/word-sample.zip')
        print('Sample download passed', flush=True)
        page.locator('input[type=file]').set_input_files('quiz-bank.json')
        page.get_by_role('button', name='1. Kiểm tra JSON').click()
        page.get_by_role('heading', name='22 câu hỏi', exact=True).wait_for()
        with page.expect_download(timeout=120000) as download:
            page.get_by_role('button', name='2. Xuất ZIP Word').click()
        download.value.save_as('.artifacts/quiz-bank-word.zip')
        print('Full exam download passed', flush=True)
        page.screenshot(path='.artifacts/json-to-word-desktop.png', full_page=True)
        page.get_by_label('Mã đề', exact=True).fill('102')
        assert page.get_by_role('button', name='2. Xuất ZIP Word').is_disabled()
        page.get_by_role('button', name='1. Kiểm tra JSON').click()
        page.get_by_role('heading', name='22 câu hỏi', exact=True).wait_for()
        with page.expect_download(timeout=120000) as download:
            page.get_by_role('button', name='2. Xuất ZIP Word').click()
        download.value.save_as('.artifacts/quiz-bank-word-solutions.zip')
        print('Exam with solutions download passed', flush=True)
        page.set_viewport_size({'width': 390, 'height': 844})
        page.screenshot(path='.artifacts/json-to-word-mobile.png', full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        assert not errors, errors
        browser.close()


if __name__ == '__main__': main()
