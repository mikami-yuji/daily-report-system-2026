import os
import sys
from unittest.mock import MagicMock, patch

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import config
import routes_proxy
import routes_images
from fastapi import Request

def test_search_design_images_hybrid_merge():
    """企画課Webデータベースとファイルサーバーのハイブリッドマージのテスト"""
    mock_docs = [
        {
            "id": "doc_100",
            "requestId": "99999",
            "subId": "3",
            "planner": "企画太郎",
            "designContent": "テストデザイン新版",
            "completedAt": "2026-09-08T12:00:00Z",
            "compImages": [
                {"id": "comp_1", "url": "/api/comp-images/comp_1/file", "fileName": "99999-3_front.jpg"}
            ]
        },
        {
            "id": "doc_99",
            "requestId": "99999",
            "subId": "2",
            "planner": "企画太郎",
            "designContent": "テストデザイン第2版",
            "completedAt": "2026-09-01T12:00:00Z",
            "compImages": [
                {"id": "comp_2", "url": "/api/comp-images/comp_2/file", "fileName": "99999-2.jpg"}
            ]
        }
    ]

    mock_request = MagicMock(spec=Request)
    mock_request.cookies = {}

    with patch.object(routes_proxy, 'fetch_viewer_documents', return_value=mock_docs):
        # ファイルサーバーへのアクセス可能性とsafe_walkをモック（CI/Linux環境対応）
        with patch.object(config, 'is_network_path_accessible', return_value=True), \
             patch.object(os.path, 'exists', return_value=True), \
             patch.object(routes_images, 'safe_walk', return_value=[
            {"name": "99999-2-old_server.jpg", "path": "test/99999-2-old_server.jpg", "folder": "データ", "mtime": 500.0},
            {"name": "99999-1-test.jpg", "path": "test/99999-1-test.jpg", "folder": "データ", "mtime": 1000.0}
        ]):
            data = routes_images.search_design_images(query="99999", request=mock_request)
            images = data["images"]

            # 合計3枚（企画課2枚 + ファイルサーバー1枚。ファイルサーバー側の枝番2は被りのため除外される）
            assert len(images) == 3
            # 最上位が枝番3（企画課Web）
            assert images[0]["branch_no"] == 3
            assert images[0]["source"] == "viewer"
            assert images[0]["name"] == "99999-3_front.jpg"

            # 2番目が枝番2（企画課Web側が優先され、ファイルサーバーの古い枝番2は除外）
            assert images[1]["branch_no"] == 2
            assert images[1]["source"] == "viewer"
            assert images[1]["name"] == "99999-2.jpg"

            # 3番目が枝番1（ファイルサーバー側にしかないので保持）
            assert images[2]["branch_no"] == 1
            assert images[2]["source"] == "file_server"

def test_viewer_content_proxy_endpoint():
    """画像プロキシエンドポイントの動作テスト"""
    mock_request = MagicMock(spec=Request)
    mock_request.cookies = {}

    with patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"Content-Type": "image/jpeg", "Content-Disposition": "inline"}
        mock_resp.raw = MagicMock()
        mock_get.return_value = mock_resp

        res = routes_images.serve_viewer_image(url="/api/comp-images/123/download", request=mock_request)
        assert res.media_type == "image/jpeg"
