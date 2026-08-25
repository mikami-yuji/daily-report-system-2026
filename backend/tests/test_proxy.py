import os
import sys
from unittest.mock import MagicMock, patch

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import routes_proxy
from fastapi import Request, Response

def test_proxy_cookie_max_age_and_auto_login():
    # サーバーキャッシュのリセット
    routes_proxy._cached_viewer_cookies = {}
    
    mock_doc_response_401 = MagicMock()
    mock_doc_response_401.status_code = 401
    
    mock_login_response = MagicMock()
    mock_login_response.status_code = 200
    mock_login_response.cookies.get_dict.return_value = {"session_id": "test_token_abc"}
    
    mock_doc_response_200 = MagicMock()
    mock_doc_response_200.status_code = 200
    mock_doc_response_200.json.return_value = {"documents": [{"requestId": "REQ-1", "salesPerson": "営業太郎"}]}
    
    mock_request = MagicMock(spec=Request)
    mock_request.cookies = {}
    mock_response = Response()
    
    with patch("requests.get") as mock_get, patch("requests.post") as mock_post:
        mock_get.side_effect = [mock_doc_response_401, mock_doc_response_200]
        mock_post.return_value = mock_login_response
        
        result = routes_proxy.proxy_design_requests(
            request=mock_request,
            response=mock_response,
            passcode="valid_code"
        )
        
        assert len(result["documents"]) == 1
        assert routes_proxy._cached_viewer_cookies.get("session_id") == "test_token_abc"
        # Response headers に set-cookie が含まれるか確認
        assert "set-cookie" in mock_response.headers
        cookie_header = mock_response.headers["set-cookie"]
        assert f"Max-Age={routes_proxy.COOKIE_MAX_AGE}" in cookie_header
