import hashlib
import os
import unittest
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from backend.main import app
from backend.services.cloudinary_upload import upload_svg


ENV = {'CLOUDINARY_CLOUD_NAME': 'test-cloud', 'CLOUDINARY_API_KEY': 'test-key',
       'CLOUDINARY_API_SECRET': 'test-secret', 'CLOUDINARY_FOLDER': 'quiz-tests'}
SVG = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>'


class CloudinaryTests(unittest.TestCase):
    @patch.dict(os.environ, ENV)
    def test_only_public_config_reaches_browser(self):
        result = TestClient(app).get('/api/latex-to-json/config')
        self.assertEqual(result.json(), {'signed_upload': True, 'cloud_name': 'test-cloud', 'folder': 'quiz-tests'})
        self.assertNotIn('test-secret', result.text)
        self.assertNotIn('test-key', result.text)

    @patch.dict(os.environ, ENV)
    def test_signature_svg_bytes_and_stable_non_overwriting_id(self):
        response = Mock(ok=True)
        response.json.return_value = {'secure_url': 'https://res.cloudinary.com/test-cloud/image/upload/test.svg'}
        with patch('backend.services.cloudinary_upload.requests.post', return_value=response) as post:
            first = upload_svg(SVG)
            second = upload_svg(SVG)
            self.assertEqual(first, second)
            first_data = post.call_args_list[0].kwargs['data']
            self.assertEqual(first_data['public_id'], post.call_args_list[1].kwargs['data']['public_id'])
            self.assertEqual(first_data['overwrite'], 'false')
            self.assertEqual(first_data['folder'], 'quiz-tests')
            parameters = {k: v for k, v in first_data.items() if k not in {'signature', 'api_key'}}
            signed = '&'.join(f'{k}={parameters[k]}' for k in sorted(parameters)) + 'test-secret'
            self.assertEqual(first_data['signature'], hashlib.sha256(signed.encode()).hexdigest())
            self.assertEqual(post.call_args.kwargs['files']['file'][1], SVG.encode())

    @patch.dict(os.environ, ENV)
    def test_invalid_svg_rejected_before_upload(self):
        with patch('backend.services.cloudinary_upload.requests.post') as post:
            for svg in ['<html/>', '<svg', '<!DOCTYPE svg>' + SVG, SVG.replace('<path', '<script'), SVG.replace('<path', '<path onload="alert(1)"')]:
                with self.subTest(svg=svg):
                    with self.assertRaises(ValueError):
                        upload_svg(svg)
            post.assert_not_called()

    @patch.dict(os.environ, ENV)
    def test_upstream_error_cannot_echo_secrets(self):
        response = Mock(ok=False, status_code=401)
        response.json.return_value = {'error': {'message': 'test-secret test-key'}}
        with patch('backend.services.cloudinary_upload.requests.post', return_value=response):
            result = TestClient(app).post('/api/latex-to-json/upload-svg', json={'svg': SVG})
        self.assertEqual(result.status_code, 502)
        self.assertNotIn('test-secret', result.text)
        self.assertNotIn('test-key', result.text)


if __name__ == '__main__':
    unittest.main()
