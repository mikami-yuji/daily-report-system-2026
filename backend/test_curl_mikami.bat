@echo off
curl "http://127.0.0.1:8001/images/search?query=117486&filename=%%E6%%9C%%AC%%E7%%A4%%BE008%%E3%%80%%802025%%E5%%B9%%B4%%E5%%BA%%A6%%E7%%94%%A8%%E6%%97%%A5%%E5%%A0%%B1%%E3%%80%%90%%E8%%A6%%8B%%E4%%B8%%8A%%E3%%80%%91.xlsm" > mikami_response.json
type mikami_response.json
