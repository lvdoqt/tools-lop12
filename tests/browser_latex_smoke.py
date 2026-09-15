"""Manual browser check. --upload explicitly enables real Cloudinary uploads."""

import argparse
import json
from pathlib import Path
import time

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:5173/latex-to-json')
    parser.add_argument('--exam', default='T.Do.tex')
    parser.add_argument('--output', default='.artifacts/T.Do.quiz-bank.json')
    parser.add_argument('--upload', action='store_true')
    args = parser.parse_args()
    Path('.artifacts').mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.url)
        page.get_by_role('button', name='Dùng ví dụ').click()
        page.get_by_role('button', name='1. Đọc đề và kiểm tra').click()
        page.wait_for_function("document.querySelector('[aria-label=\"JSON kết quả\"]')?.value.length > 0")
        result = json.loads(page.get_by_label('JSON kết quả').input_value())
        assert [q['type'] for q in result['questions']] == ['mcq', 'msq', 'sa']
        print('Sample: 3 question types passed', flush=True)
        page.locator('input[type=file]').set_input_files(args.exam)
        page.get_by_role('button', name='1. Đọc đề và kiểm tra').click()
        page.get_by_role('heading', name='22 câu hỏi', exact=True).wait_for()
        assert page.locator('.latex-image-card').count() == 13
        assert page.get_by_role('button', name='Tải quiz-bank.json').is_disabled()
        print('Exam: 22 questions / 13 images; incomplete export disabled', flush=True)
        if args.upload:
            page.get_by_role('button', name='2. Tạo SVG và tải hình lên').click()
            previous = ''
            deadline = time.monotonic() + 900
            while time.monotonic() < deadline:
                page.wait_for_timeout(1000)
                status = page.get_by_role('status').inner_text()
                if status != previous:
                    print(status, flush=True)
                    previous = status
                if page.get_by_role('button', name='1. Đọc đề và kiểm tra').is_enabled():
                    break
            states = page.locator('.latex-image-card > span').all_inner_texts()
            print('Image engines:', states, flush=True)
            image_errors = page.locator('.latex-image-error').all_inner_texts()
            print('Image errors:', image_errors, flush=True)
            assert not image_errors, image_errors
            assert page.get_by_role('button', name='Tải quiz-bank.json').is_enabled()
            output = page.get_by_label('JSON kết quả').input_value()
            assert '@@tikz-' not in output
            result = json.loads(output)
            assert len(result['questions']) == 22
            Path(args.output).write_text(output + '\n', encoding='utf-8')
            with page.expect_download() as download:
                page.get_by_role('button', name='Tải quiz-bank.json').click()
            assert download.value.suggested_filename == 'quiz-bank.json'
            download.value.save_as('.artifacts/downloaded-quiz-bank.json')
            assert json.loads(Path('.artifacts/downloaded-quiz-bank.json').read_text(encoding='utf-8')) == result
            print('JSON export and download passed', flush=True)
        page.screenshot(path='.artifacts/latex-to-json-desktop.png', full_page=True)
        page.set_viewport_size({'width': 390, 'height': 844})
        page.screenshot(path='.artifacts/latex-to-json-mobile.png', full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Mobile page overflows'
        assert not errors, errors
        browser.close()


if __name__ == '__main__':
    main()
