import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from backend.main import app
from backend.services import tikz_library as library
from backend.services.tikz_renderer import build_document, render_tikz
import pymupdf

ENV = {'SUPABASE_URL': 'https://example.supabase.co', 'SUPABASE_SECRET_KEY': '', 'SUPABASE_SERVICE_ROLE_KEY': 'server-secret', 'TIKZ_LIBRARY_KEY': 'private-library'}
SVG = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10"/></svg>'


class VariationTableTests(unittest.TestCase):
    def test_snippet_loads_variation_table_package(self):
        source = r"\begin{tikzpicture}\tkzTabLine{,+,0,-,}\end{tikzpicture}"
        document = build_document(source)
        self.assertIn(r'\usepackage{tkz-tab}', document.split(r'\begin{document}')[0])
        self.assertIn(source, document)

    def test_full_document_loads_missing_package(self):
        source = r'\documentclass{standalone}\begin{document}\tkzTabLine{,+,}\end{document}'
        self.assertIn(r'\usepackage{tkz-tab}', build_document(source).split(r'\begin{document}')[0])

    def test_existing_package_options_are_preserved(self):
        source = r'\documentclass{standalone}\usepackage[english]{tkz-tab}\begin{document}\tkzTabLine{,+,}\end{document}'
        self.assertEqual(build_document(source), source)

    def test_commented_package_is_not_treated_as_loaded(self):
        source = '\\documentclass{standalone}\n% \\usepackage{tkz-tab}\n\\begin{document}\\tkzTabLine{,+,}\\end{document}'
        self.assertIn('\n\\usepackage{tkz-tab}\n\\begin{document}', build_document(source))


@patch.dict(os.environ, ENV)
class LibraryTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.headers = {'X-Library-Key': 'private-library'}
        self.payload = {'title': 'Hình chóp', 'source': r'\begin{tikzpicture}\end{tikzpicture}', 'svg': SVG, 'dpi': 180}

    def test_all_routes_require_key_before_network(self):
        identifier = str(uuid4())
        with patch.object(library, 'database') as db:
            for method, path, body in [('GET', '', None), ('POST', '', self.payload), ('GET', '/' + identifier, None), ('PATCH', '/' + identifier, {'title': 'new'}), ('DELETE', '/' + identifier, None)]:
                response = self.client.request(method, '/api/tikz/library' + path, json=body)
                self.assertEqual(response.status_code, 401)
            db.assert_not_called()

    def test_missing_config_is_actionable(self):
        with patch.dict(os.environ, {'SUPABASE_URL': ''}):
            response = self.client.get('/api/tikz/library', headers=self.headers)
        self.assertEqual(response.status_code, 503)

    def test_save_keeps_original_code_and_cloudinary_id(self):
        url = 'https://res.cloudinary.com/demo/image/upload/v1/tikz.svg'
        with patch.object(library, 'database', side_effect=[[], [{'id': 'saved'}]]) as db, patch.object(library, 'upload_svg', return_value={'url': url, 'public_id': 'tikz-1'}) as upload:
            response = self.client.post('/api/tikz/library', json=self.payload, headers=self.headers)
            self.assertEqual(response.status_code, 200, response.text)
            body = db.call_args.args[2]
            self.assertEqual(body['source'], self.payload['source'])
            self.assertEqual(body['cloudinary_public_id'], 'tikz-1')
            self.assertIn('/f_png,dn_180/', body['png_url'])
            upload.assert_called_once_with(SVG, prefix='tikz')

    def test_identical_save_does_not_upload_again(self):
        with patch.object(library, 'database', return_value=[{'id': 'existing'}]), patch.object(library, 'upload_svg') as upload:
            response = self.client.post('/api/tikz/library', json=self.payload, headers=self.headers)
            self.assertEqual(response.json()['id'], 'existing')
            upload.assert_not_called()

    def test_cloud_failure_does_not_create_database_record(self):
        with patch.object(library, 'database', return_value=[]) as db, patch.object(library, 'upload_svg', side_effect=RuntimeError('Upload failed')):
            response = self.client.post('/api/tikz/library', json=self.payload, headers=self.headers)
            self.assertEqual(response.status_code, 502)
            self.assertEqual(db.call_count, 1)

    def test_list_is_paginated_and_omits_code_until_opened(self):
        with patch.object(library, 'database', return_value=[]) as db:
            self.client.get('/api/tikz/library?offset=25&q=chop', headers=self.headers)
            params = db.call_args.args[1]
            self.assertEqual(params['limit'], 25)
            self.assertEqual(params['offset'], 25)
            self.assertNotIn('source', params['select'])
            self.assertEqual(params['title'], 'ilike.*chop*')

    def test_upstream_errors_do_not_leak_credentials(self):
        response = Mock(ok=False, status_code=401, text='server-secret')
        with patch.object(library.requests, 'request', return_value=response) as request:
            result = self.client.get('/api/tikz/library', headers=self.headers)
            self.assertEqual(result.status_code, 502)
            self.assertNotIn('server-secret', result.text)
            self.assertEqual(request.call_args.kwargs['headers']['apikey'], 'server-secret')

    def test_delete_only_removes_library_record(self):
        identifier = str(uuid4())
        with patch.object(library, 'database', return_value=[]) as db:
            result = self.client.delete('/api/tikz/library/' + identifier, headers=self.headers)
            self.assertEqual(result.status_code, 200)
            db.assert_called_once_with('DELETE', {'id': 'eq.' + identifier})

    def test_new_secret_key_is_not_sent_as_bearer_token(self):
        response = Mock(ok=True, content=b'[]')
        response.json.return_value = []
        with patch.dict(os.environ, {'SUPABASE_SECRET_KEY': 'sb_secret_example'}), patch.object(library.requests, 'request', return_value=response) as request:
            result = self.client.get('/api/tikz/library', headers=self.headers)
            self.assertEqual(result.status_code, 200)
            headers = request.call_args.kwargs['headers']
            self.assertEqual(headers['apikey'], 'sb_secret_example')
            self.assertNotIn('Authorization', headers)

    def test_renderer_produces_standalone_svg_from_same_pdf(self):
        with pymupdf.open() as pdf:
            pdf.new_page(width=100, height=100).insert_text((10, 20), 'TikZ')
            content = pdf.tobytes()
        response = Mock(status_code=200, headers={'content-type': 'application/pdf'}, content=content)
        with tempfile.TemporaryDirectory() as directory, patch('backend.services.tikz_renderer.requests.get', return_value=response):
            render_tikz(self.payload['source'], Path(directory), 'sample', 180)
            svg = (Path(directory) / 'sample.svg').read_text(encoding='utf-8')
            self.assertIn('<svg', svg)
            self.assertIn('<path', svg)
            self.assertTrue((Path(directory) / 'sample.png').read_bytes().startswith(b'\x89PNG'))


if __name__ == '__main__':
    unittest.main()
